<#
.SYNOPSIS
  Starts the full Mitra System stack in separate PowerShell windows.

.DESCRIPTION
  Services:
    MitraOS web        http://localhost:3000
    DukaanMitra Next   http://localhost:3001
    Core Engine        http://localhost:3100
    AI Services        http://localhost:8000
    OpenWA gateway     http://localhost:2785  (Docker, optional)

  Static demos need no server:
    index.html
    apps/dukaanmitra-site/index.html
    apps/storemitra-site/index.html

.PARAMETER SkipAi
  Do not start the Python FastAPI AI service.

.PARAMETER SkipOpenWA
  Do not start the Docker OpenWA gateway.

.PARAMETER Install
  Run npm install in each JS app before starting. Use on a fresh clone.

.PARAMETER NoBrowser
  Do not open the umbrella site in the default browser.

.EXAMPLE
  .\scripts\start-all.ps1

.EXAMPLE
  .\scripts\start-all.ps1 -SkipAi -SkipOpenWA
#>
[CmdletBinding()]
param(
  [switch]$SkipAi,
  [switch]$SkipOpenWA,
  [switch]$Install,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$PS = (Get-Process -Id $PID).Path

function Write-Step($text) { Write-Host "  -> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "  OK $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "  !! $text" -ForegroundColor Yellow }

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Start-ServiceWindow {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string]$Command,
    [hashtable]$Environment = @{}
  )

  $envLines = foreach ($key in $Environment.Keys) {
    "`$env:$key = '$($Environment[$key])'"
  }

  $script = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location -LiteralPath '$WorkingDirectory'
$($envLines -join "`n")
Write-Host ''
Write-Host '=== $Title ===' -ForegroundColor Magenta
Write-Host ''
$Command
Write-Host ''
Write-Host 'Service stopped. Press any key to close.' -ForegroundColor DarkGray
`$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
"@

  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
  Start-Process -FilePath $PS -ArgumentList @('-NoLogo', '-NoProfile', '-EncodedCommand', $encoded) | Out-Null
  Write-Ok "$Title started in a new window"
}

Write-Host ''
Write-Host '  ============================================================' -ForegroundColor DarkMagenta
Write-Host '        Mitra System - full stack launcher' -ForegroundColor White
Write-Host '  ============================================================' -ForegroundColor DarkMagenta
Write-Host ''

# ---------- prerequisites ----------
if (-not (Test-Command 'node')) { throw 'Node.js is not installed or not on PATH. Install Node 20+.' }
if (-not (Test-Command 'npm')) { throw 'npm is not on PATH. Reinstall Node.js.' }
Write-Ok "Node $((node --version).Trim()) / npm $((npm --version).Trim())"

$services = @(
  @{ Name = 'MitraOS web';        Dir = 'apps/mitra-os-web';   Port = 3000; Url = 'http://localhost:3000'; Cmd = 'npm run dev'; Env = @{} },
  @{ Name = 'DukaanMitra Next';   Dir = 'apps/dukaan-in-next'; Port = 3001; Url = 'http://localhost:3001'; Cmd = 'npm run dev -- -p 3001'; Env = @{} },
  @{ Name = 'Core Engine';        Dir = 'apps/core-engine';    Port = 3100; Url = 'http://localhost:3100'; Cmd = 'npm run dev'; Env = @{ PORT = '3100'; OPENWA_URL = 'http://localhost:2785'; CORE_WEBHOOK_URL = 'http://localhost:3100/whatsapp/openwa/webhook' } }
)

if ($Install) {
  Write-Host ''
  Write-Step 'Installing dependencies (this can take a few minutes)'
  foreach ($svc in $services) {
    $path = Join-Path $root $svc.Dir
    Write-Step "npm install in $($svc.Dir)"
    Push-Location $path
    try { npm install --no-audit --no-fund } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { Write-Warn "npm install failed in $($svc.Dir)" }
  }
  Write-Ok 'Dependency install finished'
}

# ---------- port checks ----------
function Test-PortInUse($port) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
    return [bool]$conn
  } catch { return $false }
}

$allTargets = @($services | ForEach-Object { @{ Name = $_.Name; Port = $_.Port } })
if (-not $SkipAi) { $allTargets += @{ Name = 'AI Services'; Port = 8000 } }
if (-not $SkipOpenWA) { $allTargets += @{ Name = 'OpenWA gateway'; Port = 2785 } }

$blocked = $allTargets | Where-Object { Test-PortInUse $_.Port }
if ($blocked) {
  Write-Host ''
  Write-Warn 'These ports are already in use:'
  foreach ($b in $blocked) { Write-Host "     $($b.Port)  $($b.Name)" -ForegroundColor Yellow }
  Write-Host '     Stop those processes or close the old windows, then run again.' -ForegroundColor Yellow
  Write-Host ''
  $answer = Read-Host 'Continue anyway? (y/N)'
  if ($answer -notmatch '^(y|yes)$') { return }
}

# ---------- start JS services ----------
Write-Host ''
Write-Step 'Starting Node services'

foreach ($svc in $services) {
  $path = Join-Path $root $svc.Dir
  if (-not (Test-Path (Join-Path $path 'node_modules'))) {
    Write-Warn "$($svc.Dir) has no node_modules. Run with -Install or install manually."
  }
  Start-ServiceWindow -Title "Mitra System - $($svc.Name)" -WorkingDirectory $path -Command $svc.Cmd -Environment $svc.Env
  Start-Sleep -Milliseconds 400
}

# ---------- AI services ----------
if (-not $SkipAi) {
  if (-not (Test-Command 'python')) {
    Write-Warn 'Python not found - skipping AI Services. Install Python 3.11+ to enable it.'
  } else {
    $aiDir = Join-Path $root 'apps/ai-services'
    Start-ServiceWindow -Title 'Mitra System - AI Services' -WorkingDirectory $aiDir `
      -Command 'python -m uvicorn app:app --port 8000 --reload' `
      -Environment @{ PYTHONUNBUFFERED = '1' }
  }
}

# ---------- OpenWA ----------
if (-not $SkipOpenWA) {
  if (-not (Test-Command 'docker')) {
    Write-Warn 'Docker not found - skipping OpenWA gateway.'
  } else {
    Write-Step 'Starting OpenWA gateway via Docker'
    $compose = Join-Path $root 'apps/whatsapp-gateway/docker-compose.dev.yml'
    if (Test-Path $compose) {
      Push-Location (Join-Path $root 'apps/whatsapp-gateway')
      try {
        docker compose -f docker-compose.dev.yml up -d
        if ($LASTEXITCODE -eq 0) { Write-Ok 'OpenWA container started on http://localhost:2785' }
        else { Write-Warn 'OpenWA docker compose failed. Check Docker Desktop.' }
      } finally { Pop-Location }
    } else {
      Write-Warn "Compose file not found: $compose"
    }
  }
}

# ---------- summary ----------
Write-Host ''
Write-Host '  ============================================================' -ForegroundColor DarkMagenta
Write-Host '        Running services' -ForegroundColor White
Write-Host '  ============================================================' -ForegroundColor DarkMagenta
Write-Host ''
Write-Host '   MitraOS web        http://localhost:3000' -ForegroundColor Gray
Write-Host '   DukaanMitra Next   http://localhost:3001' -ForegroundColor Gray
Write-Host '   Core Engine        http://localhost:3100' -ForegroundColor Gray
if (-not $SkipAi) { Write-Host '   AI Services        http://localhost:8000' -ForegroundColor Gray }
if (-not $SkipOpenWA) { Write-Host '   OpenWA gateway     http://localhost:2785' -ForegroundColor Gray }
Write-Host ''
Write-Host '   Static demos (no server):' -ForegroundColor Gray
Write-Host '     index.html' -ForegroundColor Gray
Write-Host '     apps/dukaanmitra-site/index.html' -ForegroundColor Gray
Write-Host '     apps/storemitra-site/index.html' -ForegroundColor Gray
Write-Host ''
Write-Host '   Give services 10-20 seconds to compile on first run.' -ForegroundColor DarkGray
Write-Host ''

if (-not $NoBrowser) {
  $landing = Join-Path $root 'index.html'
  if (Test-Path $landing) {
    Start-Process $landing | Out-Null
  }
}
