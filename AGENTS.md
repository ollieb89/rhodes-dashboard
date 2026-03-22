# AGENTS.md — Rhodes Dashboard

## Finalization Contract (MANDATORY)

Every executor agent MUST satisfy all of the following before a task is considered complete:

1. Code implemented and correct
2. Build passes: `cd frontend && npm run build` (exit code 0)
3. Backend loads: `cd backend && source .venv/bin/activate && python -c "from main import app"`
4. Commit created: `git add -A && git commit -m "..."`
5. Push to origin: `git push` (exit code 0)
6. Verify: `git log --oneline -1` shows the expected commit

**A task is NOT complete unless the push succeeds.**
If `git push` fails, retry up to 3 times. If still failing, output FAILURE with reason.
Never silently exit with uncommitted work.

---

## Git State Verification (run after every task)

```bash
git status          # must be clean (no modified/untracked source files)
git log --oneline -1  # must show your commit
git diff origin/main  # must be empty after push
```

If `git status` shows modified files after your intended commit: you have NOT finished. Commit them.

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

## Common commands

```bash
export PATH=$HOME/.nvm/versions/node/v22.21.1/bin:$PATH
cd ~/Development/Projects/rhodes-dashboard

# Frontend build check (REQUIRED before commit)
cd frontend && npm run build

# Backend import check (REQUIRED before commit)
cd backend && source .venv/bin/activate && python -c "from main import app; print('OK')"

# Full finalization sequence
git add -A
git status                    # review what you're committing
git commit -m "type: description (DASH-XXX)"
git push
git log --oneline -1          # verify commit is on remote
```
