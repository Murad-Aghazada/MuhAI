# Muhai — project state, findings, and next steps

**Muhai / MuhAI** — AI-powered accounting & finance OS for Turkish SMEs.
TEKNOFEST 2026 Financial Technologies. Team Nasimi BHOS · Team ID 821808 ·
Application ID 4579275 · Baku Higher Oil School.

This file is the working handoff. It is auto-loaded each session — read it
before starting work, and update it when facts change.

Last verified: **2026-09-01**.

---

## 1. Layout

Everything lives in one folder (`C:\Users\ASUS\Desktop\MuhAI`), git repo on
`master`. Tidied on 2026-09-02 — the frontend moved into `web/` and all
documents into `docs/`, so the root is now just config plus four folders.

```
/
  backend/              FastAPI stack (recovered — see §2)
  web/                  Vite + React 18 frontend (src/, its own package.json)
  docs/
    RECOVERY.md         full record of the data-loss recovery
    teknofest/          deck, speech, demo video, evaluation report
    reference/          domain reference PDFs
  db_backup/            pg_dump of the surviving database
  docker-compose.yml    4-service dev stack, reconstructed
  README.md             repo orientation
  CLAUDE.md             this file
```

## 2. History you need to know

The original working tree at `D:\MuhAI` **was deleted**. It held
`docker-compose.yml`, `backend/`, and an Expo / React Native client. Only the
Docker images and the Postgres volume survived. On 2026-09-01 the backend was
extracted out of `muhai-backend:latest` (built with `COPY . .`, so it carries a
full source snapshot from 18 Jun 2026), the database was dumped, and
`docker-compose.yml` + `.env` were reconstructed from container metadata.

`.dockerignore` excluded `tests/` and `.env`, so those were **not** in the image.
Tests were rewritten from scratch; `.env` was rebuilt from `.env.example`.

Full detail: `docs/RECOVERY.md`.

## 3. Running it

```bash
docker compose up -d                                  # 4 services
curl http://localhost:8000/health                     # -> {"status":"healthy"}
docker compose exec backend python -m pytest          # 106 pass
npm --prefix web install && npm --prefix web run dev   # web frontend :5173
```

API docs at http://localhost:8000/docs · Postgres `:5432` (muhai/muhai_secret)
· Redis `:6379`.

## 4. Verified current state

**Backend** (`backend/`) — 86 files, 6,078 LOC Python. Real and substantial.

- FastAPI 0.110, SQLAlchemy 2 (async), Pydantic v2, asyncpg, Alembic,
  Celery 5.3, Redis 5, JWT (python-jose + bcrypt)
- **15 routers**, **14 services**, **11 models**, **8 migrations**, **50 endpoints**
- Tesseract 5 + `tesseract-ocr-tur` installed in the image; `OcrEngine` ABC,
  per-field confidence, `CONFIDENCE_THRESHOLD = 0.7`
- Prophet 1.1.5 forecasting, with a moving-average fallback under 10 points
  and on any Prophet failure (fixed 2026-09-01, see F1)
- `chat_service.py` has a Gemini backend *and* a deterministic offline fallback
- Muhai Score engine: 8 weighted categories, pure and explainable
- Tax engine: 2026 KDV / income / corporate / stopaj / SGK / stamp rates, pure functions

**Database** — schema at head `0008_vendor_categories`, 12 tables. Nearly empty:
1 user, 1 invoice, 2 transactions, 2 employees, 2 products, 1 muhai_score,
5 compliance_alerts. `bank_transactions`, `tax_obligations`,
`inventory_movements`, `vendor_categories` are all **0 rows**.

**Web frontend** (`web/src/`) — Vite + React 18, TR/EN i18n, custom SVG charts,
real client-side Tesseract OCR, Framer Motion. Reads `web/src/data/mockData.js`.
Calls Gemini and Firebase **directly from the browser**. Has **no API client**
and has never talked to the backend.

**Mobile client** — lost. The backend's CORS list
(`localhost:8081`, `localhost:19006`, `exp://127.0.0.1:19000`) proves an Expo app
existed. A search across `C:` and `D:` found no surviving copy.

**Tests** — `backend/tests/`, 106 passing. Covers the pure service
layer (tax, OCR parsing, expense classification, Muhai Score, tax calendar,
payroll, forecasting) plus API wiring smoke tests. Dev deps in
`backend/requirements-dev.txt`.

## 5. Open findings

Ordered by severity. Update the status column as these are resolved.

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | ~~**Prophet does not run.**~~ Cause: `requirements.txt` pinned `prophet==1.1.5` but left **cmdstanpy unpinned**, resolving to 1.3.0. Prophet ships a precompiled `prophet_model.bin` with a deliberately stripped `stan_model/cmdstan-2.33.1` (`bin/` + `stan/`, no makefile) and calls `set_cmdstan_path()` on it; from cmdstanpy 1.3.0 that path is validated strictly, every Stan backend fails to load, and `Prophet()` raises `AttributeError: 'Prophet' object has no attribute 'stan_backend'`. Fixed by pinning `cmdstanpy==1.2.4` (no full CmdStan install needed) and widening `forecast_cashflow()` to fall back on any Prophet failure instead of only `ImportError`. Guarded by `test_prophet_backend_actually_loads` and `test_forecast_degrades_instead_of_raising`. | **Critical** | **Fixed 2026-09-01** |
| F2 | **Frontend and backend are disconnected.** Every number in the UI is a constant in `mockData.js`. The demo shows nothing the backend computes. | **Critical** | Open |
| F3 | **Gemini API key was public.** Hardcoded in `web/src/lib/gemini.js` and shipped in the browser bundle. Now in `backend/.env` (git-ignored), but the old value was exposed — **rotate it**. | High | Partially done — needs rotation |
| F4 | **`SECRET_KEY` was `change_me_in_production`.** That is what the containers were actually running with. Local `.env` now has a generated key; check anywhere else it was deployed. | High | Fixed locally |
| F5 | **Expo/React Native client lost.** Affects speech claim S14. Either rebuild or restate the claim. | High | Open |
| F6 | **No auth on the web app.** `/app` is fully open — no login, no tenant. Backend has JWT auth ready and unused. | High | Open |
| F7 | **Firebase RTDB returns 401 Permission denied.** The frontend RAG path is dead and silently falls back to the local KB in `web/src/lib/ragKnowledge.js`. Backend `chat_service.py` has its own path, so Firebase may simply be dropped. | Medium | Open |
| F8 | **Tesseract language data is CDN-fetched** on first browser OCR. Venue wifi will stall or fail it — during the headline demo. Vendor `tur`/`eng` traineddata locally. | Medium (demo risk) | Open |
| F9 | **Expense classifier is diacritic-sensitive.** Keywords carry Turkish diacritics, so OCR output that dropped them (`"bakim"` for `"bakım"`) falls through to `other`. Matters because OCR frequently drops diacritics. | Medium | Open (regression test records it) |
| F10 | **Empty tables.** `bank_transactions`, `tax_obligations`, `inventory_movements`, `vendor_categories` have never held data — those code paths are unexercised. | Medium | Open |
| F11 | **Dead UI controls.** Export, Filter, Add product, "Beyanname hazırla", topbar search, notifications, Login all render and do nothing. A juror will click one. | Medium (demo risk) | Open |
| F12 | **Expense classifier rule order** lets a vendor brand outrank spend intent — `"Google reklam"` classifies as `software`, not `marketing`, because `software` is checked first and `"google"` is one of its keywords. | Low | Open (regression test records it) |

## 6. Next steps

Phase 0 (recovery) is **done**. Work the phases in order; within a phase the
steps are ordered too.

### Phase 1 — Connect the web frontend to the API
1. Add `http://localhost:5173` to `BACKEND_CORS_ORIGINS`.
2. Build an API client module — base URL from env, JWT attach, error handling.
3. Login + registration screens against `/api/auth`; token storage; protected-route guard on `/app`.
4. Replace `mockData.js` per module: dashboard → invoices → tax → inventory → payroll.
5. Delete `mockData.js` once nothing imports it.
6. Route the assistant through `/api/chat` instead of calling Gemini from the browser.
7. Remove the Gemini key and Firebase config from the frontend bundle (F3, F7).

### Phase 2 — Surface backend features that have no UI
Each has a working route and service with nothing rendering it:
1. Muhai Score card + history
2. Cash-flow forecast chart with the confidence band (unblocked — F1 fixed)
3. Compliance alerts list
4. Bank transactions feed + reconciliation
5. Reminders
6. Expense classification on transactions
7. Predictions summary
8. Vendor categories management

### Phase 3 — Complete the invoice loop
1. Point the upload in `web/src/pages/Invoices.jsx` at the backend OCR endpoint.
2. Render the per-field confidence `ocr_service` already returns.
3. Build the review queue for fields below `0.7`.
4. Persist confirmed results into `invoices`.
5. Make a saved invoice appear in the list and move the dashboard KPIs.
6. Keep browser Tesseract as an explicit on-device mode, with traineddata vendored locally (F8).
7. Move OCR onto the Celery worker so the request returns a job id.

### Phase 4 — Data and demo state
1. Seed a realistic multi-month dataset.
2. Populate the four empty tables (F10).
3. Ensure seeded history exceeds 10 points so the Prophet path actually runs — it now does, but nothing has exercised it against real data yet.
4. Verify the assistant's offline fallback with `GEMINI_API_KEY` empty.
5. Resolve or remove the dead controls (F11).

### Phase 5 — Align the presentation with the code
See §7 — the claims table is the checklist.

### Phase 6 — Hardening
1. Rotate `SECRET_KEY` and the Gemini key; move to real secret storage.
2. Expand test coverage to the route layer with a test database.
3. CI running migrations + tests.
4. Rate limiting and request validation on public endpoints.
5. Deploy somewhere the jury can reach.
6. Offline demo path that survives venue network failure.

## 7. TEKNOFEST claims vs. code

The speech (`docs/teknofest/Muhai_TEKNOFEST_Konusma_Metni.md`) and deck
(`docs/teknofest/MuhAI_Presentation_Content.md`) make specific, falsifiable claims. Most hold
up. These are the ones to settle before the final.

| Claim | Reality | Action |
|---|---|---|
| S1 Python 3.11 / FastAPI / SQLAlchemy 2 / Pydantic v2 / Celery | **True** | none |
| S2 PostgreSQL 15 + Redis 7 | **True** | none |
| S4 Docker Compose, 4 services | **True** | none |
| S5 Tesseract 5 + Turkish pack, swappable `OcrEngine` | **True** | none |
| S7 Gemini 2.5 Flash + RAG | **True** (backend); frontend RAG is dead (F7) | fix or drop Firebase |
| S9 per-field confidence, 0.7 threshold | **True** in backend; no UI (Phase 3) | build the review queue |
| S6 Prophet forecasting | **True** — runs and predicts since F1 was fixed. But the sub-10-point fallback is a **moving average**; the speech says **OLS regression** | correct the "OLS" wording |
| S18 / Slide 13 "13 servis geliştirildi ve test edildi" | Understated — **15 routers / 50 endpoints**. But "test edildi" was false until 2026-09-01; tests exist now | pick the number you defend |
| Slide 4 says **Django**; S1 says **FastAPI** | Code is FastAPI. The team slide also says Django | fix the deck + team slide |
| S14 Expo / React Native shipped | Client **lost** (F5) | rebuild, or restate as responsive web |
| S8 10,000+ labeled invoices, fine-tuned model | No dataset or training code in the recovered tree | produce it, or restate as heuristic parsing |
| S3/S16 GİB / SGK / bank APIs | Verify whether `bank_service.py` and tax routes hit live endpoints or stubs | phrase claim to match exactly |
| S12 AES-256, Tier-3 hosting, pentests | Running `SECRET_KEY` was `change_me_in_production` (F4) | verify against what is implemented |

Reminder #5 in the team's own notes gives the honest escape hatch:
*"şu anki sürümde bu özelliği henüz eklemedik, ama yol haritamızda yer alıyor."*
Cheaper than being caught on a falsifiable claim.

## 8. Conventions and gotchas

- **N1 — Avoid unnecessary rebuilds.** `docker-compose.yml` declares `image:`
  alongside `build:` so the existing images are reused. Rebuild only when
  `requirements.txt` or the `Dockerfile` changes (as the F1 fix required), then
  run `docker compose build backend celery_worker && docker compose up -d` so
  both images carry the change.
- **N1b — Pins in `requirements.txt` carry comments explaining why.** Do not
  bump `cmdstanpy` without re-running `tests/test_forecast_service.py`; the
  pin is load-bearing (see F1).
- **N2 — The compose project name is pinned** (`name: muhai`) so the volume key
  `postgres_data` resolves to the existing `muhai_postgres_data`. Changing it
  orphans the database.
- **N3 — `.dockerignore` excludes `tests/` and `.env`.** They are not in the
  image. That is how they were lost. Keep them in git.
- **N4 — `DATABASE_URL`/`REDIS_URL` are overridden** in compose `environment:`
  with docker hostnames. The values in `backend/.env` target `localhost` for
  running outside docker.
- **N5 — The Bash tool cannot reach `D:`** in this environment; use PowerShell
  for anything on that drive.
- **N6 — Layout was tidied on 2026-09-02.** The frontend now lives in `web/`
  (run npm from there, or use `npm --prefix web`), and documents in `docs/`.
  Deleted: `_recovery/` (redundant — `backend/` is a strict superset of it),
  `MuhAI.zip`, `dist/`, and the stale `Muhai_TEKNOFEST_2026_TR - Copy.pptx`.
  Still outstanding: ~85 MB of media (video, pptx, pdf) is committed and lives in
  git history, so `.git` is ~71 MB. Consider git-lfs before pushing to a remote
  (N7).
- **N7 — No git remote yet.** Everything is local. Push somewhere off this
  machine — the whole point of Phase 0 was that a single deletion nearly ended
  the project.
- **N8 — Recovering source from an image** (the trick that saved this project):
  `docker create --name tmp <image>` → `docker cp tmp:/app ./dest` → `docker rm tmp`.
