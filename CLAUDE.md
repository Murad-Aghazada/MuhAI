# Muhai — project state, findings, and next steps

**Muhai / MuhAI** — AI-powered accounting & finance OS for Turkish SMEs.
TEKNOFEST 2026 Financial Technologies. Team Nasimi BHOS · Team ID 821808 ·
Application ID 4579275 · Baku Higher Oil School.

This file is the working handoff. It is auto-loaded each session — read it
before starting work, and update it when facts change.

Last verified: **2026-09-08**.

---

## 1. Layout

Everything lives in one folder (`C:\Users\ASUS\Desktop\MuhAI`), git repo on
`master`.

```
/
  backend/              FastAPI — stateless compute/AI API (see §3)
  web/                  Vite + React 18 frontend (src/, its own package.json)
  docs/
    RECOVERY.md         full record of the data-loss recovery
    teknofest/          deck, speech, demo video, evaluation report
    reference/          domain reference PDFs
  db_backup/            pg_dump of the old Postgres development database
  firestore.rules       Firestore security rules (deployed)
  firebase.json         Firebase CLI config
  .firebaserc           pins the CLI to project muhai-b80f0
  docker-compose.yml    backend by default; Postgres/Redis/Celery opt-in
  README.md             repo orientation
  CLAUDE.md             this file
```

## 2. Architecture (changed 2026-09-07)

**Cloud Firestore is the system of record.** Postgres is no longer in the
data path. The browser authenticates against Firebase Auth and reads/writes
Firestore directly; the FastAPI service is a *stateless compute layer* that
holds all the real calculation.

```
  Browser (React)  ──auth+data──▶  Firebase Auth + Cloud Firestore
        │
        └──ID token + snapshot──▶  FastAPI /api/compute/*
                                     2026 tax engine · Muhai Score
                                     Prophet forecast · payroll
                                     Tesseract OCR · assistant
```

Nothing under `/api/compute` touches a database, so every endpoint there is a
pure function of its request body. The whole app runs with Postgres and Redis
stopped — verified 2026-09-07.

### Firestore data model

```
users/{uid}                         → { companyId, displayName, email, role }
companies/{companyId}               → profile, members[], ownerUid, cashBalance
  .../invoices/{id}                 number, vendor, direction, issueDate, dueDate,
                                    paidDate, netAmount, vatAmount, amount, status,
                                    category, source, ocrConfidence, needsReview
  .../transactions/{id}             date, amount, type, category, description, vendor
  .../products/{id}                 name, sku, stock, minStock, unitPrice, monthlyUsage
  .../employees/{id}                name, role, grossSalary, startDate, sgkNo
  .../taxObligations/{id}           type, name, period, dueDate, amount, status
```

Dates are ISO `YYYY-MM-DD` strings, not Timestamps: they are calendar dates,
they sort lexicographically, and they cross the API boundary unchanged.

Security rules (`firestore.rules`, deployed to `muhai-b80f0`): a user reads
its own `users/{uid}`; a company and everything beneath it is readable and
writable only by uids listed in that company's `members`. `ownerUid` and
`members` are immutable through the client path.

## 3. History you need to know

The original working tree at `D:\MuhAI` **was deleted**. It held
`docker-compose.yml`, `backend/`, and an Expo / React Native client. Only the
Docker images and the Postgres volume survived. On 2026-09-01 the backend was
extracted out of `muhai-backend:latest` (built with `COPY . .`, so it carries a
full source snapshot from 18 Jun 2026), the database was dumped, and
`docker-compose.yml` + `.env` were reconstructed from container metadata.

`.dockerignore` excluded `tests/` and `.env`, so those were **not** in the image.
Tests were rewritten from scratch; `.env` was rebuilt from `.env.example`.

Full detail: `docs/RECOVERY.md`.

## 4. Running it

```bash
docker compose up -d                                  # API only, :8000
curl http://localhost:8000/health                     # -> {"status":"healthy"}

# Dev deps are deliberately not in the runtime image, so install them once
# per container before the first test run (see N11).
docker compose exec backend pip install -r requirements-dev.txt
docker compose exec backend python -m pytest          # 122 pass

npm --prefix web install && npm --prefix web run dev  # web frontend :5173
```

The legacy DB-backed routes (`/api/invoices`, `/api/transactions`, …) need the
opt-in profile:

```bash
docker compose --profile legacy up -d                 # + Postgres, Redis, Celery
```

Firestore rules are deployed with `firebase deploy --only firestore:rules`.

Environment: `backend/.env` (git-ignored, from `.env.example`) and
`web/.env.local` (git-ignored, from `web/.env.example`).

## 5. Verified current state

**Backend** (`backend/`) — 76 files Python. FastAPI 0.110, SQLAlchemy 2 (async),
Pydantic v2, Celery 5.3, Redis 5.

- **16 routers**, **58 endpoints**. The new `compute` router is the one the web
  client uses: `/api/compute/{dashboard,muhai-score,forecast,tax-summary,payroll,classify,ocr,chat}`
- Auth on `/api/compute` is a **Firebase ID token**, verified in
  `app/core/firebase_auth.py` against Google's public X.509 certificates —
  stdlib only, no service-account key, no new dependency
- Tesseract 5 + `tesseract-ocr-tur` in the image; `OcrEngine` ABC, per-field
  confidence, `CONFIDENCE_THRESHOLD = 0.7`
- Prophet 1.1.5 forecasting, moving-average fallback under 10 points and on any
  Prophet failure. **Confirmed running on real seeded data** (120 daily points,
  80% interval) on 2026-09-07
- `chat_service.py`: Gemini backend (`gemini-2.5-flash` over the REST endpoint,
  stdlib `urllib` only) + deterministic offline fallback. Verified answering
  open-ended questions with `source="ai"` on 2026-09-08
- Muhai Score: 8 weighted categories, pure and explainable
- Tax engine: 2026 KDV / income / corporate / stopaj / SGK / stamp rates

**Web frontend** (`web/src/`) — 48 modules. Vite + React 18, TR/EN i18n,
custom SVG charts, Framer Motion.

- Firebase Auth registration/login; two-step company sign-up
- `CompanySetup` recovery screen for an account whose company document is
  missing (a registration that half-completed no longer strands the account)
- Protected `/app`; live Firestore subscriptions in `context/DataContext.jsx`
- **No mock data anywhere.** `mockData.js` is deleted; every figure on every
  screen is derived from Firestore documents plus the compute API
- Falls back to local aggregation with an explicit "hesaplama servisi
  çevrimdışı" badge when the API is unreachable — never a blank screen, never
  an invented number
- `lib/seed.js` generates a deterministic demo dataset: 12 months of
  transactions, **5 invoices**, 6 products, 4 employees, 4 tax obligations

**Database** — Cloud Firestore, project `muhai-b80f0`. The seeded demo company
holds 5 invoices, 206 transactions, 6 products, 4 employees, 4 tax obligations.
The old Postgres volume `muhai_postgres_data` is untouched and still reachable
under the `legacy` profile.

**Mobile client** — still lost (F5).

**Tests** — `backend/tests/`, **122 passing** (was 106). The 16 new ones cover
the compute layer end to end through the FastAPI app: gap-free 12-month series,
KPI/latest-month agreement, receivables vs payables, empty-company handling,
on-the-fly classification, score bounds and weights, Prophet engine selection,
horizon clamping, KDV netting, trailing-year corporate tax, payroll totals,
batch classification, chat with and without a snapshot, and that
`FIREBASE_AUTH_REQUIRED` genuinely gates the endpoints.

## 6. Open findings

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | ~~**Prophet does not run.**~~ Cause: `requirements.txt` pinned `prophet==1.1.5` but left **cmdstanpy unpinned**, resolving to 1.3.0, whose stricter `set_cmdstan_path()` validation rejects Prophet's stripped `stan_model/cmdstan-2.33.1`, so every Stan backend fails to load. Fixed by pinning `cmdstanpy==1.2.4` and widening `forecast_cashflow()` to fall back on any Prophet failure. | **Critical** | **Fixed 2026-09-01** |
| F2 | ~~**Frontend and backend are disconnected.**~~ The web client now has an API client (`web/src/lib/api.js`), sends a Firebase ID token, and renders backend-computed dashboard, score, forecast, tax and payroll figures. | **Critical** | **Fixed 2026-09-07** |
| F3 | **Gemini API key was hardcoded in the frontend.** Removed entirely — `web/src/lib/gemini.js` is deleted, the assistant goes through `/api/compute/chat`, and `web/dist/` contains no key and no `generativelanguage` endpoint. **Scope checked 2026-09-08: the key is *not* in git history** — every committed revision of `gemini.js` holds the literal `'REDACTED_ROTATED_KEY'`, and the only `AIza…` strings in history are the Firebase web config (public by design, N9). The live key exists only in `backend/.env`, which is git-ignored. Exposure was therefore limited to the pre-git working tree, the lost `D:\MuhAI` copy, and any bundle built from it — the app was never publicly deployed (`firebase.json` has no `hosting` block). | High → Medium | Frontend clean; **rotation advisable, not urgent** |
| F4 | **`SECRET_KEY` was `change_me_in_production`.** Local `.env` has a generated key. Only signs the legacy JWT routes now; `/api/compute` uses Firebase tokens. | High | Fixed locally |
| F5 | **Expo/React Native client lost.** Affects speech claim S14. | High | Open |
| F6 | ~~**No auth on the web app.**~~ Firebase Auth email/password, company registration, protected routes, per-company Firestore rules. | High | **Fixed 2026-09-07** |
| F7 | ~~**Firebase RTDB returns 401.**~~ The dead `cyberxbank` RTDB path is gone. RAG now runs server-side in `chat_service.py`. | Medium | **Fixed 2026-09-07** |
| F8 | **Tesseract language data is CDN-fetched** for the browser OCR mode. Server-side OCR (the default) has no such dependency, so the demo path is safe; the on-device toggle still fetches. | Medium (demo risk) | Reduced — vendor `tur`/`eng` traineddata to close it |
| F9 | ~~**Expense classifier is diacritic-sensitive.**~~ Keywords and input are now folded (ı/ş/ğ/ü/ö/ç), so OCR text that dropped diacritics still classifies. | Medium | **Fixed 2026-09-07** |
| F10 | **Empty tables.** Moot for the app — Firestore is the store and all five collections carry data. The Postgres tables under the `legacy` profile remain unexercised. | Low | Superseded by the Firestore migration |
| F11 | ~~**Dead UI controls.**~~ Topbar search, notifications, account menu, logout, export→CSV, add/edit/delete invoice, mark-paid, add/adjust/delete product, add/delete employee, mark-filed, refresh, seed/clear data all work. | Medium (demo risk) | **Fixed 2026-09-07** |
| F12 | ~~**Expense classifier rule order.**~~ `marketing` is now checked before `software`, so "Google reklam" classifies on spend intent, not vendor brand. | Low | **Fixed 2026-09-07** |
| F14 | **The Gemini assistant never actually ran.** `GeminiChatBackend.reply()` did `import google.generativeai`, but that package is not in `requirements.txt` and is not in the image — so every call raised `ImportError`, was swallowed by the bare `except Exception`, and returned the keyword-matcher answer with `source="placeholder"`. The hardcoded `gemini-1.5-flash` had also been retired and would have 404'd. Rewritten to call the REST endpoint with stdlib `urllib` (same approach as `firebase_auth.py`, no new dependency, no image rebuild) against `gemini-2.5-flash`, overridable via `GEMINI_MODEL`. | **High** | **Fixed 2026-09-08** |
| F13 | **Scroll-triggered animations could never fire.** `useInView` does not fire in embedded/iframed contexts, and every chart animates in from `pathLength: 0` — so charts rendered blank and KPI counters froze at ₺0. Fixed with `web/src/lib/useReveal.js`, which guarantees the reveal via a fallback timer. | High (demo risk) | **Fixed 2026-09-07** |

## 7. Next steps

Phases 0–3 are done. What remains:

### Phase 4 — Data and demo state
1. ~~Seed a realistic multi-month dataset~~ — `web/src/lib/seed.js`.
2. ~~Exercise the Prophet path against real data~~ — 120 points, confirmed.
3. ~~Verify the assistant's live path~~ — confirmed 2026-09-08 (F14). Still worth
   exercising the *offline* fallback with `GEMINI_API_KEY` empty.
4. Vendor `tur`/`eng` traineddata locally for the on-device OCR mode (F8).

### Phase 5 — Align the presentation with the code
See §8 — the claims table is the checklist.

### Phase 6 — Hardening
1. **Rotate the Gemini key** (F3) and move to real secret storage.
2. Expand test coverage to the legacy route layer with a test database.
3. CI running migrations + tests.
4. Rate limiting on public endpoints.
5. Deploy somewhere the jury can reach (Firebase Hosting for `web/`, any
   container host for the API; set `BACKEND_CORS_ORIGINS` and `VITE_API_URL`).
6. Offline demo path that survives venue network failure.

### Phase 7 — Backlog surfaced by the migration
1. Multi-user companies: `members[]` supports it, but there is no invite flow.
2. Move server OCR onto the Celery worker so the request returns a job id.
3. Bank transactions / reconciliation and vendor-category learning have no
   Firestore equivalent yet — they exist only on the legacy Postgres routes.
4. Code-split the bundle: `dist/index-*.js` is 973 kB (266 kB gzipped).

## 8. TEKNOFEST claims vs. code

| Claim | Reality | Action |
|---|---|---|
| S1 Python 3.11 / FastAPI / SQLAlchemy 2 / Pydantic v2 / Celery | **True** | none |
| S2 PostgreSQL 15 + Redis 7 | **Changed** — Firestore is the store; Postgres/Redis are opt-in for legacy routes | restate as "Cloud Firestore" |
| S4 Docker Compose, 4 services | **Changed** — 1 service by default, 4 under `--profile legacy` | restate |
| S5 Tesseract 5 + Turkish pack, swappable `OcrEngine` | **True**, and now reachable from the UI | none |
| S7 Gemini 2.5 Flash + RAG | **True as of 2026-09-08** — the model really is `gemini-2.5-flash` and the call really reaches it (F14). Before that fix the claim was false in practice: every answer came from the keyword fallback | none |
| S9 per-field confidence, 0.7 threshold | **True**, with a working review queue in the UI | none |
| S6 Prophet forecasting | **True** — runs on real data with an 80% band. The sub-10-point fallback is a **moving average**; the speech says **OLS regression** | correct the "OLS" wording |
| S18 / Slide 13 "13 servis geliştirildi ve test edildi" | Understated — **16 routers / 58 endpoints**, 122 tests | pick the number you defend |
| Slide 4 says **Django**; S1 says **FastAPI** | Code is FastAPI | fix the deck + team slide |
| S14 Expo / React Native shipped | Client **lost** (F5) | rebuild, or restate as responsive web |
| S8 10,000+ labeled invoices, fine-tuned model | No dataset or training code | produce it, or restate as heuristic parsing |
| S3/S16 GİB / SGK / bank APIs | Verify whether `bank_service.py` and tax routes hit live endpoints or stubs | phrase claim to match exactly |
| S12 AES-256, Tier-3 hosting, pentests | Firestore encrypts at rest and in transit; rules are deployed and restrictive. No pentest has been run | restate to what is implemented |

Reminder #5 in the team's own notes gives the honest escape hatch:
*"şu anki sürümde bu özelliği henüz eklemedik, ama yol haritamızda yer alıyor."*

## 9. Conventions and gotchas

- **N1 — Avoid unnecessary rebuilds.** `docker-compose.yml` declares `image:`
  alongside `build:` so the existing images are reused. Rebuild only when
  `requirements.txt` or the `Dockerfile` changes, then
  `docker compose build backend celery_worker && docker compose up -d`.
- **N1b — Pins in `requirements.txt` carry comments explaining why.** Do not
  bump `cmdstanpy` without re-running `tests/test_forecast_service.py`; the
  pin is load-bearing (F1).
- **N2 — The compose project name is pinned** (`name: muhai`) so the volume key
  `postgres_data` resolves to the existing `muhai_postgres_data`. Changing it
  orphans the old database.
- **N3 — `.dockerignore` excludes `tests/` and `.env`.** That is how they were
  lost. Keep them in git.
- **N4 — The backend's migration step is best-effort** (`||`, not `&&`) so the
  compute API starts with no database present. Do not "fix" it back.
- **N5 — The Bash tool cannot reach `D:`**; use PowerShell for that drive.
- **N6 — `useInView` is not trustworthy.** Use `web/src/lib/useReveal.js` for
  any scroll-triggered animation (F13). A chart that animates from
  `pathLength: 0` renders as *nothing* if the trigger never fires.
- **N7 — No git remote yet.** Everything is local. Push somewhere off this
  machine — the whole point of Phase 0 was that a single deletion nearly ended
  the project. ~85 MB of media is in git history, so consider git-lfs first.
- **N8 — Recovering source from an image** (the trick that saved this project):
  `docker create --name tmp <image>` → `docker cp tmp:/app ./dest` → `docker rm tmp`.
- **N9 — The Firebase web config in `web/.env.local` is public by design.** It
  identifies the project; it grants nothing. Access is decided by Firebase Auth
  plus `firestore.rules`. Real secrets (Gemini key, JWT secret) live only in
  `backend/.env`.
- **N12 — the API does not come back on its own after a reboot.** The `backend`
  service has `restart: unless-stopped`, so the *container* restarts — but only
  once the Docker **daemon** is running, and Docker Desktop does not start at
  login unless "Start Docker Desktop when you sign in" is enabled in its
  settings. With Docker down the web app shows *"Hesaplama servisi çevrimdışı"*
  and the assistant silently drops to the keyword fallback. Start Docker
  Desktop, or deploy the API somewhere always-on (Phase 6.5).
- **N11 — `pytest` is not in the runtime image.** `requirements-dev.txt` is
  excluded on purpose, so a freshly recreated container has no pytest and the
  documented test command fails with "No module named pytest". Run
  `docker compose exec backend pip install -r requirements-dev.txt` once after
  any `docker compose down` / rebuild.
- **N10 — `web/public/sample-invoice.png`** is a synthetic Turkish invoice for
  exercising the OCR path (vendor, no `AND-2026-8842`, net 12.350, KDV 2.470,
  total 14.820). Useful for demos and for checking OCR regressions.
