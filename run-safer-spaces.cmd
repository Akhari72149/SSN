@echo off
setlocal
cd /d "%~dp0web"

set "BUNDLED_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
if exist "%BUNDLED_PNPM%" (
  set "PNPM_RUNNER=%BUNDLED_PNPM%"
) else (
  where pnpm >nul 2>nul
  if errorlevel 1 (
    echo.
    echo Safer Spaces needs pnpm. Install Node.js and run: npm install -g pnpm
    echo.
    pause
    exit /b 1
  )
  set "PNPM_RUNNER=pnpm"
)

if not exist ".env.local" (
  copy /y ".env.example" ".env.local" >nul
  echo Created web\.env.local with development-only settings.
)

if not exist "node_modules\.bin\vinext.cmd" (
  echo Installing application dependencies...
  call "%PNPM_RUNNER%" install
  if errorlevel 1 goto :failed
)

echo.
echo Starting the Safer Spaces synthetic prototype...
echo Open http://localhost:3000 if the browser does not open automatically.
echo Press Ctrl+C in this window to stop it.
echo.
call "%PNPM_RUNNER%" run dev
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo The preview could not start. Review the message above, then try again.
pause
exit /b 1
