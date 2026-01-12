@echo off
REM Top-level Windows build script for PlatformIO (Teensy 4.0)
REM Usage: run from repository root: build_windows.bat

setlocal enableextensions

REM Run from the script directory
cd /d "%~dp0"

set "ENV=teensy40"
set "PROJECT_DIR=%~dp0collector"

echo Building PlatformIO environment: %ENV% (project: %PROJECT_DIR%)

if not exist "%PROJECT_DIR%\platformio.ini" (
  echo platformio.ini not found in %PROJECT_DIR%.
  pause
  exit /b 1
)

where pio >nul 2>&1
if %ERRORLEVEL%==0 (
  pio run -e %ENV% -d "%PROJECT_DIR%"
) else (
  python -m platformio run -e %ENV% -d "%PROJECT_DIR%"
)

if %ERRORLEVEL% NEQ 0 (
  echo Build failed with exit code %ERRORLEVEL%.
  pause
  exit /b %ERRORLEVEL%
)

echo Build succeeded.
endlocal

REM wait for key press before closing
pause

exit /b 0
