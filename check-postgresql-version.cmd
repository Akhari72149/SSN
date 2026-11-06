@echo off
setlocal
cd /d "%~dp0"

echo.
echo Safer Spaces PostgreSQL version check
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check-postgresql-version.ps1"
set "CHECK_RESULT=%ERRORLEVEL%"

echo.
if "%CHECK_RESULT%"=="0" (
  echo PostgreSQL 16 is ready for Safer Spaces development.
) else (
  echo PostgreSQL 16 was not confirmed. Review the details above.
)
pause
exit /b %CHECK_RESULT%
