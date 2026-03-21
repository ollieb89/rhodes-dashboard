"""
Tests for SQLite history snapshots.

/api/overview should save a snapshot on each call.
/api/history returns last N days of snapshots.
"""
import json
import sqlite3
import tempfile
import os
import pytest
import httpx
from unittest.mock import patch, AsyncMock

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app


@pytest.fixture
def tmp_db(tmp_path):
    """Override the DB path to a temp file for each test."""
    db_file = str(tmp_path / "history_test.db")
    with patch("main.DB_PATH", db_file):
        yield db_file


@pytest.fixture
async def client(tmp_db):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Snapshot saved on /api/overview
# ---------------------------------------------------------------------------

class TestOverviewSavesSnapshot:
    async def test_snapshot_row_written_to_db(self, client, tmp_db):
        with (
            patch("main._get_products_count", new_callable=AsyncMock, return_value=5),
            patch("main._get_articles_count", new_callable=AsyncMock, return_value=10),
            patch("main._get_agents_count", new_callable=AsyncMock, return_value=3),
        ):
            await client.get("/api/overview")

        conn = sqlite3.connect(tmp_db)
        rows = conn.execute("SELECT * FROM history_snapshots").fetchall()
        conn.close()

        assert len(rows) == 1

    async def test_snapshot_contains_correct_values(self, client, tmp_db):
        with (
            patch("main._get_products_count", new_callable=AsyncMock, return_value=7),
            patch("main._get_articles_count", new_callable=AsyncMock, return_value=12),
            patch("main._get_agents_count", new_callable=AsyncMock, return_value=4),
        ):
            await client.get("/api/overview")

        conn = sqlite3.connect(tmp_db)
        row = conn.execute(
            "SELECT total_repos, total_articles, total_agents FROM history_snapshots"
        ).fetchone()
        conn.close()

        assert row == (7, 12, 4)

    async def test_snapshot_includes_total_stars(self, client, tmp_db):
        with (
            patch("main._get_products_count", new_callable=AsyncMock, return_value=3),
            patch("main._get_articles_count", new_callable=AsyncMock, return_value=2),
            patch("main._get_agents_count", new_callable=AsyncMock, return_value=1),
            patch("main._get_total_stars", new_callable=AsyncMock, return_value=42),
        ):
            await client.get("/api/overview")

        conn = sqlite3.connect(tmp_db)
        row = conn.execute("SELECT total_stars FROM history_snapshots").fetchone()
        conn.close()

        assert row[0] == 42

    async def test_multiple_calls_accumulate_rows(self, client, tmp_db):
        for _ in range(3):
            with (
                patch("main._get_products_count", new_callable=AsyncMock, return_value=1),
                patch("main._get_articles_count", new_callable=AsyncMock, return_value=1),
                patch("main._get_agents_count", new_callable=AsyncMock, return_value=1),
            ):
                await client.get("/api/overview")

        conn = sqlite3.connect(tmp_db)
        count = conn.execute("SELECT COUNT(*) FROM history_snapshots").fetchone()[0]
        conn.close()

        assert count == 3


# ---------------------------------------------------------------------------
# GET /api/history
# ---------------------------------------------------------------------------

class TestHistoryEndpoint:
    async def test_returns_200(self, client, tmp_db):
        response = await client.get("/api/history")
        assert response.status_code == 200

    async def test_returns_list(self, client, tmp_db):
        response = await client.get("/api/history")
        data = response.json()
        assert isinstance(data, list)

    async def test_returns_snapshot_fields(self, client, tmp_db):
        # Insert a snapshot directly
        conn = sqlite3.connect(tmp_db)
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
        conn.execute(
            "INSERT INTO history_snapshots (timestamp, total_repos, total_stars, total_articles, total_agents) VALUES (?, ?, ?, ?, ?)",
            ("2026-03-21T10:00:00+00:00", 5, 100, 3, 2),
        )
        conn.commit()
        conn.close()

        response = await client.get("/api/history")
        data = response.json()

        assert len(data) == 1
        snapshot = data[0]
        assert "timestamp" in snapshot
        assert "total_repos" in snapshot
        assert "total_stars" in snapshot
        assert "total_articles" in snapshot
        assert "total_agents" in snapshot

    async def test_default_days_filters_old_rows(self, client, tmp_db):
        """Rows older than 7 days (default) are excluded."""
        conn = sqlite3.connect(tmp_db)
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
        # Old row (30 days ago)
        conn.execute(
            "INSERT INTO history_snapshots (timestamp, total_repos, total_stars, total_articles, total_agents) VALUES (?, ?, ?, ?, ?)",
            ("2026-01-01T00:00:00+00:00", 1, 10, 1, 1),
        )
        # Recent row
        conn.execute(
            "INSERT INTO history_snapshots (timestamp, total_repos, total_stars, total_articles, total_agents) VALUES (?, ?, ?, ?, ?)",
            ("2026-03-20T00:00:00+00:00", 2, 20, 2, 2),
        )
        conn.commit()
        conn.close()

        response = await client.get("/api/history")
        data = response.json()

        assert len(data) == 1
        assert data[0]["total_repos"] == 2

    async def test_custom_days_param(self, client, tmp_db):
        """?days=30 returns rows within 30 days."""
        conn = sqlite3.connect(tmp_db)
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
        conn.execute(
            "INSERT INTO history_snapshots (timestamp, total_repos, total_stars, total_articles, total_agents) VALUES (?, ?, ?, ?, ?)",
            ("2026-03-01T00:00:00+00:00", 5, 50, 5, 5),
        )
        conn.commit()
        conn.close()

        response = await client.get("/api/history?days=30")
        data = response.json()

        assert len(data) == 1
