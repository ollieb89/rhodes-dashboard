import asyncio
import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Rhodes Command Center API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3489"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Optional API key protection ──────────────────────────────────────────────

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    api_key = os.environ.get("DASHBOARD_API_KEY", "")
    if not api_key:
        # No key configured — open access
        return await call_next(request)
    # Skip health endpoint
    if request.url.path in ("/health", "/api/health", "/"):
        return await call_next(request)
    # Only protect /api/* routes
    if request.url.path.startswith("/api/"):
        provided = request.headers.get("x-dashboard-key", "")
        if provided != api_key:
            return JSONResponse(
                status_code=401,
                content={"ok": False, "error": "unauthorized"},
            )
    return await call_next(request)



NODE_BIN = os.path.expanduser("~/.nvm/versions/node/v22.21.1/bin")
ENV = {**os.environ, "PATH": f"{NODE_BIN}:{os.environ.get('PATH', '')}"}

DB_PATH = os.path.join(os.path.dirname(__file__), "history.db")


# ─── DASH-028: TTL Cache ──────────────────────────────────────────────────────

class TTLCache:
    """Simple thread-safe in-memory TTL cache. No external deps."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[object, float]] = {}
        self._lock = __import__("threading").Lock()

    def get(self, key: str) -> object | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.time() > expires_at:
                del self._store[key]
                return None
            print(f"[cache] HIT {key}", flush=True)
            return value

    def set(self, key: str, value: object, ttl_seconds: float) -> None:
        with self._lock:
            self._store[key] = (value, time.time() + ttl_seconds)

    def status(self) -> list[dict]:
        now = time.time()
        with self._lock:
            result = []
            expired = [k for k, (_, exp) in self._store.items() if now > exp]
            for k in expired:
                del self._store[k]
            for key, (_, expires_at) in self._store.items():
                result.append({"key": key, "expires_in_s": round(expires_at - now, 1)})
        return sorted(result, key=lambda x: x["key"])


_cache = TTLCache()


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
    cached = _cache.get("/api/products")
    if cached is not None:
        return cached
    try:
        output = await asyncio.to_thread(
            run,
            [
                "gh",
                "repo",
                "list",
                "ollieb89",
                "--json",
                "name,description,stargazerCount,forkCount,createdAt,pushedAt,url,primaryLanguage",
                "-L",
                "50",
            ],
        )
        repos = json.loads(output) if output else []
        result = {"repos": repos, "total": len(repos)}
        _cache.set("/api/products", result, 120)
        return result
    except Exception as e:
        return {"repos": [], "total": 0, "error": str(e)}


@app.get("/api/articles")
async def get_articles():
    cached = _cache.get("/api/articles")
    if cached is not None:
        return cached
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
        result = {"articles": articles, "total": len(articles)}
        _cache.set("/api/articles", result, 120)
        return result
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
    cached = _cache.get("/api/metrics")
    if cached is not None:
        return cached
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

    result = {
        "total_stars": total_stars,
        "total_forks": total_forks,
        "total_repos": len(repos),
        "total_articles": len(articles),
        "total_article_views": total_article_views,
        "total_article_reactions": total_article_reactions,
        "top_repo": top_repo,
        "top_article": top_article,
    }
    _cache.set("/api/metrics", result, 60)
    return result


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



@app.get("/api/cache/status")
async def cache_status():
    """Return current live cache keys and their remaining TTL."""
    return {"keys": _cache.status()}

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

# _ci_cache replaced by TTLCache in DASH-028


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
    cached = _cache.get("/api/ci")
    if cached is not None:
        return cached

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
    _cache.set("/api/ci", data, 60)
    return data


# ─── DASH-023: Events / notifications ────────────────────────────────────────

EVENTS_SOURCES = [
    os.path.expanduser("~/.openclaw/logs/config-audit.jsonl"),
]
CRON_RUNS_DIR_EVENTS = os.path.expanduser("~/.openclaw/cron/runs")


def _load_events(limit: int = 20) -> list[dict]:
    """Aggregate events from config-audit + cron run completions."""
    events = []

    # 1. Config-audit events
    for fpath in EVENTS_SOURCES:
        if not os.path.isfile(fpath):
            continue
        try:
            with open(fpath) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        ts_str = entry.get("ts", "")
                        try:
                            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp() * 1000
                        except Exception:
                            ts = 0
                        events.append({
                            "id": f"cfg-{int(ts)}-{entry.get('event','')}",
                            "timestamp": ts_str or "",
                            "type": "config",
                            "text": entry.get("event", "config.change"),
                            "level": "info",
                        })
                    except json.JSONDecodeError:
                        pass
        except OSError:
            pass

    # 2. Cron run completions (status=ok or error)
    if os.path.isdir(CRON_RUNS_DIR_EVENTS):
        for fpath in glob.glob(os.path.join(CRON_RUNS_DIR_EVENTS, "*.jsonl")):
            try:
                with open(fpath) as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            entry = json.loads(line)
                            if entry.get("action") != "finished":
                                continue
                            ts_ms = entry.get("ts", 0)
                            ts_str = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat()
                            status = entry.get("status", "")
                            error = entry.get("error", "")
                            summary = entry.get("summary", "")
                            job_id = entry.get("jobId", "")[:8]
                            level = "error" if status == "error" else "info"
                            text = f"cron/{job_id}: {error}" if error else f"cron/{job_id}: {summary[:80]}" if summary else f"cron/{job_id}: finished ok"
                            events.append({
                                "id": f"cron-{ts_ms}-{job_id}",
                                "timestamp": ts_str,
                                "type": "cron",
                                "text": text,
                                "level": level,
                            })
                        except json.JSONDecodeError:
                            pass
            except OSError:
                pass

    # Sort descending by timestamp string (ISO sortable), return latest N
    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return events[:limit]


@app.get("/api/events")
async def get_events(limit: int = Query(default=20, le=100)):
    events = await asyncio.to_thread(_load_events, limit)
    return {"events": events}


@app.post("/api/events/clear")
async def clear_events():
    """Truncates the config-audit log (soft clear — events will re-accumulate)."""
    cleared = []
    for fpath in EVENTS_SOURCES:
        if os.path.isfile(fpath):
            try:
                with open(fpath, "w") as f:
                    pass  # truncate
                cleared.append(fpath)
            except OSError as e:
                return {"ok": False, "error": str(e)}
    return {"ok": True, "cleared": cleared}


# ─── DASH-027: GitHub profile ─────────────────────────────────────────────────

@app.get("/api/github/profile")
async def get_github_profile():
    """Return GitHub user profile via gh CLI."""
    cached = _cache.get("/api/github/profile")
    if cached is not None:
        return cached
    try:
        output = await asyncio.to_thread(run, ["gh", "api", "/user"])
        data = json.loads(output) if output else {}
        result = {
            "login": data.get("login", ""),
            "name": data.get("name", ""),
            "avatar_url": data.get("avatar_url", ""),
            "public_repos": data.get("public_repos", 0),
            "followers": data.get("followers", 0),
            "following": data.get("following", 0),
            "bio": data.get("bio") or "",
            "company": data.get("company") or "",
            "location": data.get("location") or "",
        }
        _cache.set("/api/github/profile", result, 300)
        return result
    except Exception as e:
        return {
            "login": "", "name": "", "avatar_url": "",
            "public_repos": 0, "followers": 0, "following": 0,
            "bio": "", "company": "", "location": "",
            "error": str(e),
        }


# ─── DASH-030: Repo README preview ───────────────────────────────────────────

@app.get("/api/products/{repo}/readme")
async def get_repo_readme(repo: str):
    """Return base64-decoded README content for a repo, truncated to 2000 chars."""
    cache_key = f"/api/products/{repo}/readme"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached
    try:
        output = await asyncio.to_thread(
            run, ["gh", "api", f"/repos/ollieb89/{repo}/readme"]
        )
        data = json.loads(output) if output else {}
        raw_b64 = data.get("content", "")
        # GitHub API returns content with newlines in the base64 string
        import base64
        decoded = base64.b64decode(raw_b64.replace("\n", "").replace(" ", "")).decode("utf-8", errors="replace")
        truncated = decoded[:2000]
        result = {"content": truncated}
        _cache.set(cache_key, result, 300)
        return result
    except Exception as e:
        return {"content": "", "error": str(e)}


# ─── DASH-031: Agent details ──────────────────────────────────────────────────

@app.get("/api/crons/{id}/details")
async def get_cron_details(id: str):
    """Return rich metadata for a single cron job including recent run history."""
    try:
        output = await asyncio.to_thread(run, ["openclaw", "cron", "list", "--json"])
        data = json.loads(output)
        jobs = data.get("jobs", [])
        job = next((j for j in jobs if j.get("id") == id), None)
        if not job:
            return {"error": f"Agent {id} not found"}

        state = job.get("state", {})
        status = state.get("lastRunStatus", "unknown")
        if state.get("runningAtMs"):
            status = "running"
        elif not job.get("enabled"):
            status = "paused"

        def ms_to_iso(ms):
            if not ms:
                return None
            return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()

        # Load recent run history from JSONL
        runs_dir = os.path.expanduser("~/.openclaw/cron/runs")
        run_file = os.path.join(runs_dir, f"{id}.jsonl")
        recent_runs = []
        if os.path.isfile(run_file):
            try:
                lines = open(run_file).readlines()
                for line in reversed(lines[-20:]):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        recent_runs.append({
                            "ts": ms_to_iso(entry.get("ts", 0)),
                            "status": entry.get("status", ""),
                            "action": entry.get("action", ""),
                            "duration_ms": entry.get("durationMs"),
                            "error": entry.get("error", ""),
                            "summary": (entry.get("summary") or "")[:300],
                            "model": entry.get("model", ""),
                        })
                    except json.JSONDecodeError:
                        pass
            except OSError:
                pass

        return {
            "id": id,
            "name": job.get("name", ""),
            "schedule": job.get("schedule", {}).get("expr", "manual"),
            "status": status,
            "last_run": ms_to_iso(state.get("lastRunAtMs")),
            "next_run": ms_to_iso(state.get("nextRunAtMs")),
            "enabled": job.get("enabled", True),
            "agent_id": job.get("agentId", ""),
            "description": (job.get("payload") or {}).get("message", "")[:200],
            "model": (job.get("payload") or {}).get("model", ""),
            "delivery_channel": (job.get("delivery") or {}).get("channel", ""),
            "recent_runs": recent_runs,
            "raw": job,
        }
    except FileNotFoundError:
        return {"error": "openclaw not found in PATH"}
    except Exception as e:
        return {"error": str(e)}


# ─── DASH-032: Activity feed ──────────────────────────────────────────────────

@app.get("/api/activity")
async def get_activity(limit: int = Query(default=20, le=50)):
    """Unified activity feed: cron events + article publishes + repo updates."""
    items = []
    now_ts = datetime.now(tz=timezone.utc).timestamp() * 1000

    # 1. Cron run events from JSONL files
    if os.path.isdir(CRON_RUNS_DIR):
        for fpath in glob.glob(os.path.join(CRON_RUNS_DIR, "*.jsonl")):
            try:
                lines = open(fpath).readlines()
                for line in reversed(lines[-10:]):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        e = json.loads(line)
                        if e.get("action") != "finished":
                            continue
                        ts_ms = e.get("ts", 0)
                        job_id = e.get("jobId", "")[:8]
                        status = e.get("status", "")
                        summary = (e.get("summary") or "")[:80]
                        error = e.get("error", "")
                        text = error if error else summary if summary else f"cron/{job_id} finished"
                        items.append({
                            "id": f"cron-{ts_ms}-{job_id}",
                            "type": "cron",
                            "title": f"cron/{job_id}",
                            "text": text,
                            "timestamp": datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat(),
                            "level": "error" if status == "error" else "ok",
                            "url": None,
                        })
                    except json.JSONDecodeError:
                        pass
            except OSError:
                pass

    # 2. Article publishes
    try:
        art_data = await get_articles()
        for a in (art_data.get("articles") or [])[:10]:
            pub = a.get("published_at") or a.get("created_at") or ""
            if not pub:
                continue
            items.append({
                "id": f"article-{a.get('id', '')}",
                "type": "article",
                "title": a.get("title", "Article"),
                "text": a.get("description") or "",
                "timestamp": pub,
                "level": "ok",
                "url": a.get("url"),
            })
    except Exception:
        pass

    # 3. Repo creations/updates
    try:
        prod_data = await get_products()
        for r in (prod_data.get("repos") or [])[:10]:
            ts = r.get("pushedAt") or r.get("updatedAt") or r.get("createdAt") or ""
            if not ts:
                continue
            items.append({
                "id": f"repo-{r.get('name', '')}",
                "type": "repo",
                "title": r.get("name", "repo"),
                "text": r.get("description") or "",
                "timestamp": ts,
                "level": "ok",
                "url": r.get("url"),
            })
    except Exception:
        pass

    # Sort newest first, deduplicate, limit
    items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    seen = set()
    unique = []
    for item in items:
        if item["id"] not in seen:
            seen.add(item["id"])
            unique.append(item)
    return {"items": unique[:limit]}


# ─── DASH-033: Incidents ──────────────────────────────────────────────────────

@app.get("/api/incidents")
async def get_incidents():
    """Surface failures and warnings from cron agents and CI runs."""
    incidents = []

    # 1. Failed/paused cron agents
    try:
        agents_data = await get_agents()
        for agent in agents_data.get("agents", []):
            status = (agent.get("status") or "").lower()
            name = agent.get("name") or agent.get("id", "")
            agent_id = agent.get("id", "")
            if status == "error":
                incidents.append({
                    "id": f"cron-error-{agent_id}",
                    "source": "cron",
                    "severity": "critical",
                    "title": f"Cron job failed: {name}",
                    "text": f"Agent {name} last run ended with error status.",
                    "timestamp": agent.get("last_run"),
                    "url": None,
                })
            elif status == "paused":
                incidents.append({
                    "id": f"cron-paused-{agent_id}",
                    "source": "cron",
                    "severity": "warning",
                    "title": f"Cron job paused: {name}",
                    "text": f"Agent {name} is currently disabled.",
                    "timestamp": agent.get("last_run"),
                    "url": None,
                })
    except Exception:
        pass

    # 2. Failed CI runs
    try:
        ci_data = await get_ci()
        for repo_name, run in ci_data.get("runs", {}).items():
            conclusion = (run.get("conclusion") or "").lower()
            status = (run.get("status") or "").lower()
            if conclusion == "failure":
                incidents.append({
                    "id": f"ci-fail-{repo_name}",
                    "source": "ci",
                    "severity": "critical",
                    "title": f"CI failing: {repo_name}",
                    "text": f"Latest run '{run.get('name', '')}' on {run.get('branch', 'unknown')} failed.",
                    "timestamp": None,
                    "url": run.get("url"),
                })
            elif conclusion == "cancelled":
                incidents.append({
                    "id": f"ci-cancel-{repo_name}",
                    "source": "ci",
                    "severity": "warning",
                    "title": f"CI cancelled: {repo_name}",
                    "text": f"Latest run on {run.get('branch', 'unknown')} was cancelled.",
                    "timestamp": None,
                    "url": run.get("url"),
                })
    except Exception:
        pass

    # 3. Recent cron error runs from JSONL
    try:
        if os.path.isdir(CRON_RUNS_DIR):
            job_errors: dict[str, dict] = {}
            for fpath in glob.glob(os.path.join(CRON_RUNS_DIR, "*.jsonl")):
                try:
                    lines = open(fpath).readlines()
                    for line in reversed(lines[-5:]):
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            e = json.loads(line)
                            if e.get("action") == "finished" and e.get("status") == "error":
                                job_id = e.get("jobId", "")
                                if job_id not in job_errors:
                                    job_errors[job_id] = e
                        except json.JSONDecodeError:
                            pass
                except OSError:
                    pass
            for job_id, entry in job_errors.items():
                short_id = job_id[:8]
                err = entry.get("error", "")
                ts_ms = entry.get("ts", 0)
                ts_iso = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat() if ts_ms else None
                iid = f"cron-run-err-{job_id}"
                # Skip if already added from agents list
                if not any(i["id"] == f"cron-error-{job_id}" for i in incidents):
                    incidents.append({
                        "id": iid,
                        "source": "cron",
                        "severity": "critical",
                        "title": f"Run error: {short_id}",
                        "text": err or "Job execution failed",
                        "timestamp": ts_iso,
                        "url": None,
                    })
    except Exception:
        pass

    # Sort: critical first, then by timestamp desc
    def sort_key(i):
        sev = {"critical": 0, "warning": 1, "info": 2}.get(i.get("severity", "info"), 2)
        ts = i.get("timestamp") or ""
        return (sev, "" if not ts else ts)

    incidents.sort(key=lambda i: ({"critical": 0, "warning": 1, "info": 2}.get(i.get("severity", "info"), 2), -(0 if not i.get("timestamp") else int(datetime.fromisoformat(i["timestamp"].replace("Z", "+00:00")).timestamp() * 1000 if i.get("timestamp") else 0))))

    counts = {
        "critical": sum(1 for i in incidents if i.get("severity") == "critical"),
        "warning": sum(1 for i in incidents if i.get("severity") == "warning"),
        "info": sum(1 for i in incidents if i.get("severity") == "info"),
        "total": len(incidents),
    }

    return {"incidents": incidents, "counts": counts}
