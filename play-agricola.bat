@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies - this only happens once...
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed - see errors above.
        pause
        exit /b 1
    )
)

REM Rebuild whenever the code has changed since the last build (tracked by commit hash),
REM or if there is no build yet. This ensures updates actually take effect.
set "CURRENT="
for /f "delims=" %%i in ('git rev-parse HEAD 2^>nul') do set "CURRENT=%%i"
set "LAST="
if exist ".last-build" set /p LAST=<".last-build"

set "NEEDBUILD="
if not exist "packages\client\dist\index.html" set "NEEDBUILD=1"
if not "%CURRENT%"=="%LAST%" set "NEEDBUILD=1"

if defined NEEDBUILD (
    echo Building Agricola - this happens the first time and after each update...
    call npm run build
    if errorlevel 1 (
        echo.
        echo Build failed - see errors above.
        pause
        exit /b 1
    )
    if defined CURRENT (>".last-build" echo %CURRENT%)
)

echo.
echo Starting Agricola...
echo Family members on your WiFi can join using the address or QR code below.
echo Close this window to stop the game.
echo.

start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
call npm start

echo.
echo Server stopped.
pause
