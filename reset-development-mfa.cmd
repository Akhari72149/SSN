@echo off
setlocal
cd /d "%~dp0web"

if not exist ".env.local" (
  echo.
  echo Development settings were not found. Run setup-development.cmd first.
  echo.
  pause
  exit /b 1
)

echo.
echo Safer Spaces development MFA recovery
echo This reconnects MFA for one account in the local development database only.
echo The account password and application data are not changed.
echo.

node --env-file=.env.local scripts/reset-development-mfa.mjs
if errorlevel 1 goto :failed

echo.
pause
exit /b 0

:failed
echo.
echo MFA was not changed. Review the message above.
pause
exit /b 1
