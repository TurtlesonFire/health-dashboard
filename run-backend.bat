@echo off
REM Run the PH Health Systems Dashboard backend
REM Uses the Hermes venv Python (3.11) which has all dependencies installed

set PYTHON=C:\Users\Asus\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe
set PROJECT=C:\Users\Asus\health-dashboard

if not exist "%PYTHON%" (
    echo ERROR: Python not found at %PYTHON%
    echo Please ensure Hermes Agent is installed.
    pause
    exit /b 1
)

if not exist "%PROJECT%\app\main.py" (
    echo ERROR: Project not found at %PROJECT%
    pause
    exit /b 1
)

cd /d "%PROJECT%"
echo Starting PH Health Systems Dashboard backend...
echo Python: %PYTHON%
echo Project: %PROJECT%
echo.
echo API will be available at: http://localhost:8000
echo API docs at: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop.
echo.

"%PYTHON%" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
