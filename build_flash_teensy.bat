@echo off
REM Flash a connected Teensy with the collector app using PlatformIO
REM Usage: run from repository root: flash_teensy.bat

setlocal enableextensions

REM Ensure script runs from repository root
cd /d "%~dp0"

set "ENV=teensy40"
set "PROJECT_DIR=%~dp0collector"

if not exist "%PROJECT_DIR%\platformio.ini" (
  echo platformio.ini not found in %PROJECT_DIR%.
  pause
  exit /b 1
)

echo This will build and upload the `collector` firmware to a connected Teensy.
set /p CONFIRM="Are you sure you want to proceed? (y/N): "
if /I not "%CONFIRM%"=="y" (
  echo Aborting.
  pause
  exit /b 0
)

echo Building and uploading to Teensy (env: %ENV%)...
where pio >nul 2>&1
if %ERRORLEVEL%==0 (
  pio run -e %ENV% -t upload -d "%PROJECT_DIR%"
) else (
  python -m platformio run -e %ENV% -t upload -d "%PROJECT_DIR%"
)

if %ERRORLEVEL% NEQ 0 (
  echo Upload failed with exit code %ERRORLEVEL%.
  pause
  exit /b %ERRORLEVEL%
)

echo Upload succeeded.
pause
endlocal
exit /b 0
