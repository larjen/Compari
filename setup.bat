@echo off
REM Compari Setup Script for Windows

echo ========================================
echo Installing Compari...
echo ========================================

REM Install all workspace dependencies
echo.
echo [1/2] Installing all dependencies...
call npm run setup
if errorlevel 1 (
    echo ERROR: Installation failed!
    pause
    exit /b 1
)

REM Build the project
echo.
echo [2/2] Building frontend for production...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup complete! 
echo Run 'start.bat' to launch Compari.
echo ========================================
pause