@echo off
REM Launch the Flask server and open the web UI in the default browser
REM Usage: run from repository root: launch_server.bat

setlocal enableextensions

set "HOST=localhost"
set "PORT=5000"

echo Opening web browser to http://%HOST%:%PORT%/ ...
start "" "http://%HOST%:%PORT%/"

echo Starting Flask server (backend/app.py)...
cd /d "%~dp0\backend"

python app.py --host 0.0.0.0 --http-port %PORT%

endlocal
exit /b 0
