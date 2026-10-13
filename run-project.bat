@echo off
REM Drivea - Full Project Runner
REM This script runs both the backend API and frontend client

echo ========================================
echo  Drivea - Starting Full Development Env
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/2] Starting Backend API Server (port 4000)...
echo.

REM Start the backend server in a new window
start "Drivea API Server" cmd /k "cd /d %~dp0 && node server/dev.js"

REM Wait a moment for the server to start
timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Client (Vite)...
echo.

REM Start the frontend client in a new window
start "Drivea Client" cmd /k "cd /d %~dp0\client && npm run dev"

echo.
echo ========================================
echo  Both servers are starting...
echo.
echo  - API Server: http://localhost:4000
echo  - Client:      http://localhost:5173 (default Vite port)
echo.
echo  Close the command windows to stop servers.
echo ========================================
echo.

pause
