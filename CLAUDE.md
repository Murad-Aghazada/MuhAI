# Muhai — project state and next steps

**Muhai / MuhAI** — AI-powered accounting & finance OS for Turkish SMEs.
TEKNOFEST 2026 Financial Technologies. Team Nasimi BHOS · Team ID 821808 ·
Application ID 4579275 · Baku Higher Oil School.

Auto-loaded each session. Read it before starting; update it when facts change.
**Keep it lean — delete finished work rather than striking it through.**

Last verified: **2026-09-08**.

---

## 1. Layout

```
/
  backend/              FastAPI — stateless compute/AI API
  web/                  Vite + React 18 frontend (src/, own package.json)
  docs/                 RECOVERY.md, TEKNOFEST material, reference PDFs
  db_backup/            pg_dump of the retired Postgres dev database
  firestore.rules       Firestore security rules (deployed)
  firebase.json         Firebase CLI config
  .firebaserc           pins the CLI to project muhai-b80f0
  docker-compose.yml    backend by default; Postgres/Redis/Celery opt-in
```

Repo: `https://github.com/UghurGambarov/MuhAI.git` (private), branch `master`.

## 2. Architecture

**Cloud Firestore is the system of record** — chosen because it was quick to
build on, not as the endgame. The browser authenticates against Firebase Auth
and reads/writes Firestore directly. FastAPI is a **stateless compute layer**
holding all the real calculation; nothing under `/api/compute` touches a
database, so every endpoint there is a pure function of its request body.

```
  Browser (React)  ──auth+data──▶  Firebase Auth + Cloud Firestore
        │
        └──ID token + snapshot──▶  FastAPI /api/compute/*
                                     2026 tax engine · Muhai Score
                                     Prophet forecast · payroll
                                     Tesseract OCR · assistant
```

**Hosting: the backend will move to a self-managed VPS.** Until then it runs in
Docker on the dev machine. Managed container hosts were considered and declined.

### Firestore data model

```
users/{uid}                 → { companyId, displayName, email, role }
companies/{companyId}       → profile, members[], ownerUid, cashBalance
  .../invoices/{id}         number, vendor, direction, issueDate, dueDate,
                            paidDate, netAmount, vatAmount, amount, status,
                            category, source, ocrConfidence, needsReview
  .../transactions/{id}     date, amount, type, category, description, vendor
  .../products/{id}         name, sku, stock, minStock, unitPrice, monthlyUsage
  .../employees/{id}        name, role, grossSalary, startDate, sgkNo
  .../taxObligations/{id}   type, name, period, dueDate, amount, status
```

Dates are ISO `YYYY-MM-DD` strings, not Timestamps: they are calendar dates,
they sort lexicographically, and they cross the API boundary unchanged.

Rules (deployed to `muhai-b80f0`): a user reads its own `users/{uid}`; a company
and everything beneath it is readable and writable only by uids in that
company's `members`. `ownerUid` and `members` are immutable through the client.

## 3. Running it

```bash
docker compose up -d                                  # API only, :8000
curl http://localhost:8000/health                     # -> {"status":"healthy"}
npm --prefix web install && npm --prefix web run dev  # frontend :5173
```

Containers carry `restart: unless-stopped`, so after a reboot **just opening
Docker Desktop restores the API** — no compose command needed. The frontend dev
server is separate and not containerised.

Tests (dev deps are deliberately absent from the runtime image, see N11):

```bash
docker compose exec backend pip install -r requirements-dev.txt
docker compose exec backend python -m pytest          # 155 pass
```

Legacy DB-backed routes (`/api/invoices`, …) need the opt-in profile:

```bash
docker compose --profile legacy up -d                 # + Postgres, Redis, Celery
```

Rules deploy with `firebase deploy --only firestore:rules`.
Environment: `backend/.env` and `web/.env.local`, both git-ignored.

## 4. Current state

**Backend** — 78 Python files. FastAPI 0.110, SQLAlchemy 2 (async), Pydantic v2,
Celery 5.3, Redis 5. **16 routers, 58 endpoints, 155 tests passing.**

- `/api/compute/{dashboard,muhai-score,forecast,tax-summary,payroll,classify,ocr,chat}`
  is what the web client uses; auth is a Firebase ID token verified in
  `app/core/firebase_auth.py` against Google's public certs — stdlib only
- Assistant has two modes. **Online** it calls `gemini-2.5-flash` over the REST
  endpoint with stdlib `urllib` (override with `GEMINI_MODEL`). **Offline** —
  on any network, quota or key failure — it answers from a local BM25 knowledge
  base plus pre-answered questions and returns `source="offline"`, which the
  chat UI badges. Neither mode needs anything downloaded at runtime (N14)
- Prophet 1.1.5 forecasting on real data, moving-average fallback under 10
  points and on any Prophet failure
- Tesseract 5 + `tesseract-ocr-tur`; per-field confidence, threshold 0.7.
  The browser-side OCR mode is fully vendored under `web/public/tessdata`, so
  **neither OCR path needs internet** (see N13)
- Muhai Score: 8 weighted categories. Tax engine: 2026 KDV / income / corporate
  / stopaj / SGK / stamp rates

**Web frontend** — 49 modules, Vite + React 18, TR/EN, custom SVG charts.

- Firebase Auth, two-step company sign-up, protected `/app`, live Firestore
  subscriptions in `context/DataContext.jsx`
- **No mock data anywhere.** Every figure derives from Firestore + the compute API
- Falls back to local aggregation with a "hesaplama servisi çevrimdışı" badge
  when the API is unreachable — never a blank screen, never an invented number
- `lib/seed.js` generates a deterministic demo dataset

**Mobile** — there is **no native client**; the Expo/React Native app was lost
and has not been rebuilt. The responsive web app is the mobile story. Landing
and auth verified at 375 px on 2026-09-08; the signed-in screens have a drawer
sidebar below 1000 px but were not verified (no test account).

## 5. Open items

1. **Verify the signed-in screens on a phone viewport.** Landing and auth are
   confirmed at 375 px; the app shell has a drawer sidebar below 1000 px but
   was never checked with a real account.
2. **Deploy the backend to the VPS** when it exists; set `BACKEND_CORS_ORIGINS`
   and `VITE_API_URL`.
3. Grow the offline knowledge base. 20 passages cover the common ground; add a
   passage whenever a plausible question falls through to the default reply.
4. Code-split the bundle — `dist/index-*.js` is 973 kB (266 kB gzipped).
5. Move server OCR onto the Celery worker so the request returns a job id.
6. Bank reconciliation and vendor-category learning exist only on the legacy
   Postgres routes; no Firestore equivalent yet.

## 6. TEKNOFEST claims that do not match the code

| Claim | Reality | Action |
|---|---|---|
| Slide 4 says **Django** | Code is FastAPI, and staying that way | fix the deck |
| Speech says forecasting is **OLS regression** | Prophet, with a **moving-average** fallback | correct the wording |
| S2 **PostgreSQL 15 + Redis 7** | Cloud Firestore | restate |
| S4 **Docker Compose, 4 services** | 1 by default, 4 under `--profile legacy` | restate |
| S18 **"13 servis geliştirildi"** | 16 routers / 58 endpoints / 155 tests | understated — pick the number you defend |
| S14 **Expo / React Native shipped** | Mobile **works** — the responsive web app runs on a phone (landing and auth verified at 375 px). What does not exist is a *native* Expo/React Native build. | keep the mobile capability in the pitch; word it as the web app on mobile, not a native app |
| S3/S16 **GİB / SGK / bank APIs** | Confirm whether `bank_service.py` and the tax routes hit live endpoints or stubs | phrase to match exactly |

True as written and needing no change: S1 (Python 3.11 / FastAPI / SQLAlchemy 2
/ Pydantic v2 / Celery), S5 (Tesseract 5 + Turkish pack, swappable `OcrEngine`),
S6 (Prophet), S7 (Gemini 2.5 Flash + RAG), S9 (per-field confidence, 0.7
threshold with a working review queue).

## 7. Conventions and gotchas

- **N1 — Avoid unnecessary rebuilds.** `docker-compose.yml` declares `image:`
  alongside `build:` so existing images are reused. Rebuild only when
  `requirements.txt` or the `Dockerfile` changes.
- **N1b — Pins in `requirements.txt` carry comments explaining why.** Do not
  bump `cmdstanpy` without re-running `tests/test_forecast_service.py`; that pin
  is what makes Prophet load at all.
- **N2 — The compose project name is pinned** (`name: muhai`) so `postgres_data`
  resolves to the existing `muhai_postgres_data`. Changing it orphans the DB.
- **N3 — `.dockerignore` excludes `tests/` and `.env`.** That is how they were
  lost once. Keep them in git.
- **N4 — The migration step is best-effort** (`||`, not `&&`) so the compute API
  starts with no database present. Do not "fix" it back.
- **N5 — The Bash tool cannot reach `D:`**; use PowerShell for that drive.
- **N6 — `useInView` / `whileInView` are not trustworthy.** Use
  `web/src/lib/useReveal.js` or `components/ui/Reveal.jsx` for any
  scroll-triggered animation. Every variant starts at `opacity: 0`, so a missed
  trigger renders a *blank section*, not merely an unanimated one.
- **N6b — Global type selectors beat inherited colour.** `index.css` has
  `h1, h2, h3, h4, h5 { color: var(--ink) }`, which out-specifies a `color`
  inherited from a dark parent. Any heading on a dark ground needs its colour
  set explicitly.
- **N7 — Screenshots of the Browser pane lie while the pane is hidden.** A
  hidden pane suspends `requestAnimationFrame` entirely, so every Framer Motion
  animation freezes at its `initial` state and the page looks blank. Front the
  tab, or check `getComputedStyle(...).opacity` in the DOM, before concluding
  anything is broken.
- **N8 — Recovering source from an image** (the trick that saved this project):
  `docker create --name tmp <image>` → `docker cp tmp:/app ./dest` → `docker rm tmp`.
- **N9 — The Firebase web config in `web/.env.local` is public by design.** It
  identifies the project; it grants nothing. Access is decided by Firebase Auth
  plus `firestore.rules`. Real secrets live only in `backend/.env`.
- **N10 — `web/public/sample-invoice.png`** is a synthetic Turkish invoice for
  exercising OCR (net 12.350, KDV 2.470, total 14.820).
- **N11 — `pytest` is not in the runtime image.** Run
  `docker compose exec backend pip install -r requirements-dev.txt` once after
  any `docker compose down` or rebuild.
- **N14 — The offline assistant's two numbers do different jobs.** In
  `rag.py`, `Hit.score` is raw BM25 and only orders results; `Hit.ratio` is
  idf-weighted query coverage in [0, 1] and is the only one safe to threshold,
  because BM25's magnitude moves with query length. Unknown words must stay in
  the coverage denominator — excluding them lets a mostly-nonsense question
  score 1.00 off one incidental term. Thresholds live in `chat_service.py`;
  re-measure against the corpus before changing them.
- **N14b — Fold anything you compare against folded text.** `rag.py`'s
  stopword list was written with Turkish diacritics while `tokenize()` folds
  first, so none of the diacritic words ever matched and they leaked through as
  content terms. The list is folded at definition time now. Same trap as F9.
- **N13 — Browser OCR assets are vendored, not fetched.** `web/public/tessdata`
  holds the worker, both LSTM wasm cores and gzipped `tur`/`eng` traineddata;
  `web/src/lib/ocr.js` passes `workerPath`, `corePath` and `langPath` so
  nothing is pulled from a CDN. `.gitattributes` marks the directory `-text`
  because the cores inline their wasm as base64 and a CRLF rewrite would
  corrupt them. If you upgrade `tesseract.js`, re-copy the worker and cores
  from `node_modules` — a version mismatch between worker and core fails at
  init, not at build.
- **N12 — The API does not come back by itself after a reboot.** The container
  restarts, but only once the Docker *daemon* runs, and Docker Desktop's
  autostart is currently off. With Docker down the app shows "hesaplama servisi
  çevrimdışı" and the assistant drops to the keyword fallback.

History of the 2026-09-01 data-loss recovery: `docs/RECOVERY.md`.
