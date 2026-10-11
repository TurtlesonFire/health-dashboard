# Static build for deployment: pre-render the API, then build the frontend.
#
# The data files land in frontend/public/api/ (gitignored - they are derived
# from the ETL database, which is itself derived from the public APIs), and
# Vite copies them into dist/ verbatim.

param(
    [switch]$SkipEtl
)

$ErrorActionPreference = "Stop"

$PYTHON  = "C:\Users\Asus\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe"
$PROJECT = "C:\Users\Asus\health-dashboard"

if (-not (Test-Path $PYTHON)) {
    Write-Error "Python not found at $PYTHON. Ensure Hermes Agent is installed."
}

Set-Location $PROJECT

if (-not $SkipEtl) {
    Write-Host "[1/3] Refreshing data from WHO GHO + World Bank..." -ForegroundColor Cyan
    & $PYTHON -m app.etl.pipeline
    if ($LASTEXITCODE -ne 0) { Write-Error "ETL failed; aborting build." }
} else {
    Write-Host "[1/3] Skipping ETL (-SkipEtl)" -ForegroundColor DarkGray
}

Write-Host "[2/3] Exporting API to static JSON..." -ForegroundColor Cyan
& $PYTHON scripts\export_static.py
if ($LASTEXITCODE -ne 0) { Write-Error "Static export failed; aborting build." }

Write-Host "[3/3] Building frontend (static mode)..." -ForegroundColor Cyan
Set-Location "$PROJECT\frontend"
$env:VITE_DATA_MODE = "static"
npx vite build
if ($LASTEXITCODE -ne 0) { Write-Error "Vite build failed." }
Remove-Item Env:\VITE_DATA_MODE

Write-Host ""
Write-Host "Static site ready: $PROJECT\frontend\dist" -ForegroundColor Green
Write-Host ""
Write-Host "Preview it (serve the files directly - vite preview applies the dev proxy):" -ForegroundColor Green
Write-Host "  cd $PROJECT\frontend\dist"
Write-Host "  $PYTHON -m http.server 4180"
Write-Host "  then open http://localhost:4180"
