@echo off
setlocal
cd /d "%~dp0"

echo.
echo Safer Spaces database update
echo This applies pending migrations only. Accounts and application settings are not recreated.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-development-database.ps1"
if errorlevel 1 goto :failed

echo.
echo Database update finished. Restart Safer Spaces.
pause
exit /b 0

:failed
echo.
echo The database update did not complete. No partially applied migration was retained.
pause
exit /b 1
