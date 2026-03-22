# AGENTS.md — Rhodes Dashboard

## Finalization Contract (MANDATORY)

Every executor agent MUST satisfy all of the following before a task is considered complete:

1. Code implemented and correct
2. Build passes: `cd frontend && npm run build` (exit code 0)
3. Backend loads: `cd backend && source .venv/bin/activate && python -c "from main import app"`
4. Commit created: `git add -A && git commit -m "type: description (DASH-XXX)"`
5. Push to origin: `git push` (exit code 0)
   — If rejected: `git pull --rebase && git push`
6. **Completion proof** — output ALL of the following before reporting done:

```bash
git rev-parse HEAD              # commit hash
git branch --show-current       # must be: main
git diff --stat origin/main     # must be: empty
```

**A task is NOT complete unless the diff is empty and the commit hash is on origin/main.**
If any step fails, fix it. Do not silently exit with local-only work.

---

## Git State Verification (run after every task)

```bash
git status                      # must show: nothing to commit, working tree clean
git log --oneline -1            # must show your commit
git diff --stat origin/main     # must be empty after push
```

If `git status` shows modified files: you have NOT finished. Commit them.

---

## Project

- Root: ~/Development/Projects/rhodes-dashboard/
- Frontend: `frontend/` — Next.js (port 3489)
- Backend: `backend/` — FastAPI (port 8521)
- Backlog: BACKLOG.md

## Node.js

Always set PATH before npm commands:
```bash
export PATH=$HOME/.nvm/versions/node/v22.21.1/bin:$PATH
```

## Python venv

Always activate before backend commands:
```bash
cd backend && source .venv/bin/activate
```

## Standard finalization sequence

```bash
export PATH=$HOME/.nvm/versions/node/v22.21.1/bin:$PATH
cd ~/Development/Projects/rhodes-dashboard

# 1. Checks
cd backend && source .venv/bin/activate && python -c "from main import app; print('backend OK')" && cd ..
cd frontend && npm run build && cd ..

# 2. Commit
git add -A
git commit -m "type: description (DASH-XXX)"

# 3. Push (with rebase fallback)
git push || (git pull --rebase && git push)

# 4. Completion proof (REQUIRED OUTPUT)
echo "=== COMPLETION PROOF ==="
git rev-parse HEAD
git branch --show-current
git diff --stat origin/main
echo "========================"
```
