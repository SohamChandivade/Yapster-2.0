#!/bin/sh
# Container entrypoint for hosted runs (Render): apply migrations, then serve behind the
# platform's proxy. $PORT is set by Render; 8000 keeps docker compose and local runs working.
set -e
cd /app

# Fail with one clear line instead of a connection traceback when the host forgot the database.
python - <<'EOF'
from app.config import get_settings

s = get_settings()
host = s.database_url.split("@")[-1].split("/")[0]
if s.app_env == "prod" and host.split(":")[0] in {"localhost", "127.0.0.1", "db"}:
    raise SystemExit(
        "DATABASE_URL is not set on this service (the API is pointing at localhost). "
        "Add it in the Render Environment tab with the Neon connection string."
    )
EOF

alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
