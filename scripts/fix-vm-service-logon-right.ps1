#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Fixes Hyper-V / WSL2 VM start failure:
        HRESULT 0x80070569  (ERROR_LOGON_TYPE_NOT_GRANTED)

    Grants "Log on as a service" (SeServiceLogonRight) to
    NT VIRTUAL MACHINE\Virtual Machines (SID S-1-5-83-0) and makes sure that
    SID is NOT in "Deny log on as a service" (SeDenyServiceLogonRight) --
    because a deny entry overrides an allow.

    The script EXPORTS the current policy first and only edits the one SID, so
    every other account that already holds these rights is preserved.

.NOTES
    Run from an ELEVATED PowerShell window.

    Domain-joined devices: if this user right is defined by a domain GPO, the
    local change made here is reverted on the next policy refresh. In that case
    make the same change in the governing GPO:
        Computer Configuration > Policies > Windows Settings > Security Settings
        > Local Policies > User Rights Assignment
#>

[CmdletBinding()]
param(
    [string]$Sid = 'S-1-5-83-0'   # NT VIRTUAL MACHINE\Virtual Machines
)

$ErrorActionPreference = 'Stop'

$allowRight = 'SeServiceLogonRight'        # "Log on as a service"
$denyRight  = 'SeDenyServiceLogonRight'    # "Deny log on as a service"
$token      = "*$Sid"                       # SIDs are stored with a leading '*'

# --- scratch workspace -----------------------------------------------------
$work = Join-Path $env:TEMP ('vmlogon_{0}' -f ([guid]::NewGuid().ToString('N')))
New-Item -ItemType Directory -Path $work | Out-Null
$cfg = Join-Path $work 'current.inf'
$db  = Join-Path $work 'apply.sdb'

Write-Host '==> Exporting current user-rights policy...'
secedit /export /areas USER_RIGHTS /cfg $cfg | Out-Null

$lines = [System.Collections.Generic.List[string]](Get-Content -LiteralPath $cfg)

# --- backup on the Desktop -------------------------------------------------
$backup = Join-Path ([Environment]::GetFolderPath('Desktop')) `
          ("user-rights-backup-{0}.inf" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
Copy-Item -LiteralPath $cfg -Destination $backup
Write-Host "    Backup saved: $backup"

# Read the current members of a right (empty array if the right is absent).
function Get-Members([string]$right) {
    $line = $lines | Where-Object { $_ -match "^\s*$right\s*=" } | Select-Object -First 1
    if (-not $line) { return @() }
    ($line -split '=', 2)[1].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

# Write the members of a right back into $lines (insert the line if missing).
function Set-Members([string]$right, [string[]]$members) {
    $value = "$right = " + ($members -join ',')
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$right\s*=") { $lines[$i] = $value; return }
    }
    # Right not present yet -- add it under the [Privilege Rights] header.
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\[Privilege Rights\]') { $lines.Insert($i + 1, $value); return }
    }
    $lines.Add('[Privilege Rights]'); $lines.Add($value)
}

$changed = $false

# 1) Make sure the SID is NOT denied (deny wins over allow). --------------
$deny = Get-Members $denyRight
if (($deny -contains $token) -or ($deny -contains $Sid)) {
    Write-Warning "$Sid is in '$denyRight' (Deny log on as a service) -- removing it."
    Set-Members $denyRight ($deny | Where-Object { $_ -ne $token -and $_ -ne $Sid })
    $changed = $true
} else {
    Write-Host "==> OK: $Sid is not denied the service-logon right."
}

# 2) Make sure the SID IS allowed. ---------------------------------------
$allow = Get-Members $allowRight
if (($allow -contains $token) -or ($allow -contains $Sid)) {
    Write-Host "==> OK: $Sid already has 'Log on as a service'."
} else {
    Write-Host "==> Granting 'Log on as a service' to $Sid ..."
    Set-Members $allowRight (@($allow) + $token)
    $changed = $true
}

if (-not $changed) {
    Write-Host "`nNothing to change -- the right is already configured correctly."
    return
}

# --- apply -----------------------------------------------------------------
Set-Content -LiteralPath $cfg -Value $lines -Encoding Unicode

Write-Host '==> Applying updated policy...'
secedit /configure /db $db /cfg $cfg /areas USER_RIGHTS | Out-Null
gpupdate /target:computer /force | Out-Null

Write-Host '==> Restarting Hyper-V Virtual Machine Management service (vmms)...'
try {
    Restart-Service vmms -ErrorAction Stop
    Write-Host '    vmms restarted.'
} catch {
    Write-Warning "Could not restart vmms automatically: $($_.Exception.Message)"
    Write-Warning 'Reboot the machine if the VM still will not start.'
}

Write-Host "`nDone. Start the workspace / VM again."
