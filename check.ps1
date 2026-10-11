# One-command health check for the dashboard.
#
# Runs the four verification suites and confirms both data modes respond.
# Does not start or stop servers - see the notes at the end for that.
#
#   ./check.ps1

$ErrorActionPreference = "Continue"
$PYTHON  = "C:\Users\Asus\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe"
$PROJECT = "C:\Users\Asus\health-dashboard"

Set-Location $PROJECT

$script:failed = 0

function Check-Service($name, $url) {
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 8 -UseBasicParsing
        Write-Host ("  {0,-34} HTTP {1}" -f $name, $r.StatusCode) -ForegroundColor Green
        return $true
    } catch {
        Write-Host ("  {0,-34} DOWN" -f $name) -ForegroundColor Yellow
        return $false
    }
}

Write-Host ""
Write-Host "1. Services" -ForegroundColor Cyan
Write-Host ("-" * 60)
$devUp    = Check-Service ":8000 FastAPI backend"      "http://localhost:8000/health"
$frontUp  = Check-Service ":3000 Vite dev server"      "http://localhost:3000/"
$staticUp = Check-Service ":4180 static build preview" "http://localhost:4180/"

if (-not $devUp -or -not $frontUp) {
    Write-Host ""
    Write-Host "  Start the dev servers first:" -ForegroundColor Yellow
    Write-Host "    .\run-backend.bat      (new terminal)"
    Write-Host "    .\run-frontend.bat     (new terminal)"
}

Write-Host ""
Write-Host "2. Verification suites" -ForegroundColor Cyan
Write-Host ("-" * 60)

$suites = @(
    "verify_quintile_logic",   # wealth-quintile data contract
    "verify_fix_and_split",    # sex filter + code-splitting
    "verify_ux_improvements",  # formatting, peso series, metric blurbs
    "verify_static_deploy"     # static build serves with no backend
)

foreach ($s in $suites) {
    $out = & node "tests\$s.mjs" 2>&1 | Out-String
    $ok  = $LASTEXITCODE -eq 0
    if (-not $ok) { $script:failed++ }

    $summary = ($out -split "`n" |
        Where-Object { $_ -match "RESULT:|ALL CHECKS PASSED|Error:" } |
        Select-Object -Last 1)
    if (-not $summary) { $summary = "no summary line" }

    $color = if ($ok) { "Green" } else { "Red" }
    Write-Host ("  {0,-26} {1}" -f $s, $summary.Trim()) -ForegroundColor $color
}

Write-Host ""
Write-Host "3. Both data modes agree" -ForegroundColor Cyan
Write-Host ("-" * 60)

if ($devUp -and $frontUp -and $staticUp) {
    $dev  = (Invoke-WebRequest "http://localhost:3000/api/data/MDG_0000000007/quintiles?sex=SEX_BTSX" -UseBasicParsing -TimeoutSec 15).Content
    $stat = (Invoke-WebRequest "http://localhost:4180/api/data/MDG_0000000007/quintiles.json" -UseBasicParsing -TimeoutSec 15).Content
    if ($dev -eq $stat) {
        Write-Host "  dev proxy and static JSON return identical payloads" -ForegroundColor Green
    } else {
        Write-Host "  payloads differ - the export may be stale" -ForegroundColor Red
        $script:failed++
    }
} else {
    Write-Host "  skipped (a server is down)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host ("-" * 60)
if ($script:failed -eq 0) {
    Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
} else {
    Write-Host "$script:failed CHECK(S) FAILED" -ForegroundColor Red
}
Write-Host ("-" * 60)
Write-Host ""
Write-Host "To view it yourself, open these in a browser:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000   dev mode   (live backend)"
Write-Host "  http://localhost:4180   static     (what will be deployed)"
Write-Host ""
Write-Host "To preview the static build fresh:"
Write-Host '  cd frontend\dist'
Write-Host '  <venv-python> -m http.server 4180'
Write-Host ""

exit $script:failed
