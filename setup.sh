#!/bin/bash
# Compari Setup Script for Unix/Mac

echo "========================================"
echo "Installing Compari..."
echo "========================================"

# Install backend dependencies
echo ""
echo "[1/3] Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Backend installation failed!"
    cd ..
    exit 1
fi
cd ..

# Install frontend dependencies and build
echo ""
echo "[2/3] Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Frontend installation failed!"
    cd ..
    exit 1
fi

echo ""
echo "[3/3] Building frontend for production..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Frontend build failed!"
    cd ..
    exit 1
fi
cd ..

echo ""
echo "========================================"
echo "Setup complete!"
echo "Run './start.sh' to launch Compari."
echo "========================================"