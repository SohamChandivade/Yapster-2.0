import pytest
from httpx import AsyncClient

from app import __version__


async def _db_up() -> bool:
    return True


async def _db_down() -> bool:
    return False


async def test_health_reports_ok_with_db(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.db.engine.check_db", _db_up)

    res = await client.get("/health")

    assert res.status_code == 200
    assert res.json() == {"status": "ok", "version": __version__, "db": True}


async def test_health_stays_200_when_db_is_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.db.engine.check_db", _db_down)

    res = await client.get("/health")

    assert res.status_code == 200
    assert res.json()["db"] is False


async def test_health_allows_the_web_origin(client: AsyncClient) -> None:
    res = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"
