@echo off
setlocal

title Zashboard Auto Start
echo [1/2] Switching to project directory...
cd /d "%~dp0"

echo [2/2] Starting via PowerShell launcher...
if /I "%~1"=="--check" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-za.ps1" -Check
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-za.ps1"
)

endlocal
