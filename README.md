# Muhai

AI-powered accounting & finance OS for Turkish SMEs.
TEKNOFEST 2026 Financial Technologies · Team Nasimi BHOS · Baku Higher Oil School.

## Architecture

Cloud Firestore is the system of record. The FastAPI service is a stateless
compute layer — it stores nothing and holds all the calculation.

```
  Browser (React)  ──auth + data──▶  Firebase Auth + Cloud Firestore
        │
        └──ID token + snapshot──▶   FastAPI  /api/compute/*
                                      2026 Turkish tax engine
                                      Muhai Score (8 weighted categories)
                                      Prophet cash-flow forecast
                                      Payroll (SGK, income tax, stamp)
                                      Tesseract 5 invoice OCR
                                      Grounded AI assistant
```

## Layout

```
backend/          FastAPI compute API (16 routers, 58 endpoints, 122 tests)
web/              Vite + React 18 frontend (TR/EN)
db_backup/        pg_dump of the retired Postgres development database
firestore.rules   Firestore security rules
docker-compose.yml
CLAUDE.md         working handoff — project state, findings, roadmap
```

## Run

```bash
docker compose up -d
```

Serves the API on `http://localhost:8000`; `curl http://localhost:8000/health`
→ `{"status":"healthy"}`. Interactive docs at `http://localhost:8000/docs`.

```bash
npm --prefix web install && npm --prefix web run dev
```

Serves the web app on `http://localhost:5173`.

Tests — dev dependencies are not baked into the runtime image, so install
them once per container:

```bash
docker compose exec backend pip install -r requirements-dev.txt
```

```bash
docker compose exec backend python -m pytest
```

The older DB-backed routes (`/api/invoices`, `/api/transactions`, …) need
Postgres, Redis and the Celery worker, which are opt-in:

```bash
docker compose --profile legacy up -d
```

## Configuration

Copy the two examples and fill them in — both are git-ignored:

| File | Holds |
|---|---|
| `backend/.env` | `FIREBASE_PROJECT_ID`, `GEMINI_API_KEY`, `SECRET_KEY`, CORS origins |
| `web/.env.local` | `VITE_FIREBASE_*` web config, `VITE_API_URL` |

The Firebase web config is public by design: it identifies the project and
grants nothing. Access is decided by Firebase Auth plus `firestore.rules`.
Real secrets live only in `backend/.env`.

## Firebase setup

The project is `muhai-b80f0`. Required once, in the Firebase console:

1. **Authentication → Sign-in method → Email/Password**: enable.
2. **Firestore Database**: create.

Then publish the rules:

```bash
firebase deploy --only firestore:rules
```

## First run

Open `http://localhost:5173`, click **Ücretsiz başla**, and register a company.
Leave *"Örnek verilerle başlat"* ticked and the account is seeded with a
realistic 12-month history — transactions, five invoices, stock and staff — so
every screen shows real, computed figures immediately. You can regenerate or
delete that dataset any time from **Ayarlar → Veri yönetimi**.

`web/public/sample-invoice.png` is a synthetic Turkish invoice for testing the
OCR path end to end.

## Where to start

Read `CLAUDE.md` — it carries the verified project state, the numbered open
findings (F1–F13), and the phased roadmap. `docs/RECOVERY.md` records how the
backend was recovered from Docker images after the original working tree was
lost.
