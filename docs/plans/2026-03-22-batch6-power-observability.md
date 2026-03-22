# Batch 6: Power & Observability — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement task-by-task.

**Goal:** CI/CD, agent timeline, SLA tracking, stat deltas, alerting, async fix, heatmap, webhooks, dep graph, drag-drop layout, gh CLI replacement.

**Architecture:** 3 waves ordered by dependency. Wave 1 fully parallel. Wave 2 needs Wave 1 backend. Wave 3 needs Wave 2.

**Tech Stack:** FastAPI / Next.js 16 / React 19 / Recharts / shadcn/ui / SQLite / Tailwind 4 / GitHub Actions

---

## Execution Waves

| Wave | Tasks | Constraint |
|------|-------|------------|
| 1 | DASH-041, 044, 046, 042, 051 | Fully parallel |
| 2 | DASH-043, 045, 047 | Needs Wave 1 backend |
| 3 | DASH-048, 049, 050 | Needs Wave 2 |

---

## Wave 1 Tasks

### DASH-046 — asyncio.gather in /api/overview
- File: `backend/main.py`
- Find the /api/overview handler. Replace sequential awaits with asyncio.gather():
  `products, articles, agents = await asyncio.gather(_fetch_products(), _fetch_articles(), _fetch_agents(), return_exceptions=True)`
- Handle Exception instances gracefully (fall back to [])
- Verify: `python -c "from main import app; print('OK')"`
- Commit: `perf: parallelize /api/overview with asyncio.gather (DASH-046)`

### DASH-044 — Stat card week-over-week deltas
- File: `frontend/app/page.tsx`
- Fetch `/api/history?days=14` alongside overview data
- Compute delta: find snapshot ~7 days ago, diff against current
- Render below each stat: `⬆ +12 this week (+3.4%)` in green, `⬇ -3 this week` in red
- Graceful no-op when <7 days history
- Build check: `npm run build`
- Commit: `feat: add period-over-period deltas to stat cards (DASH-044)`

### DASH-041 — GitHub Actions CI pipeline
- File: `.github/workflows/ci.yml`
- Two jobs: frontend (node 22, tsc --noEmit + npm run build) and backend (python 3.12, pytest tests/)
- Both trigger on push/PR to main
- Verify YAML valid: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
- Commit: `ci: add GitHub Actions pipeline (DASH-041)`

### DASH-042 — Agent execution timeline
- Files: `backend/main.py`, `frontend/app/agents/page.tsx`
- Backend: `GET /api/crons/runs/timeline?hours=24`
  - Parse JSONL from `~/.openclaw/cron/runs/`
  - Return `{ runs: [{ id, name, started_at, ended_at, status }] }`
  - Filter by cutoff = now - hours, sort by started_at
- Frontend: Add Recharts BarChart with layout="vertical" above agent table
  - X = time axis, Y = agent name, bars colored green/red/amber by status
  - Time range toggle: 6h / 24h / 7d
  - Empty state when no runs found
- Build check + commit: `feat: add agent execution timeline (DASH-042)`

### DASH-051 — Replace gh CLI with GitHub REST API
- File: `backend/main.py`
- Add async helper:
  ```python
  async def github_api(path, client=None):
      token = os.environ.get("GITHUB_TOKEN") or subprocess.run(["gh","auth","token"], ...).stdout.strip()
      headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
      resp = await client.get(f"https://api.github.com{path}", headers=headers, timeout=15)
      resp.raise_for_status()
      return resp.json()
  ```
- Replace all `subprocess.run(["gh", "repo", ...])` with `await github_api(...)`
- Replace `gh api /user` with `await github_api("/user")`
- Replace `gh run list` with `await github_api(f"/repos/ollieb89/{repo}/actions/runs?per_page=1")`
- Replace `gh api /repos/.../readme` with `await github_api(f"/repos/ollieb89/{repo}/readme")`
- Test: curl /api/products, /api/github/profile, /api/ci all return data
- Commit: `refactor: replace gh CLI with GitHub REST API (DASH-051)`

---

## Wave 2 Tasks

### DASH-043 — SLA/uptime per agent
- Files: `backend/main.py`, `frontend/app/agents/page.tsx`, `frontend/components/agent-drawer.tsx`
- Backend: `GET /api/crons/{id}/stats`
  - Parse JSONL run history for this agent
  - Return: `{ success_rate_7d, success_rate_30d, total_runs, failed_runs, avg_duration_s, last_success, last_failure }`
- Frontend: Add "Reliability" column to agent table
  - Badge: green ≥95%, amber 80-95%, red <80%
- Drawer: Show full stats breakdown
- Commit: `feat: SLA/uptime tracking per agent (DASH-043)`

### DASH-045 — Configurable alerting rules
- Files: `backend/main.py`, `frontend/app/settings/page.tsx`
- Backend: Add SQLite table `alert_rules(id, metric, operator, threshold, window_minutes, notify_channel)`
- Endpoints: GET/POST /api/alerts/rules, DELETE /api/alerts/rules/{id}, POST /api/alerts/test
- Evaluation: On /api/overview, check rules and auto-create incidents if triggered
- Frontend: Settings page "Alert Rules" section — list, add form (metric/op/threshold), delete
- Commit: `feat: configurable alerting rules (DASH-045)`

### DASH-047 — Agent run activity heatmap
- Files: `backend/main.py`, `frontend/app/agents/page.tsx`
- Backend: `GET /api/crons/heatmap?days=90`
  - Aggregate run history by date: `{ cells: [{ date, count, success_rate }] }`
- Frontend: GitHub-contribution-style SVG grid
  - 7 rows (days of week), 13 columns (weeks)
  - Cell intensity = run count, hue = success rate (green→red)
  - Tooltip: date, count, success rate
- Commit: `feat: agent run activity heatmap (DASH-047)`

---

## Wave 3 Tasks

### DASH-048 — Webhook delivery
- Files: `backend/main.py`, `frontend/app/settings/page.tsx`
- Backend: SQLite table `webhooks(id, url, events JSON, secret)`
- Endpoints: GET/POST/DELETE /api/webhooks, POST /api/webhooks/{id}/test
- HMAC-SHA256 signing when secret set
- Fire on incident creation
- Frontend: Settings "Webhooks" section — list, add (URL + event multiselect), test, delete
- Commit: `feat: webhook delivery for alerts (DASH-048)`

### DASH-049 — Agent dependency graph
- Files: `frontend/components/agent-graph.tsx`, `frontend/app/agents/page.tsx`
- Install: `npm install reactflow`
- Component: ReactFlow graph with agents as nodes, edges from `~/.openclaw/agent-deps.json` if exists
- Node color = agent status, click = open agent drawer
- Graph/List toggle tab on Agents page
- Falls back gracefully if no dep config
- Commit: `feat: agent dependency graph (DASH-049)`

### DASH-050 — Drag-and-drop overview layout
- Files: `frontend/app/page.tsx`, `frontend/hooks/use-layout.ts`, `frontend/app/settings/page.tsx`
- Install: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- Hook: `useLayout()` — manages card order in localStorage `dashboard-layout`
- Wrap overview cards in DndContext + SortableContext
- Settings: "Reset layout" button
- Commit: `feat: drag-and-drop overview layout (DASH-050)`

---

## Delegation Map

| Agent | Tasks | Files scope |
|-------|-------|-------------|
| **Agent A** | DASH-046 + DASH-051 | `backend/main.py` only |
| **Agent B** | DASH-044 + DASH-041 | `frontend/app/page.tsx` + `.github/` |
| **Agent C** | DASH-042 | `backend/main.py` + `frontend/app/agents/page.tsx` |
| **Agent D** | DASH-043 + DASH-045 | `backend/main.py` + agents + settings + drawer |
| **Agent E** | DASH-047 | `backend/main.py` + `frontend/app/agents/page.tsx` |
| **Agent F** | DASH-048 + DASH-049 + DASH-050 | backend + frontend multi |

**Wave 1 agents run in parallel. Wave 2 starts after Wave 1 is merged. Wave 3 after Wave 2.**

---

## Post-Implementation Checklist

- [ ] All 11 tasks `[x]` in BACKLOG.md
- [ ] `cd frontend && npm run build` passes
- [ ] `cd backend && python -m pytest tests/ -v` passes
- [ ] CI workflow triggers on push
- [ ] All changes pushed to main
