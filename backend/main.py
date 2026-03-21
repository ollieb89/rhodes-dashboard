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
                "name,description,stargazerCount,forkCount,createdAt,url",
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
