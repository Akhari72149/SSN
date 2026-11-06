@echo off
setlocal
cd /d "%~dp0"

echo.
echo Safer Spaces development setup
echo This creates an isolated local database and a first administrator.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-development.ps1"
if errorlevel 1 goto :failed

echo.
echo Setup finished. Double-click run-safer-spaces.cmd to start the app.
pause
exit /b 0

:failed
echo.
echo Setup did not complete. Review the message above, then try again.
pause
exit /b 1
