# Cloudflare Tunnel Startup Script
# Run this from the aura-platform folder

$ErrorActionPreference = "Stop"

Write-Host "Starting Aura Platform with Cloudflare Tunnels..." -ForegroundColor Cyan
Write-Host ""

# Check if cloudflared is installed
if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "cloudflared not found. Install it with:" -ForegroundColor Red
    Write-Host "  winget install cloudflare.cloudflared" -ForegroundColor Yellow
    exit 1
}

# Cleanup function
function Stop-AllServices {
    Write-Host "Shutting down all services..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "All services stopped." -ForegroundColor Green
}

# Kill any existing processes
Write-Host "Cleaning up old processes..." -ForegroundColor Gray
Stop-AllServices
Start-Sleep -Seconds 1

# Start backend server (hidden window)
Write-Host "Starting backend server..." -ForegroundColor Yellow
$backendDir = Join-Path $PSScriptRoot "backend"
Start-Process -FilePath "cmd" -ArgumentList "/c cd /d `"$backendDir`" && set NODE_TLS_REJECT_UNAUTHORIZED=0 && npm run dev" -WindowStyle Hidden
Start-Sleep -Seconds 3

# Start backend tunnel and capture URL
Write-Host "Starting backend tunnel..." -ForegroundColor Yellow
$backendTunnelLog = Join-Path $env:TEMP "backend-tunnel.log"
Remove-Item $backendTunnelLog -ErrorAction SilentlyContinue
Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --url http://localhost:3001" -RedirectStandardError $backendTunnelLog -WindowStyle Hidden

# Wait for tunnel URL
Write-Host "Waiting for backend tunnel URL..." -ForegroundColor Gray
$backendUrl = $null
$attempts = 0
while ($null -eq $backendUrl -and $attempts -lt 30) {
    Start-Sleep -Seconds 1
    $attempts++
    if (Test-Path $backendTunnelLog) {
        $content = Get-Content $backendTunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match "https://[a-z0-9-]+\.trycloudflare\.com") {
            $backendUrl = $matches[0]
        }
    }
}

if ($null -eq $backendUrl) {
    Write-Host "Failed to get backend tunnel URL" -ForegroundColor Red
    Stop-AllServices
    exit 1
}

Write-Host "Backend tunnel: $backendUrl" -ForegroundColor Green

# Update .env file
$envFile = Join-Path $PSScriptRoot ".env"
$envContent = "VITE_API_URL=$backendUrl/api"
Set-Content -Path $envFile -Value $envContent
Write-Host "Updated .env with API URL" -ForegroundColor Gray

# Start frontend server (hidden window)
Write-Host "Starting frontend server..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/c cd /d `"$PSScriptRoot`" && npm run dev" -WindowStyle Hidden
Start-Sleep -Seconds 3

# Start frontend tunnel and capture URL
Write-Host "Starting frontend tunnel..." -ForegroundColor Yellow
$frontendTunnelLog = Join-Path $env:TEMP "frontend-tunnel.log"
Remove-Item $frontendTunnelLog -ErrorAction SilentlyContinue
Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --url http://localhost:5173" -RedirectStandardError $frontendTunnelLog -WindowStyle Hidden

# Wait for tunnel URL
Write-Host "Waiting for frontend tunnel URL..." -ForegroundColor Gray
$frontendUrl = $null
$attempts = 0
while ($null -eq $frontendUrl -and $attempts -lt 30) {
    Start-Sleep -Seconds 1
    $attempts++
    if (Test-Path $frontendTunnelLog) {
        $content = Get-Content $frontendTunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match "https://[a-z0-9-]+\.trycloudflare\.com") {
            $frontendUrl = $matches[0]
        }
    }
}

if ($null -eq $frontendUrl) {
    Write-Host "Failed to get frontend tunnel URL" -ForegroundColor Red
    Stop-AllServices
    exit 1
}

# Success!
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AURA PLATFORM IS RUNNING!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Share this URL with friends:" -ForegroundColor White
Write-Host "  $frontendUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend API:" -ForegroundColor Gray
Write-Host "  $backendUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "Press ENTER to stop all services" -ForegroundColor Gray
Write-Host ""

# Copy to clipboard
$frontendUrl | Set-Clipboard
Write-Host "(URL copied to clipboard)" -ForegroundColor DarkGray

# Wait for user to press Enter, then cleanup
Read-Host
Stop-AllServices
