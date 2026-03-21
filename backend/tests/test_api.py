"""
Backend API tests using httpx.AsyncClient with ASGI transport.
Subprocess and external httpx calls are mocked — no real network or CLI calls.
"""
import json
import pytest
import httpx
from unittest.mock import patch, MagicMock, AsyncMock

import sys
import os

# Ensure the backend directory is on the path so `main` can be imported.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app


@pytest.fixture
async def client():
    """ASGI test client — no real HTTP connections."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

class TestHealth:
    async def test_returns_200(self, client):
        response = await client.get("/health")
        assert response.status_code == 200

    async def test_returns_ok_status(self, client):
        response = await client.get("/health")
        assert response.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# /api/overview
# ---------------------------------------------------------------------------

class TestOverview:
    async def test_returns_expected_shape(self, client):
        with (
            patch("main._get_products_count", new_callable=AsyncMock, return_value=5),
            patch("main._get_articles_count", new_callable=AsyncMock, return_value=10),
            patch("main._get_agents_count", new_callable=AsyncMock, return_value=3),
        ):
            response = await client.get("/api/overview")

        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        stats = data["stats"]
        assert isinstance(stats["total_repos"], int)
        assert isinstance(stats["total_articles"], int)
        assert isinstance(stats["total_agents"], int)

    async def test_returns_correct_counts(self, client):
        with (
            patch("main._get_products_count", new_callable=AsyncMock, return_value=7),
            patch("main._get_articles_count", new_callable=AsyncMock, return_value=12),
            patch("main._get_agents_count", new_callable=AsyncMock, return_value=4),
        ):
            response = await client.get("/api/overview")

        stats = response.json()["stats"]
        assert stats["total_repos"] == 7
        assert stats["total_articles"] == 12
        assert stats["total_agents"] == 4
        assert "last_updated" in stats


# ---------------------------------------------------------------------------
# /api/agents
# ---------------------------------------------------------------------------

MOCK_JOBS = {
    "jobs": [
        {
            "id": "job-001",
            "name": "Daily Sync",
            "enabled": True,
            "schedule": {"expr": "0 6 * * *"},
            "state": {
                "lastRunStatus": "active",
                "lastRunAtMs": None,
                "nextRunAtMs": None,
                "runningAtMs": None,
            },
        }
    ]
}


class TestAgents:
    def _mock_subprocess(self, mock_run, stdout: str):
        result = MagicMock()
        result.returncode = 0
        result.stdout = stdout
        result.stderr = ""
        mock_run.return_value = result

    async def test_returns_agents_shape(self, client):
        with patch("main.subprocess.run") as mock_run:
            self._mock_subprocess(mock_run, json.dumps(MOCK_JOBS))
            response = await client.get("/api/agents")

        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert isinstance(data["agents"], list)
        assert isinstance(data["total"], int)

    async def test_normalises_agent_fields(self, client):
        with patch("main.subprocess.run") as mock_run:
            self._mock_subprocess(mock_run, json.dumps(MOCK_JOBS))
            response = await client.get("/api/agents")

        agent = response.json()["agents"][0]
        assert agent["id"] == "job-001"
        assert agent["name"] == "Daily Sync"
        assert agent["schedule"] == "0 6 * * *"
        assert "status" in agent

    async def test_empty_when_openclaw_missing(self, client):
        with patch("main.subprocess.run", side_effect=FileNotFoundError):
            response = await client.get("/api/agents")

        assert response.status_code == 200
        data = response.json()
        assert data["agents"] == []
        assert data["total"] == 0
        assert "error" in data

    async def test_paused_status_when_disabled(self, client):
        jobs = {
            "jobs": [
                {
                    "id": "job-002",
                    "name": "Paused Job",
                    "enabled": False,
                    "schedule": {"expr": "*/5 * * * *"},
                    "state": {
                        "lastRunStatus": "active",
                        "lastRunAtMs": None,
                        "nextRunAtMs": None,
                        "runningAtMs": None,
                    },
                }
            ]
        }
        with patch("main.subprocess.run") as mock_run:
            self._mock_subprocess(mock_run, json.dumps(jobs))
            response = await client.get("/api/agents")

        agent = response.json()["agents"][0]
        assert agent["status"] == "paused"


# ---------------------------------------------------------------------------
# /api/metrics
# ---------------------------------------------------------------------------

MOCK_REPOS = [
    {"name": "repo-alpha", "stargazerCount": 100, "forkCount": 20, "url": "https://github.com/u/repo-alpha"},
    {"name": "repo-beta", "stargazerCount": 50, "forkCount": 5, "url": "https://github.com/u/repo-beta"},
]

MOCK_ARTICLES = [
    {
        "title": "My Article",
        "page_views_count": 500,
        "public_reactions_count": 30,
        "url": "https://dev.to/u/my-article",
    }
]


def _setup_metrics_mocks(mock_run, mock_httpx_cls):
    """Configure subprocess and httpx mocks for metrics tests."""
    result = MagicMock()
    result.returncode = 0
    result.stdout = json.dumps(MOCK_REPOS)
    result.stderr = ""
    mock_run.return_value = result

    mock_internal = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_ARTICLES
    mock_internal.get.return_value = mock_resp
    mock_httpx_cls.return_value.__aenter__ = AsyncMock(return_value=mock_internal)
    mock_httpx_cls.return_value.__aexit__ = AsyncMock(return_value=None)


class TestMetrics:
    async def test_returns_all_required_fields(self, client):
        with (
            patch("main.subprocess.run") as mock_run,
            patch("main.httpx.AsyncClient") as MockClient,
        ):
            _setup_metrics_mocks(mock_run, MockClient)
            response = await client.get("/api/metrics")

        assert response.status_code == 200
        data = response.json()
        required = [
            "total_stars",
            "total_forks",
            "total_repos",
            "total_articles",
            "total_article_views",
            "total_article_reactions",
            "top_repo",
            "top_article",
        ]
        for field in required:
            assert field in data, f"Missing field: {field}"

    async def test_aggregates_correctly(self, client):
        with (
            patch("main.subprocess.run") as mock_run,
            patch("main.httpx.AsyncClient") as MockClient,
        ):
            _setup_metrics_mocks(mock_run, MockClient)
            response = await client.get("/api/metrics")

        data = response.json()
        assert data["total_stars"] == 150   # 100 + 50
        assert data["total_forks"] == 25    # 20 + 5
        assert data["total_repos"] == 2
        assert data["total_articles"] == 1
        assert data["total_article_views"] == 500
        assert data["total_article_reactions"] == 30

    async def test_top_repo_is_most_starred(self, client):
        with (
            patch("main.subprocess.run") as mock_run,
            patch("main.httpx.AsyncClient") as MockClient,
        ):
            _setup_metrics_mocks(mock_run, MockClient)
            response = await client.get("/api/metrics")

        top_repo = response.json()["top_repo"]
        assert top_repo is not None
        assert top_repo["name"] == "repo-alpha"
        assert top_repo["stars"] == 100


# ---------------------------------------------------------------------------
# POST /api/crons/{id}/run
# ---------------------------------------------------------------------------

class TestRunCron:
    async def test_returns_ok_true_on_success(self, client):
        with patch("main.subprocess.run") as mock_run:
            result = MagicMock()
            result.returncode = 0
            result.stdout = "Job started"
            result.stderr = ""
            mock_run.return_value = result

            response = await client.post("/api/crons/my-job/run")

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True

    async def test_returns_ok_false_when_openclaw_missing(self, client):
        with patch("main.subprocess.run", side_effect=FileNotFoundError):
            response = await client.post("/api/crons/my-job/run")

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is False
        assert "error" in data

    async def test_returns_ok_false_on_command_failure(self, client):
        import subprocess

        with patch("main.subprocess.run") as mock_run:
            mock_run.side_effect = subprocess.CalledProcessError(
                returncode=1,
                cmd=["openclaw"],
                output="",
                stderr="permission denied",
            )
            response = await client.post("/api/crons/bad-job/run")

        data = response.json()
        assert data["ok"] is False
        assert "error" in data
