# Haddak: start everything for testing on your phone.
# Double-click start.bat (next to this file), or run:  powershell -ExecutionPolicy Bypass -File start.ps1
#
# 1. Opens Docker Desktop if it is closed, and starts the database (port 5435).
# 2. Starts the backend server in its own window (port 8000).
# 3. Finds this computer's Wi-Fi address and starts the app (Expo Go QR code) in its own window.
# Close those windows (or press Ctrl+C in them) to stop.

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$DbContainer = 'startup-db-1'
$DbPort = 5435
$DbUrl = "postgresql+psycopg://haddak:haddak@localhost:$DbPort/haddak"

function Write-Step($text) { Write-Host ''; Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    OK  $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "    !!  $text" -ForegroundColor Yellow }
function Stop-WithError($text) {
    Write-Host ''
    Write-Host "    XX  $text" -ForegroundColor Red
    Write-Host ''
    Read-Host 'Press Enter to close'
    exit 1
}

function Test-Docker {
    try { docker info *> $null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}

function Test-Backend {
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:8000/api/v1/health' -UseBasicParsing -TimeoutSec 3
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

Write-Host 'Haddak - starting up' -ForegroundColor White

# ---------------------------------------------------------------- 1. Docker + database
Write-Step 'Database'
if (-not (Test-Docker)) {
    # Docker Desktop can be installed for all users or just for you.
    $dockerExe = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'),
        (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $dockerExe) { Stop-WithError 'Docker Desktop was not found. Open it yourself from the Start menu, then run this again.' }
    Write-Host '    Opening Docker Desktop (this can take a minute)...'
    Start-Process $dockerExe
    $waited = 0
    while (-not (Test-Docker)) {
        Start-Sleep -Seconds 3
        $waited += 3
        if ($waited -ge 180) { Stop-WithError 'Docker did not start within 3 minutes. Open Docker Desktop, wait for "Engine running", then run this again.' }
    }
}
Write-Ok 'Docker is running'

$exists = docker ps -a --filter "name=^$DbContainer$" --format '{{.Names}}'
if ($exists) {
    docker start $DbContainer *> $null
} else {
    # First time on this computer: create the database container on port 5435
    # (5433 is taken by another project here).
    Write-Host '    Creating the database container...'
    $override = Join-Path $env:TEMP 'haddak-db-port.yml'
    "services:`n  db:`n    ports: !override [`"$($DbPort):5432`"]`n" | Set-Content -Path $override -Encoding ascii
    Push-Location $Root
    docker compose -f docker-compose.yml -f $override up -d db
    Pop-Location
}

$waited = 0
while ($true) {
    $health = docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $DbContainer 2>$null
    if ($health -eq 'healthy' -or $health -eq 'running') { break }
    Start-Sleep -Seconds 2
    $waited += 2
    if ($waited -ge 60) { Stop-WithError "The database did not become ready (status: $health)." }
}
Write-Ok "Database ready on port $DbPort"

# ---------------------------------------------------------------- 2. Wi-Fi address
Write-Step 'This computer''s address on the Wi-Fi'
$candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' }
$wifi = $candidates | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|Wireless|WLAN' } | Select-Object -First 1
if (-not $wifi) { $wifi = $candidates | Where-Object { $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|VirtualBox|VMware|Loopback' } | Select-Object -First 1 }
if (-not $wifi) { Stop-WithError 'No network found. Connect to Wi-Fi and run this again.' }
$Ip = $wifi.IPAddress
Write-Ok "$Ip  ($($wifi.InterfaceAlias))"
if ($Ip -notlike '192.168.*') {
    Write-Warn 'This is not a 192.168.x.x home network: the app will run, but email sign-in links will not.'
    Write-Warn 'University Wi-Fi (LAU) also blocks the phone from reaching this computer: use home Wi-Fi.'
}

# ---------------------------------------------------------------- 3. Backend
Write-Step 'Backend server'
if (Test-Backend) {
    Write-Ok 'Already running on port 8000'
} else {
    $backendDir = Join-Path $Root 'backend'
    $backendCmd = "`$Host.UI.RawUI.WindowTitle = 'Haddak backend (port 8000)'; " +
        "Set-Location '$backendDir'; `$env:DATABASE_URL = '$DbUrl'; " +
        ".venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000"
    Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $backendCmd
    $waited = 0
    while (-not (Test-Backend)) {
        Start-Sleep -Seconds 2
        $waited += 2
        if ($waited -ge 60) { Stop-WithError 'The backend did not start. Look at the "Haddak backend" window for the error.' }
    }
    Write-Ok 'Running on port 8000 (its own window)'
}

# ---------------------------------------------------------------- 4. App (Expo)
Write-Step 'App (Expo Go)'
$mobileDir = Join-Path $Root 'mobile'
$expoCmd = "`$Host.UI.RawUI.WindowTitle = 'Haddak app (Expo)'; " +
    "Set-Location '$mobileDir'; " +
    "`$env:EXPO_PUBLIC_API_URL = 'http://$($Ip):8000'; `$env:REACT_NATIVE_PACKAGER_HOSTNAME = '$Ip'; " +
    "npx expo start --lan --go --clear"
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $expoCmd
Write-Ok 'Starting in its own window'

Write-Host ''
Write-Host 'All set.' -ForegroundColor Green
Write-Host '  - In the "Haddak app (Expo)" window, wait for the QR code (about 30 seconds).'
Write-Host '  - On your phone (same Wi-Fi), open Expo Go and scan it.'
Write-Host '  - Admin page: http://localhost:8000/admin'
Write-Host '  - To stop: close the two Haddak windows.'
Write-Host ''
Read-Host 'Press Enter to close this window'
