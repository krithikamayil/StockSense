# StockSense Automated Startup Script for Windows PowerShell
Write-Host "===================================================" -ForegroundColor Green
Write-Host "       StockSense System Startup Launcher          " -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

# 1. PostgreSQL Service
Write-Host "[1/4] Checking PostgreSQL 17 service..." -ForegroundColor Cyan
try {
    Start-Service postgresql-x64-17 -ErrorAction SilentlyContinue
    $pg = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
    Write-Host "      PostgreSQL Service: $($pg.Status)" -ForegroundColor Gray
} catch {
    Write-Host "      PostgreSQL service check skipped (manual service)." -ForegroundColor Gray
}

$root = $PSScriptRoot

# 2. Python FastAPI AI Service
Write-Host "[2/4] Starting Python FastAPI AI Microservice (Port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root\ai-service`"; & `".\venv\Scripts\python.exe`" run.py" -WindowStyle Normal

# 3. Node.js Express Backend
Write-Host "[3/4] Starting Node.js Express Backend API (Port 5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root\backend`"; node src/server.js" -WindowStyle Normal

# 4. React Vite Frontend
Write-Host "[4/4] Starting React Vite Frontend (Port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root\frontend`"; npx vite --host 0.0.0.0 --port 3000" -WindowStyle Normal

Write-Host ""
Write-Host "All services initiated. Opening browser in 3 seconds..." -ForegroundColor Green
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"
