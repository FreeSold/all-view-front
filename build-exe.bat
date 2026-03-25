@echo off
REM 在 CMD 下执行，避免 PowerShell 禁止运行 npm.ps1
cd /d "%~dp0"
call npm.cmd run build:exe
if errorlevel 1 exit /b 1
echo.
echo Done. Check folder: release\
pause
