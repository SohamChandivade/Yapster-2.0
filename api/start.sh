#!/bin/sh
# Container entrypoint for hosted runs (Render): apply migrations, then serve behind the
# platform's proxy. $PORT is set by Render; 8000 keeps docker compose and local runs working.
set -e
cd /app
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
