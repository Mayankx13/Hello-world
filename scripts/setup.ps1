# Life OS — Windows setup. Run from repo root in PowerShell.
$ErrorActionPreference = "Stop"

Write-Host "==> Creating venv (.venv)" -ForegroundColor Cyan
if (-not (Test-Path ".venv")) { python -m venv .venv }

Write-Host "==> Activating venv"
. .\.venv\Scripts\Activate.ps1

Write-Host "==> Installing project (editable, with dev extras)" -ForegroundColor Cyan
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"

Write-Host "==> Checking age binary"
if (-not (Get-Command age -ErrorAction SilentlyContinue)) {
    Write-Host "age not on PATH. Download from https://github.com/FiloSottile/age/releases" -ForegroundColor Yellow
    Write-Host "Place age.exe somewhere on PATH (e.g. %USERPROFILE%\bin), then re-run this script." -ForegroundColor Yellow
} else {
    Write-Host "age: found"
}

Write-Host "==> Running preflight" -ForegroundColor Cyan
python scripts\preflight.py

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  journal config set-key      # store Anthropic key in Credential Manager"
Write-Host "  journal config init-age     # create age identity (private bucket)"
Write-Host "  journal evening             # first entry"
Write-Host "  status                      # dashboard"
