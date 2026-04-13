@echo off
REM Compari Setup Script for Windows

echo ========================================
echo Installing Compari...
echo ========================================

REM Install backend dependencies
echo.
echo [1/3] Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo ERROR: Backend installation failed!
    cd ..
    pause
    exit /b 1
)
cd ..

REM Install frontend dependencies and build
echo.
echo [2/3] Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo ERROR: Frontend installation failed!
    cd ..
    pause
    exit /b 1
)

echo.
echo [3/3] Building frontend for production...
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo Setup complete! 
echo Run 'start.bat' to launch Compari.
echo ========================================
pause