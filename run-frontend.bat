@echo off
REM Run the PH Health Systems Dashboard frontend
REM Uses npm (requires Node.js to be installed)

set FRONTEND=C:\Users\Asus\health-dashboard\frontend

if not exist "%FRONTEND%\package.json" (
    echo ERROR: Frontend not found at %FRONTEND%
    pause
    exit /b 1
)

cd /d "%FRONTEND%"
echo Starting PH Health Systems Dashboard frontend...
echo.
echo Frontend will be available at: http://localhost:3000
echo.
echo Press Ctrl+C to stop.
echo.

npm run dev

pause
