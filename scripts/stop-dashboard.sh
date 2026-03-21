#!/usr/bin/env bash
# Stop Rhodes Command Center processes
echo "-> Stopping backend (port 8521)..."
pkill -f "uvicorn main:app.*8521" 2>/dev/null && echo "   Backend stopped" || echo "   Backend not running"

echo "-> Stopping frontend (port 3489)..."
pkill -f "next.*3489" 2>/dev/null && echo "   Frontend stopped" || echo "   Frontend not running"

echo "   Done."
