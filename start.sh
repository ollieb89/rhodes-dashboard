#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ──────────────────────────────────────────────────────────────────
echo "→ Starting FastAPI backend on :8521"
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  echo "  Creating venv with uv…"
  uv venv --python python3
fi

uv pip install -r requirements.txt -q

export PYTHONUNBUFFERED=1
uv run uvicorn main:app --host 0.0.0.0 --port 8521 --reload &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "→ Starting Next.js frontend on :3489"
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "  Installing node modules…"
  npm install
fi

npm run dev -- --port 3489 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "→ Shutting down…"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo "  Done."
}
trap cleanup EXIT INT TERM

echo ""
echo "  Rhodes Command Center is starting…"
echo "  Frontend → http://localhost:3489"
echo "  Backend  → http://localhost:8521"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

wait
