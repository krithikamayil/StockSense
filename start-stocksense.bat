@echo off
title StockSense Launcher
echo ===================================================
echo        StockSense System Startup Launcher          
echo ===================================================
echo.

:: 1. Verify PostgreSQL service
echo [1/4] Checking PostgreSQL 17 database service...
net start postgresql-x64-17 >nul 2>&1
echo [OK] PostgreSQL service verified.

:: 2. Launch Python FastAPI AI Service
echo [2/4] Starting Python FastAPI AI Microservice (Port 8000)...
start "StockSense AI Service (Port 8000)" cmd /k "cd /d %~dp0ai-service && .\venv\Scripts\python.exe run.py"

:: 3. Launch Node.js Backend Server
echo [3/4] Starting Node.js Express Backend API (Port 5000)...
start "StockSense Backend API (Port 5000)" cmd /k "cd /d %~dp0backend && node src/server.js"

:: 4. Launch React Vite Frontend
echo [4/4] Starting React Vite Frontend (Port 3000)...
start "StockSense Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npx vite --host 0.0.0.0 --port 3000"

:: 5. Open Web App in Browser
echo.
echo ===================================================
echo   All 4 services are starting!
echo   Frontend:  http://localhost:3000
echo   Backend:   http://127.0.0.1:5000
echo   AI API:    http://127.0.0.1:8000
echo   Swagger:   http://127.0.0.1:8000/docs
echo ===================================================
timeout /t 3 >nul
start http://localhost:3000
