import asyncio
import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Rhodes Command Center API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3489"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NODE_BIN = os.path.expanduser("~/.nvm/versions/node/v22.21.1/bin")
ENV = {**os.environ, "PATH": f"{NODE_BIN}:{os.environ.get('PATH', '')}"}

DB_PATH = os.path.join(os.path.dirname(__file__), "history.db")


def _init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            total_repos INTEGER NOT NULL DEFAULT 0,
            total_stars INTEGER NOT NULL DEFAULT 0,
            total_articles INTEGER NOT NULL DEFAULT 0,
            total_agents INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()


def _save_snapshot(total_repos: int, total_stars: int, total_articles: int, total_agents: int) -> None:
    _init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO history_snapshots (timestamp, total_repos, total_stars, total_articles, total_agents) VALUES (?, ?, ?, ?, ?)",
        (datetime.now(timezone.utc).isoformat(), total_repos, total_stars, total_articles, total_agents),
    )
    conn.commit()
    conn.close()


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, env=ENV, timeout=30)
    if result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)
    return result.stdout.strip()


@app.get("/api/products")
async def get_products():
    try:
        output = await asyncio.to_thread(
            run,
            [
                "gh",
                "repo",
                "list",
                "ollieb89",
                "--json",
                "name,description,stargazerCount,forkCount,createdAt,url,primaryLanguage",
                "-L",
                "50",
            ],
        )
        repos = json.loads(output) if output else []
        return {"repos": repos, "total": len(repos)}
    except Exception as e:
        return {"repos": [], "total": 0, "error": str(e)}


@app.get("/api/articles")
async def get_articles():
    api_key = os.environ.get("DEVTO_API_KEY", "")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            headers = {"api-key": api_key} if api_key else {}
            resp = await client.get(
                "https://dev.to/api/articles/me?per_page=30&page=1",
                headers=headers,
            )
            articles = resp.json() if resp.status_code == 200 else []
            if not isinstance(articles, list):
                articles = []
        return {"articles": articles, "total": len(articles)}
    except Exception as e:
        return {"articles": [], "total": 0, "error": str(e)}


@app.get("/api/agents")
async def get_agents():
    try:
        output = await asyncio.to_thread(run, ["openclaw", "cron", "list", "--json"])
        data = json.loads(output)
        jobs = data.get("jobs", [])
        
        normalized = []
        for job in jobs:
            state = job.get("state", {})
            status = state.get("lastRunStatus", "unknown")
            if state.get("runningAtMs"):
                status = "running"
            elif not job.get("enabled"):
                status = "paused"
            
            last_run = None
            if state.get("lastRunAtMs"):
                last_run = datetime.fromtimestamp(state["lastRunAtMs"] / 1000, tz=timezone.utc).isoformat()
            
            next_run = None
            if state.get("nextRunAtMs"):
                next_run = datetime.fromtimestamp(state["nextRunAtMs"] / 1000, tz=timezone.utc).isoformat()

            normalized.append({
                "id": job.get("id"),
                "name": job.get("name"),
                "schedule": job.get("schedule", {}).get("expr", "manual"),
                "status": status,
                "last_run": last_run,
                "next_run": next_run
            })
            
        return {"agents": normalized, "total": len(normalized)}
    except FileNotFoundError:
        return {
            "agents": [],
            "total": 0,
            "error": "openclaw not found in PATH",
        }
    except Exception as e:
        return {"agents": [], "total": 0, "error": str(e)}


@app.post("/api/crons/{id}/run")
async def run_cron(id: str):
    try:
        # We use a short timeout (15s) as per requirement
        output = await asyncio.to_thread(
            run,
            ["openclaw", "cron", "run", id]
        )
        return {"ok": True, "output": output}
    except FileNotFoundError:
        return {"ok": False, "error": "openclaw not found in PATH"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": f"Command failed: {e.stderr or e.stdout}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/crons")
async def get_crons():
    """Same as /api/agents but semantically named for cron management."""
    return await get_agents()


@app.post("/api/crons/{id}/enable")
async def enable_cron(id: str):
    try:
        output = await asyncio.to_thread(run, ["openclaw", "cron", "enable", id])
        return {"ok": True, "output": output}
    except FileNotFoundError:
        return {"ok": False, "error": "openclaw not found in PATH"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": f"Command failed: {e.stderr or e.stdout}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/crons/{id}/disable")
async def disable_cron(id: str):
    try:
        output = await asyncio.to_thread(run, ["openclaw", "cron", "disable", id])
        return {"ok": True, "output": output}
    except FileNotFoundError:
        return {"ok": False, "error": "openclaw not found in PATH"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": f"Command failed: {e.stderr or e.stdout}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/hn")
async def get_hn(query: str = "workflow-guardian"):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://hn.algolia.com/api/v1/search?query={query}&tags=story"
            )
            data = resp.json() if resp.status_code == 200 else {}
        hits = data.get("hits", [])
        return {"posts": hits, "total": data.get("nbHits", 0)}
    except Exception as e:
        return {"posts": [], "total": 0, "error": str(e)}


@app.get("/api/metrics")
async def get_metrics():
    api_key = os.environ.get("DEVTO_API_KEY", "")

    async def fetch_repos():
        try:
            output = await asyncio.to_thread(
                run,
                ["gh", "repo", "list", "ollieb89", "--json", "name,stargazerCount,forkCount,url", "-L", "50"],
            )
            return json.loads(output) if output else []
        except Exception:
            return []

    async def fetch_articles():
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                headers = {"api-key": api_key} if api_key else {}
                resp = await client.get(
                    "https://dev.to/api/articles/me?per_page=30",
                    headers=headers,
                )
                data = resp.json() if resp.status_code == 200 else []
                return data if isinstance(data, list) else []
        except Exception:
            return []

    repos, articles = await asyncio.gather(fetch_repos(), fetch_articles())

    total_stars = sum(r.get("stargazerCount", 0) for r in repos)
    total_forks = sum(r.get("forkCount", 0) for r in repos)
    total_article_views = sum(a.get("page_views_count", 0) for a in articles)
    total_article_reactions = sum(a.get("public_reactions_count", 0) for a in articles)

    top_repo = None
    if repos:
        best = max(repos, key=lambda r: r.get("stargazerCount", 0))
        top_repo = {"name": best.get("name"), "stars": best.get("stargazerCount", 0), "url": best.get("url")}

    top_article = None
    if articles:
        best = max(articles, key=lambda a: a.get("page_views_count", 0))
        top_article = {"title": best.get("title"), "views": best.get("page_views_count", 0), "url": best.get("url")}

    return {
        "total_stars": total_stars,
        "total_forks": total_forks,
        "total_repos": len(repos),
        "total_articles": len(articles),
        "total_article_views": total_article_views,
        "total_article_reactions": total_article_reactions,
        "top_repo": top_repo,
        "top_article": top_article,
    }


@app.get("/api/overview")
async def get_overview():
    products_count, articles_count, agents_count, total_stars = await asyncio.gather(
        _get_products_count(),
        _get_articles_count(),
        _get_agents_count(),
        _get_total_stars(),
    )

    await asyncio.to_thread(
        _save_snapshot, products_count, total_stars, articles_count, agents_count
    )

    return {
        "stats": {
            "total_repos": products_count,
            "total_articles": articles_count,
            "total_agents": agents_count,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
    }


@app.get("/api/history")
async def get_history(days: int = Query(default=7, ge=1)):
    _init_db()
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        """
        SELECT timestamp, total_repos, total_stars, total_articles, total_agents
        FROM history_snapshots
        WHERE timestamp >= datetime('now', ? || ' days')
        ORDER BY timestamp ASC
        """,
        (f"-{days}",),
    ).fetchall()
    conn.close()
    return [
        {
            "timestamp": r[0],
            "total_repos": r[1],
            "total_stars": r[2],
            "total_articles": r[3],
            "total_agents": r[4],
        }
        for r in rows
    ]


async def _get_products_count() -> int:
    try:
        output = await asyncio.to_thread(
            run,
            [
                "gh",
                "repo",
                "list",
                "ollieb89",
                "--json",
                "name",
                "-L",
                "50",
            ],
        )
        return len(json.loads(output)) if output else 0
    except Exception:
        return 0


async def _get_articles_count() -> int:
    api_key = os.environ.get("DEVTO_API_KEY", "")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            headers = {"api-key": api_key} if api_key else {}
            resp = await client.get(
                "https://dev.to/api/articles/me?per_page=1&page=1",
                headers=headers,
            )
            articles = resp.json() if resp.status_code == 200 else []
            return len(articles) if isinstance(articles, list) else 0
    except Exception:
        return 0


async def _get_agents_count() -> int:
    try:
        resp = await get_agents()
        return resp.get("total", 0)
    except Exception:
        return 0


async def _get_total_stars() -> int:
    try:
        output = await asyncio.to_thread(
            run,
            ["gh", "repo", "list", "ollieb89", "--json", "stargazerCount", "-L", "50"],
        )
        repos = json.loads(output) if output else []
        return sum(r.get("stargazerCount", 0) for r in repos)
    except Exception:
        return 0


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8521, reload=True)


# ─── DASH-021: Log streaming ──────────────────────────────────────────────────

import glob
import time
from fastapi.responses import StreamingResponse

CRON_RUNS_DIR = os.path.expanduser("~/.openclaw/cron/runs")


def _format_run_line(entry: dict) -> str:
    """Format a cron run JSONL entry as a human-readable log line."""
    ts = entry.get("ts", 0)
    dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    job_id = entry.get("jobId", "unknown")[:8]
    action = entry.get("action", "?")
    status = entry.get("status", "")
    error = entry.get("error", "")
    summary = entry.get("summary", "")
    duration = entry.get("durationMs")

    parts = [f"[{dt}]", f"[{job_id}]", action.upper()]
    if status:
        parts.append(f"status={status}")
    if duration is not None:
        parts.append(f"duration={duration}ms")
    if error:
        parts.append(f"error={error[:120]}")
    if summary:
        # single-line summary snippet
        parts.append(summary.replace("\n", " ")[:100])

    return " ".join(parts)


def _get_all_run_entries(limit: int = 200) -> list[dict]:
    """Read all cron JSONL run files, return entries sorted by ts desc."""
    if not os.path.isdir(CRON_RUNS_DIR):
        return []
    entries = []
    for fpath in glob.glob(os.path.join(CRON_RUNS_DIR, "*.jsonl")):
        try:
            with open(fpath) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            entries.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
        except OSError:
            pass
    entries.sort(key=lambda e: e.get("ts", 0), reverse=True)
    return entries[:limit]


@app.get("/api/logs/recent")
async def logs_recent(lines: int = Query(default=100, le=500)):
    """Return the last N log lines from all cron run files."""
    entries = await asyncio.to_thread(_get_all_run_entries, lines)
    # Reverse so oldest first (chronological for display)
    entries.reverse()
    log_lines = [_format_run_line(e) for e in entries]
    return {"lines": log_lines}


@app.get("/api/logs/stream")
async def logs_stream():
    """SSE endpoint that streams new cron run log entries in real time."""

    async def event_generator():
        # Track last seen entry timestamps per file
        seen_ts: set[int] = set()
        line_count = 0

        # First: send recent entries (last 50) as historical context
        initial = await asyncio.to_thread(_get_all_run_entries, 50)
        initial.reverse()
        for entry in initial:
            ts = entry.get("ts", 0)
            seen_ts.add(ts)
            line = _format_run_line(entry)
            yield f"data: {line}\n\n"
            line_count += 1

        yield "data: [--- live tail active ---]\n\n"

        # Then poll for new entries
        while line_count < 500:
            await asyncio.sleep(2)
            new_entries = await asyncio.to_thread(_get_all_run_entries, 200)
            new_entries.reverse()
            fresh = [e for e in new_entries if e.get("ts", 0) not in seen_ts]
            for entry in fresh:
                ts = entry.get("ts", 0)
                seen_ts.add(ts)
                line = _format_run_line(entry)
                yield f"data: {line}\n\n"
                line_count += 1
                if line_count >= 500:
                    break

        yield "data: [--- stream cap reached, reconnect to continue ---]\n\n"

    if not os.path.isdir(CRON_RUNS_DIR):
        async def fallback():
            yield "data: [No log source available — ~/.openclaw/cron/runs not found]\n\n"
        return StreamingResponse(
            fallback(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── DASH-022: CI status endpoint ────────────────────────────────────────────

_ci_cache: dict = {"data": None, "expires": 0.0}


async def _fetch_ci_for_repo(repo_name: str) -> tuple[str, dict | None]:
    """Fetch latest CI run for a single repo. Returns (repo_name, run_data|None)."""
    try:
        output = await asyncio.to_thread(
            run,
            [
                "gh", "run", "list",
                "--repo", f"ollieb89/{repo_name}",
                "--json", "status,conclusion,name,headBranch,createdAt,url",
                "--limit", "1",
            ],
        )
        runs = json.loads(output) if output else []
        if runs:
            r = runs[0]
            return repo_name, {
                "status": r.get("status", ""),
                "conclusion": r.get("conclusion", ""),
                "name": r.get("name", ""),
                "branch": r.get("headBranch", ""),
                "url": r.get("url", ""),
            }
    except Exception:
        pass
    return repo_name, None


@app.get("/api/ci")
async def get_ci():
    """Return latest CI run per repo. Cached for 60 s."""
    now = time.time()
    if _ci_cache["data"] is not None and now < _ci_cache["expires"]:
        return _ci_cache["data"]

    # Get repo list
    try:
        output = await asyncio.to_thread(
            run,
            ["gh", "repo", "list", "ollieb89", "--json", "name", "-L", "50"],
        )
        repos = json.loads(output) if output else []
        repo_names = [r["name"] for r in repos]
    except Exception as e:
        return {"runs": {}, "error": str(e)}

    results = await asyncio.gather(
        *[_fetch_ci_for_repo(name) for name in repo_names],
        return_exceptions=True,
    )

    runs: dict = {}
    for result in results:
        if isinstance(result, Exception):
            continue
        repo_name, run_data = result
        if run_data:
            runs[repo_name] = run_data

    data = {"runs": runs}
    _ci_cache["data"] = data
    _ci_cache["expires"] = now + 60.0
    return data
