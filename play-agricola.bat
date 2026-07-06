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

if not exist "packages\client\dist\index.html" (
    echo Building Agricola - this only happens once, or after you pull updates...
    call npm run build
    if errorlevel 1 (
        echo.
        echo Build failed - see errors above.
        pause
        exit /b 1
    )
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
