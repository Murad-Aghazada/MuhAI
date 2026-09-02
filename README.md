# Muhai

AI-powered accounting & finance OS for Turkish SMEs.
TEKNOFEST 2026 Financial Technologies · Team Nasimi BHOS · Baku Higher Oil School.

## Layout

```
backend/     FastAPI + SQLAlchemy 2 + Celery API (15 routers, 50 endpoints)
web/         Vite + React 18 frontend (TR/EN)
docs/        RECOVERY.md, TEKNOFEST material, reference PDFs
db_backup/   pg_dump of the development database
docker-compose.yml
CLAUDE.md    working handoff — project state, open findings, roadmap
```

## Run

Backend stack (Postgres, Redis, API, Celery worker):

```bash
docker compose up -d
```

Then `curl http://localhost:8000/health` → `{"status":"healthy"}`.
API docs at http://localhost:8000/docs.

Backend tests:

```bash
docker compose exec backend python -m pytest
```

Web frontend:

```bash
npm --prefix web install && npm --prefix web run dev
```

Serves on http://localhost:5173. See `web/README.md` for frontend detail.

## Where to start

Read `CLAUDE.md` first — it carries the verified project state, the numbered
open findings (F1–F12), and the phased roadmap. `docs/RECOVERY.md` records how
the backend was recovered from Docker images after the original working tree
was lost.
