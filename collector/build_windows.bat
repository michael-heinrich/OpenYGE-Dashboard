@echo off
REM Windows build script for PlatformIO (Teensy 4.0)
REM Usage: build_windows.bat

setlocal enableextensions

REM Run from the script directory
cd /d "%~dp0"

set "ENV=teensy40"

echo Building PlatformIO environment: %ENV%

where pio >nul 2>&1
if %ERRORLEVEL%==0 (
  pio run -e %ENV%
) else (
  python -m platformio run -e %ENV%
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
