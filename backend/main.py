import asyncio
import json
import os
import re
import subprocess
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI
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


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, env=ENV, timeout=30)
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


def parse_openclaw_table(output: str) -> list[dict]:
    """Parse openclaw cron list table output into JSON."""
    agents = []
    lines = [l for l in output.splitlines() if l.strip()]
    # Find header line
    header_idx = None
    for i, line in enumerate(lines):
        if re.search(r"name|id|schedule|status", line, re.IGNORECASE):
            header_idx = i
            break
    if header_idx is None:
        return agents
    header_line = lines[header_idx]
    # Try to find column positions from separator or header
    sep_idx = None
    for i in range(header_idx + 1, len(lines)):
        if re.match(r"[-+| ]+$", lines[i]):
            sep_idx = i
            break
    data_start = (sep_idx + 1) if sep_idx is not None else header_idx + 1
    # Parse headers by splitting on 2+ spaces or |
    if "|" in header_line:
        headers = [h.strip() for h in header_line.split("|") if h.strip()]
        for line in lines[data_start:]:
            if re.match(r"[-+| ]+$", line):
                continue
            cols = [c.strip() for c in line.split("|") if c.strip()]
            if cols:
                agents.append(dict(zip(headers, cols)))
    else:
        headers = re.split(r"\s{2,}", header_line.strip())
        for line in lines[data_start:]:
            cols = re.split(r"\s{2,}", line.strip())
            if cols:
                agents.append(dict(zip(headers, cols)))
    return agents


@app.get("/api/agents")
async def get_agents():
    try:
        output = await asyncio.to_thread(run, ["openclaw", "cron", "list"])
        agents = parse_openclaw_table(output)
        return {"agents": agents, "total": len(agents), "raw": output}
    except FileNotFoundError:
        return {
            "agents": [],
            "total": 0,
            "error": "openclaw not found in PATH",
            "raw": "",
        }
    except Exception as e:
        return {"agents": [], "total": 0, "error": str(e), "raw": ""}


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


@app.get("/api/overview")
async def get_overview():
    # Run all fetches concurrently
    products_task = asyncio.create_task(_get_products_count())
    articles_task = asyncio.create_task(_get_articles_count())
    agents_task = asyncio.create_task(_get_agents_count())

    products_count, articles_count, agents_count = await asyncio.gather(
        products_task, articles_task, agents_task
    )

    return {
        "stats": {
            "total_repos": products_count,
            "total_articles": articles_count,
            "total_agents": agents_count,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
    }


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
        output = await asyncio.to_thread(run, ["openclaw", "cron", "list"])
        return len(parse_openclaw_table(output))
    except Exception:
        return 0


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8521, reload=True)
