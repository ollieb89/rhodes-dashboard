import asyncio
import base64
import glob
import hmac
import hashlib
import json
import os
import sqlite3
import subprocess
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import AsyncGenerator, Optional

import httpx
import psutil
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sse import sse_manager

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
CRON_RUNS_DIR = os.path.expanduser("~/.openclaw/cron/runs")

# --- TTL Cache ---
class TTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[object, float]] = {}
        self._lock = __import__("threading").Lock()
    def get(self, key: str) -> object | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None: return None
            v, exp = entry
            if time.time() > exp:
                del self._store[key]
                return None
            return v
    def set(self, key: str, value: object, ttl: float) -> None:
        with self._lock: self._store[key] = (value, time.time() + ttl)

_cache = TTLCache()

def _init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS monitored_repos (repo_full_name TEXT PRIMARY KEY, added_at TEXT DEFAULT CURRENT_TIMESTAMP)")
    conn.execute("CREATE TABLE IF NOT EXISTS history_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, total_repos INTEGER, total_stars INTEGER, total_articles INTEGER, total_agents INTEGER)")
    conn.commit()
    conn.close()
_init_db()

@app.get("/api/system/resources")
async def get_system_resources():
    cpu = psutil.cpu_percent()
    ram = psutil.virtual_memory().percent
    disk = psutil.disk_usage('/').percent
    uptime = round(time.time() - psutil.boot_time())
    try: load = os.getloadavg()
    except: load = [0.0, 0.0, 0.0]
    return {"cpu_pct": cpu, "ram_pct": ram, "disk_pct": disk, "uptime_s": uptime, "load_avg": load}

class RepoConfig(BaseModel):
    full_name: str

@app.post("/api/settings/repos")
async def add_monitored_repo(repo: RepoConfig):
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("INSERT INTO monitored_repos (repo_full_name) VALUES (?)", (repo.full_name,))
        conn.commit()
    except sqlite3.IntegrityError: pass
    finally: conn.close()
    return {"ok": True}

@app.delete("/api/settings/repos")
async def remove_monitored_repo(repo: RepoConfig):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM monitored_repos WHERE repo_full_name = ?", (repo.full_name,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/health")
def health(): return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8521)
