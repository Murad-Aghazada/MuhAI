# Phase 0 — Recovery record

**Date:** 2026-09-01

## What happened

The original working tree at `D:\MuhAI` no longer exists. It held
`docker-compose.yml`, the `backend/` source, and (per the backend's CORS
configuration) an Expo / React Native client. The directory is gone from disk;
only the Docker artefacts survived:

- image `muhai-backend:latest`
- image `muhai-celery_worker:latest`
- volume `muhai_postgres_data`

Both images were built with `COPY . .`, so each carries a complete snapshot of
the backend source as of the build (18 Jun 2026). That snapshot is what has been
recovered here.

## What was recovered

| Item | Source | Result |
|---|---|---|
| Backend source (86 files, 6,078 LOC Python) | `muhai-backend:latest` → `/app` | `backend/` |
| Celery worker source | `muhai-celery_worker:latest` → `/app` | byte-identical to the backend tree; one image serves both services |
| Database (12 tables, schema at `0008_vendor_categories`) | volume `muhai_postgres_data` | `db_backup/muhai_full_20260901.sql` |
| Roles | `pg_dumpall --roles-only` | `db_backup/muhai_roles_20260901.sql` |
| `docker-compose.yml` | reconstructed from container labels, env, mounts, healthcheck and published ports | project root |
| `backend/.env` | rebuilt from `backend/.env.example` | project root |

Raw extractions are kept in `_recovery/` (git-ignored) as a safety copy.

## What is permanently lost

- **The Expo / React Native client.** The backend's CORS list
  (`localhost:8081`, `localhost:19006`, `exp://127.0.0.1:19000`) shows a mobile
  client existed. A filesystem search across `C:` and `D:` found no surviving
  Expo project. It was not containerised, so nothing captured it.
- **The original `tests/` directory** — excluded from the image by
  `.dockerignore`. Rewritten from scratch (see below).
- **The original `.env`** — also excluded by `.dockerignore`. Rebuilt from
  `.env.example`.
- Any backend source changes made after the 18 Jun 2026 image build.

## Reconstruction notes

`docker-compose.yml` was rebuilt to match the original exactly so the existing
database volume is reused rather than recreated:

- `name: muhai` — pins the compose project name, so the volume key
  `postgres_data` resolves to the existing `muhai_postgres_data`.
- Container names pinned to `muhai_backend`, `muhai_celery`, `muhai_postgres`,
  `muhai_redis`.
- `image:` is declared alongside `build:` so the existing images are reused and
  a rebuild (prophet/pandas/numpy compile) is not triggered on every `up`.
- The postgres healthcheck (`pg_isready -U muhai`, 5s/5s/5) and the
  `depends_on` conditions were taken from the original container metadata.
- `DATABASE_URL` / `REDIS_URL` are overridden in `environment:` with docker
  network hostnames; the values in `backend/.env` target `localhost` for running
  the app outside docker.

## Secrets

The containers were running with `SECRET_KEY=change_me_in_production`. The
rebuilt `.env` has a freshly generated key. The Gemini API key was moved into
`backend/.env` from `src/lib/gemini.js`, where it was hardcoded and shipped in
the browser bundle — **it should be rotated**, since it was publicly exposed.

## Verified working

```
muhai_postgres   Up (healthy)
muhai_redis      Up
muhai_backend    Up    GET /health -> {"status":"healthy"}
muhai_celery     Up    Connected to redis://redis:6379/0, worker ready
```

Alembic at head `0008_vendor_categories`. API serves 50 endpoints across 15
functional routers. Data intact: 1 user, 1 invoice, 2 transactions, 2 employees,
2 products, 1 muhai_score, 5 compliance_alerts.

## Tests

`backend/tests/` was rewritten covering the pure service layer plus API wiring:
**103 passing, 1 xfail.** Install with `pip install -r backend/requirements-dev.txt`.

The suite surfaced one real defect, recorded as the xfail:

> **Prophet is non-functional in the image.** The CmdStan installation bundled
> with `prophet==1.1.5` is incomplete — `stan_model/cmdstan-2.33.1` is missing
> its makefile — so constructing `Prophet()` raises
> `AttributeError: 'Prophet' object has no attribute 'stan_backend'`.
> `forecast_cashflow()` only catches `ImportError`, so **any history with 10 or
> more points raises instead of forecasting**, and `/api/cashflow/forecast` and
> `/api/transactions/forecast` will return 500. This is currently masked because
> the database holds too little data to cross the threshold — it will surface as
> soon as realistic data is seeded.

Two smaller findings are encoded as passing regression tests in
`tests/test_expense_classifier.py`: the classifier's rule order lets a vendor
brand outrank spend intent (`"Google reklam"` → `software`), and its keywords
are diacritic-sensitive, so OCR text that has dropped Turkish diacritics
(`"bakim"` for `"bakım"`) falls through to `other`.

## Running

```bash
docker compose up -d
curl http://localhost:8000/health
docker compose exec backend python -m pytest
```

API docs: http://localhost:8000/docs
