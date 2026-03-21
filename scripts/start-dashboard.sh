#!/usr/bin/env bash
# Start Rhodes Command Center (backend + frontend)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Node.js via nvm
export PATH="$HOME/.nvm/versions/node/v22.21.1/bin:$PATH"

# Load .env if present
[ -f "$ROOT/.env" ] && set -a && source "$ROOT/.env" && set +a

echo "=== Rhodes Command Center ==="

# Backend
echo "-> Starting backend on :8521"
cd "$ROOT/backend"
[ -d "venv" ] || python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt

PYTHONUNBUFFERED=1 uvicorn main:app --host 0.0.0.0 --port 8521 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

# Frontend
echo "-> Starting frontend on :3489"
cd "$ROOT/frontend"
[ -d "node_modules" ] || npm ci
npm run dev -- --port 3489 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"

# Cleanup
cleanup() {
  echo ""
  echo "-> Stopping..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo "   Stopped."
}
trap cleanup EXIT INT TERM

echo ""
echo "   Frontend: http://localhost:3489"
echo "   Backend:  http://localhost:8521"
echo "   Ctrl+C to stop"
echo ""
wait
