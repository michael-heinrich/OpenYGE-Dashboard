@echo on
REM Install script: ensures Python is present (via winget), then installs Python requirements
REM Usage: run from repository root: install.bat

setlocal enableextensions

echo Checking for Python...
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :python_found

echo Python not found. Attempting to install via winget...
winget --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo winget not found. Please install Python manually from https://www.python.org/downloads/ and re-run this script.
  pause
  exit /b 1
)

echo Installing Python - this may require elevated privileges.
winget install --id Python.Python.3 -e --source winget
if %ERRORLEVEL% NEQ 0 (
  echo winget install failed. Please install Python manually and re-run this script.
  pause
  exit /b 1
)

:python_found
echo Python found.

echo Upgrading pip...
python -m pip install --upgrade pip

echo Installing Python dependencies from requirements.txt...
python -m pip install -r "%~dp0requirements.txt"
if %ERRORLEVEL% NEQ 0 (
  echo Failed to install requirements via pip.
  pause
  exit /b %ERRORLEVEL%
)

echo Installation complete.
pause
endlocal
exit /b 0
