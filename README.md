# Rhodes Command Center

A local operational dashboard for the Rhodes AI agent system. Shows GitHub repo stats, dev.to article performance, and cron agent health in one dark-themed UI.

```
Frontend  →  http://localhost:3489   (Next.js + shadcn/ui)
Backend   →  http://localhost:8521   (FastAPI + Python)
```

## What it does

| Page | Data source |
|------|-------------|
| Overview | GitHub repos + dev.to articles + openclaw crons |
| Products | GitHub: all repos, sorted by stars |
| Content | dev.to: articles with views/reactions + HN mentions |
| Agents | openclaw: cron job fleet with status |
| Metrics | Aggregated stars, forks, views, reactions |

## Prerequisites

- **Node.js** ≥ 20 (managed via [nvm](https://github.com/nvm-sh/nvm))
- **Python** ≥ 3.11
- **[uv](https://github.com/astral-sh/uv)** — Python package manager (`pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **[gh](https://cli.github.com/)** — GitHub CLI, authenticated (`gh auth login`)
- **openclaw** — AI cron agent runner (optional; agents page degrades gracefully without it)


## Docker / containerized setup

```bash
# 1. Copy and configure env
cp .env.example .env
# Edit .env — add DEVTO_API_KEY at minimum

# 2. Build and start
docker compose up --build

# Frontend: http://localhost:3489
# Backend:  http://localhost:8521
```

### Notes
- `gh` CLI auth is passed via `~/.config/gh` volume mount (read-only)
- `openclaw` data is passed via `~/.openclaw` volume mount (read-only)
- `DASHBOARD_API_KEY` in `.env` enables API key protection on backend
- Frontend is built with `output: "standalone"` for minimal images

## Quick start

```bash
# Clone and run
git clone <repo-url> rhodes-dashboard
cd rhodes-dashboard
./start.sh
```

`start.sh` will:
1. Create a Python venv and install backend dependencies
2. Install frontend node modules if missing
3. Start both servers and print their URLs

Press `Ctrl+C` to stop everything.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEVTO_API_KEY` | Recommended | dev.to API key — without it, only public articles are shown |

Set it before running:
```bash
export DEVTO_API_KEY=your_key_here
./start.sh
```

Or add it to your shell profile (`~/.bashrc`, `~/.zshrc`).

## Project structure

```
rhodes-dashboard/
├── start.sh              # Starts both servers
├── BACKLOG.md            # Prioritised task list for the cron agent
├── backend/
│   ├── main.py           # FastAPI app — all API endpoints
│   └── requirements.txt  # Python dependencies (httpx, fastapi, uvicorn)
└── frontend/
    ├── app/
    │   ├── layout.tsx    # Root layout with sidebar
    │   ├── page.tsx      # Overview page
    │   ├── products/     # GitHub repos
    │   ├── content/      # dev.to articles + HN
    │   ├── agents/       # openclaw cron fleet
    │   └── metrics/      # Aggregated stats
    └── components/
        ├── sidebar.tsx   # Navigation sidebar
        └── stat-card.tsx # Reusable metric card
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/overview` | Summary stats (repos, articles, agents) |
| GET | `/api/products` | GitHub repos for ollieb89 |
| GET | `/api/articles` | dev.to articles |
| GET | `/api/agents` | openclaw cron list |
| GET | `/api/hn?query=<term>` | HN Algolia search |
| GET | `/api/metrics` | Aggregated stars, forks, views *(DASH-004)* |
| GET | `/api/history?days=7` | Historical snapshots *(DASH-008)* |

## Cron agent configuration

The dashboard includes an autonomous cron agent that picks the next task from `BACKLOG.md` and implements it.

**Recommended openclaw settings for the dashboard cron:**

```
model:   anthropic/claude-sonnet-4-20250514
timeout: 600
prompt:  |
  Read BACKLOG.md in /path/to/rhodes-dashboard. Find the first unchecked
  task ([ ]). Implement it exactly as described. Mark it [x] and commit.
  Stop after one task.
```

- Use **600 s timeout** — the default is too short for a full implementation session
- Use **claude-sonnet-4-20250514** — good balance of speed and capability for frontend/backend tasks
- Reference `BACKLOG.md` explicitly in the prompt so the agent always finds the current task list

## Development

Run just the backend:
```bash
cd backend
uv run uvicorn main:app --host 0.0.0.0 --port 8521 --reload
```

Run just the frontend:
```bash
cd frontend
npm run dev -- --port 3489
```
