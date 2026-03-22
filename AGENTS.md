# AGENTS.md — Rhodes Dashboard & OCMC

## Finalization Contract (MANDATORY)

Every executor agent MUST satisfy all of the following before a task is considered complete:

1. Code implemented and correct
2. Build passes: `cd frontend && npm run build` (exit code 0)
3. Backend loads (if applicable): `cd backend && source .venv/bin/activate && python -c "from app.main import app"` or equivalent
4. Commit created on branch (see Branch Policy below)
5. Push to origin
6. **Agent must print the following raw command outputs verbatim** — no paraphrasing, no self-attestation:

```bash
echo "=== COMPLETION PROOF ==="
git rev-parse HEAD
git rev-parse --abbrev-ref HEAD
git status --short
git diff --stat origin/main
echo "========================"
```

Rhodes may validate this output but must NOT replace it with its own execution unless debugging a failure.

---

## Branch Policy

Default flow for all implementation work:
1. Create a branch: `git checkout -b integration/<short-name>` or `feat/<task-id>`
2. Implement
3. Verify (build + backend check)
4. Commit: `git add -A && git commit -m "type: description (TASK-ID)"`
5. Push branch: `git push -u origin <branch-name>`
6. Only merge to main if verification passes:
   ```bash
   git checkout main
   git merge --ff-only <branch-name>
   git push
   ```
7. Print completion proof (see above)

---

## Verification Commands (print output, do not summarize)

```bash
# Frontend build
export PATH=$HOME/.nvm/versions/node/v22.21.1/bin:$PATH
cd frontend && npm run build
# Print: full output including exit code

# Backend check (if applicable)
cd backend && source .venv/bin/activate && python -c "from app.main import app; print('OK')"
# Print: result

# After every commit
git status --short           # must be clean (no M or ?? from this mission)
git diff --stat origin/main  # must be empty after push
git log --oneline -2         # confirm commit is present
```

Do NOT say "build clean" or "no regressions." Print the commands and their actual output.

---

## Completion is invalid if:

- Proof block is missing or agent-summarized instead of raw output
- `git status --short` shows modified tracked files from this mission
- `git diff --stat origin/main` is non-empty after push
- Branch was committed directly to main without verification
- Build output was not printed

---

## Project

### Rhodes Dashboard
- Root: ~/Development/Projects/rhodes-dashboard/
- Frontend: `frontend/` — Next.js (port 3489)
- Backend: `backend/` — FastAPI (port 8521)
- Backlog: BACKLOG.md
- Node PATH: `export PATH=$HOME/.nvm/versions/node/v22.21.1/bin:$PATH`
- Python venv: `cd backend && source .venv/bin/activate`

### OCMC
- Root: ~/Development/Tools/ocmc/
- Frontend: `frontend/` — Next.js
- Backend: `backend/` — FastAPI
- Node PATH: same as above
- Python venv: `cd backend && source .venv/bin/activate`
