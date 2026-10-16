"""Production settings are typed by hand into hosting dashboards; forgive the usual slips."""

import pytest
from httpx import AsyncClient

from app.config import Settings


def test_origins_lose_trailing_slashes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", '["https://yapster.vercel.app/", " https://a.example "]')
    monkeypatch.setenv("PUBLIC_WEB_URL", "https://yapster.vercel.app/")
    monkeypatch.setenv("PUBLIC_API_URL", "https://api.onrender.com/")
    s = Settings()
    assert s.cors_origins == ["https://yapster.vercel.app", "https://a.example"]
    assert s.public_web_url == "https://yapster.vercel.app"
    assert s.public_api_url == "https://api.onrender.com"


async def test_cors_allows_the_web_apps_own_origin(client: AsyncClient) -> None:
    """PUBLIC_WEB_URL alone must be enough for the browser; CORS_ORIGINS is for extras."""
    res = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"

    res = await client.options(
        "/health",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in res.headers
