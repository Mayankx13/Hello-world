<#
  LIQO  ⟵  BUSY inventory connector
  --------------------------------------------------------------------------
  Reads current stock from BUSY — directly from its MS SQL Server database
  (recommended, live) OR from a BUSY export file (CSV) — maps it to the LIQO
  row contract, and pushes ONE full snapshot to the LIQO API, which atomically
  replaces the D1 inventory. Runs unattended via Windows Task Scheduler.

  No installs: uses .NET's built-in System.Data.SqlClient. Windows PowerShell
  5.1+ (or PowerShell 7).

  Run:
    powershell -ExecutionPolicy Bypass -File .\busy-liqo-sync.ps1 -Config .\config.json
#>
[CmdletBinding()]
param([string]$Config = "$PSScriptRoot\config.json")

$ErrorActionPreference = "Stop"

function Log($msg) {
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "[$ts] $msg"
  Write-Host $line
  try { Add-Content -Path "$PSScriptRoot\busy-liqo-sync.log" -Value $line } catch {}
}

# Read a field from either a DataRow (SQL) or a PSCustomObject (CSV).
function Get-Field($row, $col) {
  if ([string]::IsNullOrEmpty($col)) { return $null }
  if ($row -is [System.Data.DataRow]) {
    if ($row.Table.Columns.Contains($col)) {
      $v = $row[$col]; if ($v -is [System.DBNull]) { return $null }; return $v
    }
    return $null
  }
  $p = $row.PSObject.Properties[$col]; if ($p) { return $p.Value }
  return $null
}

# "₹ 1,20,999.00" / "12.5" -> number, else $null.
function To-Num($v) {
  if ($null -eq $v) { return $null }
  $s = ([string]$v).Trim() -replace '[,\s₹]', ''
  if ($s -eq '') { return $null }
  $d = 0.0
  if ([double]::TryParse($s, [ref]$d)) { return $d }
  return $null
}

try {
  if (-not (Test-Path $Config)) { throw "Config not found: $Config (copy config.example.json -> config.json)" }
  $cfg = Get-Content $Config -Raw | ConvertFrom-Json

  # ---------- 1. READ from the source ----------
  $source = @()
  if ($cfg.mode -eq "sql") {
    $s = $cfg.sql
    if ($s.auth -eq "sql") {
      $connStr = "Server=$($s.server);Database=$($s.database);User ID=$($s.user);Password=$($s.password);TrustServerCertificate=True;Encrypt=False;"
    } else {
      $connStr = "Server=$($s.server);Database=$($s.database);Integrated Security=SSPI;TrustServerCertificate=True;Encrypt=False;"
    }
    Log "SQL mode -> $($s.server) / $($s.database)"
    $conn = New-Object System.Data.SqlClient.SqlConnection $connStr
    $conn.Open()
    try {
      $cmd = $conn.CreateCommand(); $cmd.CommandText = $s.query; $cmd.CommandTimeout = 180
      $da = New-Object System.Data.SqlClient.SqlDataAdapter $cmd
      $dt = New-Object System.Data.DataTable
      [void]$da.Fill($dt)
      $source = $dt.Rows
    } finally { $conn.Close() }
  }
  elseif ($cfg.mode -eq "csv") {
    $path = $cfg.csv.path
    if ($cfg.csv.pickNewestIn) {
      $f = Get-ChildItem -Path $cfg.csv.pickNewestIn -Filter $cfg.csv.filter -ErrorAction SilentlyContinue |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($f) { $path = $f.FullName }
    }
    if (-not $path -or -not (Test-Path $path)) { throw "CSV not found (csv.path / csv.pickNewestIn)" }
    Log "CSV mode -> $path"
    $source = Import-Csv -Path $path
  }
  else { throw "config.mode must be 'sql' or 'csv'" }

  $srcCount = @($source).Count
  Log "read $srcCount source rows"

  # ---------- 2. MAP to the LIQO row contract ----------
  $cm = $cfg.columnMap
  $catMap = @{}; foreach ($k in $cfg.categoryMap.PSObject.Properties.Name) { if ($k -eq '_comment') { continue }; $catMap[$k.ToUpper()] = $cfg.categoryMap.$k }
  $storeMap = @{}; foreach ($k in $cfg.storeMap.PSObject.Properties.Name) { if ($k -eq '_comment') { continue }; $storeMap[$k.ToUpper()] = $cfg.storeMap.$k }
  $channel = if ($cfg.defaultChannel) { $cfg.defaultChannel } else { "retail" }

  $rows = New-Object System.Collections.ArrayList
  $skipped = 0
  foreach ($r in $source) {
    $sku = [string](Get-Field $r $cm.sku)
    if ([string]::IsNullOrWhiteSpace($sku)) { $skipped++; continue }

    $rawCat = ([string](Get-Field $r $cm.category)).Trim()
    $cat = $catMap[$rawCat.ToUpper()]
    if (-not $cat) { $skipped++; continue }   # only the 4 engine categories (ac/tv/fridge/wm)

    $rawStore = ([string](Get-Field $r $cm.store)).Trim()
    $store = $storeMap[$rawStore.ToUpper()]
    if (-not $store) { $store = ($rawStore.ToLower() -replace '[^a-z0-9]+', '-').Trim('-') }

    $price = To-Num (Get-Field $r $cm.price); if ($null -eq $price) { $price = 0 }
    $qty = To-Num (Get-Field $r $cm.stockQty); if ($null -eq $qty) { $qty = 0 }

    $obj = [ordered]@{
      sku      = $sku.Trim()
      store    = $store
      channel  = $channel
      category = $cat
      brand    = [string](Get-Field $r $cm.brand)
      price    = $price
      stockQty = $qty
    }
    if ($cm.name)        { $obj.name        = [string](Get-Field $r $cm.name) }
    if ($cm.model)       { $obj.model       = [string](Get-Field $r $cm.model) }
    if ($cm.mrp)         { $obj.mrp         = To-Num (Get-Field $r $cm.mrp) }
    if ($cm.capacityText){ $obj.capacityText= [string](Get-Field $r $cm.capacityText) }
    if ($cm.starRating)  { $obj.starRating  = [string](Get-Field $r $cm.starRating) }
    if ($cm.inverter)    { $obj.inverter    = [string](Get-Field $r $cm.inverter) }
    [void]$rows.Add($obj)
  }

  Log "mapped $($rows.Count) rows in the 4 categories (skipped $skipped)"
  if ($rows.Count -eq 0) { throw "no mappable rows — check columnMap / categoryMap against your source columns" }

  # ---------- 3. PUSH one full snapshot ----------
  $payload = @{ rows = @($rows) } | ConvertTo-Json -Depth 6 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)   # UTF-8 so ₹ / brand names survive
  $headers = @{ authorization = "Bearer $($cfg.adminToken)" }
  $resp = Invoke-RestMethod -Method Post -Uri $cfg.pushUrl -Headers $headers `
            -ContentType 'application/json; charset=utf-8' -Body $bytes
  Log "PUSH ok -> raw=$($resp.raw) written=$($resp.written) source=$($resp.source) at=$($resp.at)"
  exit 0
}
catch {
  Log "ERROR: $($_.Exception.Message)"
  exit 1
}
