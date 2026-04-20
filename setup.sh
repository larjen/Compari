#!/bin/bash
# Compari Setup Script for Unix/Mac

echo "========================================"
echo "Installing Compari..."
echo "========================================"

# Install all workspace dependencies
echo ""
echo "[1/2] Installing all dependencies..."
npm run setup
if [ $? -ne 0 ]; then
    echo "ERROR: Installation failed!"
    exit 1
fi

# Build the project
echo ""
echo "[2/2] Building frontend for production..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Build failed!"
    exit 1
fi

echo ""
echo "========================================"
echo "Setup complete!"
echo "Run './start.sh' to launch Compari."
echo "========================================"