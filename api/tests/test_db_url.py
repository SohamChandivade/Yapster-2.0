"""Hosted Postgres providers hand out libpq-style URLs; the API must accept them as-is."""

import pytest

from app.config import Settings, normalize_database_url


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        # Already in our shape: untouched.
        (
            "postgresql+asyncpg://yapster:yapster@localhost:5432/yapster",
            "postgresql+asyncpg://yapster:yapster@localhost:5432/yapster",
        ),
        # Render / Heroku style scheme.
        (
            "postgres://u:p@dpg-abc.frankfurt-postgres.render.com/yapster",
            "postgresql+asyncpg://u:p@dpg-abc.frankfurt-postgres.render.com/yapster",
        ),
        # Neon: sslmode + channel_binding, both unknown to asyncpg.
        (
            "postgresql://u:p@ep-x.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
            "postgresql+asyncpg://u:p@ep-x.aws.neon.tech/neondb?ssl=require",
        ),
        ("postgresql://u:p@h/db?sslmode=verify-full", "postgresql+asyncpg://u:p@h/db?ssl=require"),
        ("postgresql://u:p@h/db?sslmode=disable", "postgresql+asyncpg://u:p@h/db?ssl=disable"),
        # An explicit ssl= wins over sslmode.
        (
            "postgresql://u:p@h/db?ssl=verify-full&sslmode=require",
            "postgresql+asyncpg://u:p@h/db?ssl=verify-full",
        ),
        # Encoded passwords survive.
        (
            "postgres://u:p%40ss%3Aw@h:5432/db",
            "postgresql+asyncpg://u:p%40ss%3Aw@h:5432/db",
        ),
    ],
)
def test_normalize_database_url(given: str, expected: str) -> None:
    assert normalize_database_url(given) == expected


def test_settings_normalize_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@h/db?sslmode=require")
    assert Settings().database_url == "postgresql+asyncpg://u:p@h/db?ssl=require"
