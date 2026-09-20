# Muhai — project state and next steps

**Muhai / MuhAI** — AI-powered accounting & finance OS for Turkish SMEs.
TEKNOFEST 2026 Financial Technologies. Team Nasimi BHOS · Team ID 821808 ·
Application ID 4579275 · Baku Higher Oil School.

Auto-loaded each session. Read it before starting; update it when facts change.
**Keep it lean — delete finished work rather than striking it through.**

Last verified: **2026-09-20**.

---

## 1. Layout

```
/
  backend/              FastAPI — data + compute API, Alembic migrations
  web/                  Vite + React 18 frontend (src/, own package.json)
  mobile/               Expo SDK 57 native app — imports web/src/lib directly
  docs/                 DEPLOY.md — the VPS runbook
  db_backup/            pg_dump of an earlier development database
  docker-compose.yml            the deployable stack
  docker-compose.override.yml   development layer, applied automatically
  .env.example                  every setting the stack has
```

Repo: `https://github.com/UghurGambarov/MuhAI.git` (private), branch `master`.

## 2. Architecture

**Self-hosted, entirely in Docker.** Postgres is the system of record and
FastAPI owns both the data and the maths. There is no third-party service in
the path: no Firebase, no managed database, no external auth. A VPS with Docker
on it is the whole deployment target.

```
  Browser (React)
        │  nginx serves the bundle and proxies /api — one origin, no CORS
        ▼
  FastAPI  ──▶  PostgreSQL 15 (the only stateful service)
     │
     ├── 2026 tax engine · Muhai Score · Prophet forecast · payroll
     │   Tesseract OCR · assistant (Gemini online, local BM25 offline)
     │
     └── bank API (optional, config-driven) ──▶ the company's bank
         no credentials → CSV statement import, same matcher
```

Everything is synchronous. A Celery worker and a Redis broker were removed on
2026-09-13: the worker had executed **zero** tasks in its lifetime because
nothing ever dispatched to it, and server OCR — the only plausible candidate —
answers in ~0.3 s measured against `web/public/sample-invoice.png`. Redis
existed solely as that worker's broker. Recover both from commit `5c91e18` if
background work ever earns its keep.

Three surfaces to the API — two that own the product, one that is optional:

* **`/api/workspace`** — the data layer. Company profile plus five
  collections. The signed-in token *is* the company scope: every query is
  filtered by the caller's `company_id`, so no client can name another
  company's rows. That replaced the Firestore security rules with something
  the database enforces.
* **`/api/compute`** — stateless. Reads no table; a pure function of the
  snapshot posted to it plus today's date. Authenticates the caller but never
  resolves a company.
* **`/api/bank`** — the only surface that talks to anything outside this
  stack, and the only optional one. Stateless like compute: the browser posts
  the invoices it already holds and gets matches back, and a movement becomes
  a ledger entry only when the user presses the button, through
  `/api/workspace`. With no bank configured every endpoint but `/accounts`
  still works, because CSV import lands in the same normaliser (N19).

Sessions are JWTs signed by the API (`SECRET_KEY`), passwords bcrypt hashes.

**Two clients, one client layer.** `mobile/` does not copy the API client — it
bundles the *actual* `web/src/lib/*.js` files through Metro `watchFolders`, via
a one-line-per-file barrel in `mobile/src/shared/`. So the API client, the
document shapes and the Turkish dictionary cannot drift between web and phone.
See N20.

### Data model

```
companies                 name, taxId, taxOffice, sector, city, legalForm,
                          currency, cashBalance, seeded, ownerUid
users                     email, hashed_password, display_name, role, company_id
company_invoices          number, vendor, direction, issueDate, dueDate,
                          paidDate, netAmount, vatAmount, amount, status,
                          category, source, ocrConfidence, needsReview
company_transactions      date, amount, type, category, description, vendor
company_products          name, sku, stock, minStock, unitPrice, monthlyUsage
company_employees         name, role, grossSalary, startDate, sgkNo
company_tax_obligations   type, name, period, dueDate, amount, status
```

The client still speaks **documents** — camelCase keys, ISO `YYYY-MM-DD` date
strings. `app/services/workspace.py` is the only place that maps documents to
rows, and it is covered by `tests/test_workspace_mapping.py`. Every table also
has an `extra` JSONB column that round-trips keys without a column of their
own, so an unrecognised field is preserved rather than dropped.

## 3. Running it

```bash
cp .env.example .env                  # then set SECRET_KEY: openssl rand -hex 32
docker compose up -d --build          # dev stack; API on :8000
npm --prefix web install && npm --prefix web run dev     # frontend :5173
curl http://localhost:8000/health     # -> {"status":"healthy"}
```

A bare `docker compose` also applies `docker-compose.override.yml` — that is
the development layer (bind-mounts, `--reload`, Postgres on localhost,
web container disabled behind the `ui` profile). **Deploying uses the base file
alone**: `docker compose -f docker-compose.yml up -d --build`. Runbook in
`docs/DEPLOY.md`.

Tests (dev deps are deliberately absent from the runtime image, see N11):

```bash
docker compose exec backend pip install -r requirements-dev.txt
docker compose exec backend python -m pytest
```

The native app (Expo Go on a real phone, same Wi-Fi as the laptop):

```bash
npm --prefix mobile install       # .npmrc pins legacy-peer-deps, see N21
cd mobile && npm start            # scan the QR with Expo Go
```

`mobile/src/boot.js` derives the API address from whichever machine serves the
bundle, so nothing needs configuring — but Windows Firewall must allow inbound
8000 on a Private network, or every request times out. Override with
`EXPO_PUBLIC_API_URL` in `mobile/.env.local` to point at a deployed API.
`npx expo export --platform android` bundles without a device and is the
fastest way to prove the shared layer still resolves.

Environment: root `.env` configures the whole stack and is the only file the
containers read. `backend/.env` is for running the API outside Docker;
`web/.env.local` for the Vite dev server, `mobile/.env.local` for the phone.
All four are git-ignored.

## 4. Current state

**Backend** — FastAPI 0.110, SQLAlchemy 2 (async), Pydantic v2, Alembic
through `0011_drop_legacy_tables`. **4 routers, 27 endpoints, 296 tests.**

- `/api/workspace/*` — company CRUD, generic collection CRUD, bulk insert,
  clear, and two atomic invoice↔ledger operations. **Six** collections now:
  the five business ones plus `vendorCategories`
- `/api/auth/*` — register (account + company in one transaction), login, me,
  company recovery, change password, delete account
- `/api/compute/{dashboard,muhai-score,forecast,tax-summary,payroll,classify,compliance,ocr,chat}`
- Compliance is the rule engine, not a table: duplicate invoices (by number,
  and by amount+date+vendor), KDV that matches no legal rate or exceeds the
  total, and tax deadlines inside their warning window. Stateless like the
  rest, so an alert disappears the moment the invoice is corrected — nothing
  to resolve, nothing to dedupe. `compliance_service.py` is unchanged; the
  compute route just feeds it the snapshot the dashboard already posts
- `/api/compute/classify` takes a `learned` map (vendor key → category) and
  prefers it over the keyword rules. The map is workspace data the browser
  posts with the request, which is how the classifier learns without the
  compute layer ever reading a table. Vendor keys are normalised by
  `expense_classifier.vendor_key()` — folded, punctuation **deleted** so
  "A.Ş." and "AŞ" are one vendor — and `web/src/lib/db.js` must keep applying
  the identical transform
- Assistant has two modes. **Online** it calls `gemini-2.5-flash` over the REST
  endpoint with stdlib `urllib` (override with `GEMINI_MODEL`). **Offline** —
  on any network, quota or key failure — it answers from a local BM25 knowledge
  base plus pre-answered questions and returns `source="offline"`, which the
  chat UI badges. Neither mode needs anything downloaded at runtime (N14)
- `/api/bank/*` — statement import, live fetch and reconciliation. Built
  2026-09-20 on the workspace; the deleted `bank_service.py` was recovered and
  extended. `bank_providers.py` holds a preset per Turkish bank (auth style,
  header names, field vocabulary) and `bank_client.py` the transport: stdlib
  urllib, OAuth2 client-credentials with a cached token, mutual TLS, retry on
  429/5xx and never on 4xx. **Connecting a real bank is an `.env` change, not
  a code change** — see N19 and the `BANK_*` block in `.env.example`
- Prophet 1.1.5 forecasting on real data, moving-average fallback under 10
  points and on any Prophet failure
- Tesseract 5 + `tesseract-ocr-tur`; per-field confidence, threshold 0.7.
  Both paths run **Turkish only at PSM 6**, with the server path also
  preprocessing (grayscale, upscale under 1600 px, autocontrast, unsharp).
  See N18 — the settings matter far more than the model does. The browser-side
  OCR mode is fully vendored under `web/public/tessdata`, so **neither OCR
  path needs internet** (see N13). Confidence is **measured**, not assumed, and
  the vendor is found by legal form rather than by position — see N23
- Muhai Score: 8 weighted categories. Tax engine: 2026 KDV / income / corporate
  / stopaj / SGK / stamp rates
- The user-scoped routes from before the workspace (`/api/invoices`,
  `/api/transactions`, …) and their ten tables were **deleted on 2026-09-13**
  — 14 routers, 10 models, 11 schemas, 4 services, dropped by migration `0011`.
  The API went from 60 endpoints to 21. `tests/test_api_smoke.py` asserts both
  that they are gone and that every mounted path belongs to one of the three
  live routers, so a stray import cannot quietly restore a second, unscoped
  data surface. **`bank_service.py` went with them** — the Turkish bank-CSV
  parser and fuzzy matcher. Recover it from commit `5cb59c0` when bank
  reconciliation gets built on the workspace

**Web frontend** — Vite + React 18, TR/EN, custom SVG charts. Bundle
**506 kB (156 kB gzipped)**, down from 973 kB when the Firebase SDK went.

- Own JWT auth against `/api/auth`, token in localStorage, two-step company
  sign-up, protected `/app`. **There is no password reset** — Firebase used to
  send that mail and self-hosting would need an SMTP sender. Removed on
  purpose (2026-09-08); do not re-add it as a dead button
- `lib/client.js` is the only place that knows where the API is or how a
  request is authenticated. `lib/db.js` is the workspace client, `lib/api.js`
  the compute client
- Writes announce themselves through `db.js`'s `onChange`, and `DataContext`
  reloads (debounced). That replaced Firestore's push updates without making
  seven screens each remember to refetch
- **No mock data anywhere.** Every figure derives from the workspace + the
  compute API
- Falls back to local aggregation with a "hesaplama servisi çevrimdışı" badge
  when the API is unreachable — never a blank screen, never an invented number
- `lib/seed.js` generates a deterministic demo dataset
- **Banka Mutabakatı** (`pages/Bank.jsx`) shows one thing: which movements are
  already in the books and which are not, unmatched first. It fetches when a
  bank is connected and imports a CSV when one is not, and says plainly which
  setting is missing rather than pretending. Verified end to end on
  2026-09-20 against the seeded test company — 4 movements, 2 matched to real
  invoices at %100 and %95, and "Deftere ekle" wrote the ledger entry
- The dashboard's **Uyum & Risk** card renders those alerts, severity-marked,
  with a link back to the offending invoice. Headings and severities are
  TR/EN; the detail sentence is Turkish in both, exactly like the assistant
  insight card above it
- Correcting an invoice's category teaches the classifier: the modal records
  vendor → category on save, the next invoice from that vendor is pre-filled,
  and the hint under the field says whether the answer came from the rules or
  from the company's own correction. Settings lists what has been learned and
  can forget one entry or all of them. Deliberately outside the `COLLECTIONS`
  object that "clear all data" iterates — learned knowledge is not demo data

**Mobile** — a native Expo app exists as of **2026-09-20**, in `mobile/`.
Expo SDK 57, React 19.2.3, RN 0.86.3, expo-router, Expo Go for now (no EAS
build, no store account). Five screens: login/register, dashboard, invoices,
camera→OCR scan, assistant, bank. Tax / Inventory / Payroll / Settings stay
web-only on purpose. The invoice list can mark paid **and delete** (confirmed
through `Alert`, the phone's only dialog) — a scan makes invoices easy to
create by accident, so removing one could not stay web-only.

**It ran on a real Android phone through Expo Go on 2026-09-20**, against the
dev stack over the LAN. Confirmed on the device: Metro resolves `../web/src`
with a single React copy, Hermes accepts `db.js`'s `\p{L}` regex
(`vendorKey('Teknopark Gayrimenkul A.Ş.')` → `teknopark gayrimenkul as`), Intl
formats tr-TR (`₺12.350`, not `₺12,350`), sign-in works, and the
camera→OCR→save path completes. The throwaway `app/setup-check.jsx` proved all
three and was deleted.

Four bugs only a device could find, all fixed that day: the 401 mislabel
(N24), `scan.jsx` mounted outside the `(app)` group so it had neither
`DataProvider` nor the sign-in guard, a camera screen that rendered `busy` but
never `error` (so every failure looked like nothing happening), and the
FormData upload break (N22).

The responsive web app is still the mobile story for the screens the native
app does not have. Landing and auth verified at 375 px on 2026-09-08; the
dashboard signed-in on 2026-09-13 (N17); the Bank screen on 2026-09-20. The
other signed-in screens are still unverified — see open item 1.

## 5. Open items

1. **Walk the signed-in screens on a phone while logged in.** The dashboard
   was measured with a real signed-in account on 2026-09-13 and two more
   overflows were fixed (N17). What is still unchecked is every *other*
   signed-in screen at 375 px with real data: touch targets, the sidebar
   drawer, modals and long lists. There is a test account in the dev database
   now — `compliance-test@example.com` / `TestParola2026!`, seeded.
2. Grow the offline knowledge base. 20 passages cover the common ground; add a
   passage whenever a plausible question falls through to the default reply.
3. **Walk the remaining native screens.** The app runs on a phone now, and
   dashboard, invoices, scan and login were exercised on 2026-09-20.
   **Assistant and bank have not been opened on the device.** Also unverified:
   what the app does when the API disappears mid-session — the shared client
   falls back on web, and nothing has tested that path natively.
4. **Run the bank client against a real sandbox.** The integration is built
   and tested against a scripted bank (90 tests), but no Turkish bank
   credential has ever been through it. When access arrives: set the `BANK_*`
   block, open `/app/bank`, and expect the first fix to be a field name — that
   is what `BANK_FIELD_MAP` is for, and it needs no deploy. Endpoint paths and
   scopes come with the credentials; do not guess them into the presets.

## 6. TEKNOFEST claims that do not match the code

| Claim | Reality | Action |
|---|---|---|
| Slide 4 says **Django** | Code is FastAPI, and staying that way | fix the deck |
| Speech says forecasting is **OLS regression** | Prophet, with a **moving-average** fallback | correct the wording |
| S2 **PostgreSQL 15 + Redis 7** | Redis is **gone** (2026-09-13). Postgres 15 is the only stateful service | drop Redis from the slide |
| S4 **Docker Compose, 4 services** | 3 — postgres, backend, web (plus a one-shot migrate job) | restate |
| S18 **"13 servis geliştirildi"** | 4 routers, 27 endpoints, 296 tests. 17 routers existed until the legacy half was deleted | say "27 uç nokta, 296 test" — a small, defensible surface beats a big one you cannot explain |
| S14 **Expo / React Native shipped** | A native Expo app runs on a real Android phone as of 2026-09-20 (`mobile/`, SDK 57, 5 screens, camera→OCR verified end to end over the LAN). Still **Expo Go only** — no EAS build, no store listing, and it has not run on iOS. | say "Expo ile native mobil uygulama" — it is now true. Do **not** say "yayında"/"mağazada": it runs through Expo Go on a development machine, not as an installable build |
| S3/S16 **GİB / SGK / bank APIs** | **Bank**: a real, config-driven integration exists (`/api/bank`, OAuth2 + mTLS, preset per bank) — but no live credential has run through it yet, and with none configured it falls back to CSV import. **GİB / SGK**: still no external call; the tax routes read a local 2026 calendar and rate table | say "bank integration ready for the bank's API, and a CSV path that works with no internet at all". Do not claim a live GİB or SGK connection |

True as written and needing no change: S1 (Python 3.11 / FastAPI / SQLAlchemy 2
/ Pydantic v2 — drop Celery if the slide names it), S5 (Tesseract 5 + Turkish pack, swappable `OcrEngine`),
S6 (Prophet), S7 (Gemini 2.5 Flash + RAG), S9 (per-field confidence, 0.7
threshold with a working review queue) — S9 became true on 2026-09-20; until
then the "confidence" was a table of constants (see N23), so if anyone has
demoed that number before today, they demoed a literal.

## 7. Conventions and gotchas

- **N1 — Avoid unnecessary rebuilds.** `docker-compose.yml` declares `image:`
  alongside `build:` so existing images are reused. Rebuild only when
  `requirements.txt`, `package.json` or a `Dockerfile` changes.
- **N1b — Pins in `requirements.txt` carry comments explaining why.** Do not
  bump `cmdstanpy` without re-running `tests/test_forecast_service.py`; that pin
  is what makes Prophet load at all.
- **N2 — The compose project name is pinned** (`name: muhai`) so `postgres_data`
  resolves to the existing `muhai_postgres_data`. Changing it orphans the DB.
- **N3 — `.dockerignore` excludes `tests/` and `.env`.** That is how they were
  lost once. Keep them in git. The dev override bind-mounts `./backend`, which
  is what puts the tests back inside the container.
- **N4 — Migrations belong to the one-shot `migrate` service**, not to app
  startup: several uvicorn workers would race for the same lock. The app's own
  startup hook still runs them when `RUN_MIGRATIONS_ON_STARTUP` is true, which
  is the default outside Docker and in the dev override.
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
- **N10 — `web/public/sample-invoice.png`** is a synthetic Turkish invoice for
  exercising OCR (net 12.350, KDV 2.470, total 14.820).
- **N11 — `pytest` is not in the runtime image.** Run
  `docker compose exec backend pip install -r requirements-dev.txt` once after
  any `docker compose down` or rebuild. The dev override runs the backend as
  root for exactly this reason — the image's own user cannot write to
  `/opt/venv`.
- **N12 — The API does not come back by itself after a reboot.** The containers
  restart, but only once the Docker *daemon* runs, and Docker Desktop's
  autostart is currently off. With Docker down the app shows "hesaplama servisi
  çevrimdışı" and the assistant drops to the keyword fallback.
- **N13 — Browser OCR assets are vendored, not fetched.** `web/public/tessdata`
  holds the worker, both LSTM wasm cores and the gzipped `tur` traineddata
  (English was dropped on 2026-09-13, see N18);
  `web/src/lib/ocr.js` passes `workerPath`, `corePath` and `langPath` so
  nothing is pulled from a CDN. `.gitattributes` marks the directory `-text`
  because the cores inline their wasm as base64 and a CRLF rewrite would
  corrupt them. If you upgrade `tesseract.js`, re-copy the worker and cores
  from `node_modules` — a version mismatch between worker and core fails at
  init, not at build.
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
- **N15 — Measure mobile layout, do not eyeball it.** Inject a representative
  element at a 375 px viewport and compare `scrollWidth` against the parent's
  `clientWidth`. That is how the two real overflows were found — a nine-column
  table at 684 px in a 341 px panel, and a five-button `.seg` at 389 px — while
  `.ocr-fields` and `.ocr-item`, which looked equally suspect in the CSS,
  measured clean. Wide content scrolls in its own container (`.tbl-scroll`,
  and `.seg` below 760 px); the page body must never scroll sideways.
- **N16 — In production the browser and the API share an origin.** nginx in the
  web container proxies `/api` to the backend, so `VITE_API_URL` is empty in a
  Docker build and CORS never applies. `BACKEND_CORS_ORIGINS` matters only for
  the Vite dev server, which is on a different port.

- **N17 — A grid item's `min-width: auto` beats its child's `overflow-x`.**
  `.dash-invoices` has a `.tbl-scroll` around its table, and the page still
  scrolled sideways on a phone: the item's automatic minimum is its table's
  min-content width, so the *track* grew to 602 px at a 375 px viewport and
  the scroll container never got the chance to scroll. `.dash-grid > * {
  min-width: 0 }` hands the overflow back to `.tbl-scroll`. The same block
  also had to re-collapse `grid-template-columns`, because the later
  `.dash-grid` rule in `pages.css` out-ordered the media query at the top of
  the file and the dashboard had been two-column on mobile all along.
  Measure with `document.body.scrollWidth` against `clientWidth` (N15).

- **N18 — OCR: the config beats the model. Measured, 2026-09-13.** The
  temptation is to download a bigger traineddata file. Benchmarked on
  `sample-invoice.png` across four simulated capture conditions (clean, phone
  photo, dim light, photographed from too far), scoring four fields each:

  | change | score | speed |
  |---|---|---|
  | before — `tur+eng`, PSM 3, no preprocessing | 25/32 | 0.30 s |
  | `tessdata_best` tur (7.5 MB download) | 25/32 | ~40% slower |
  | drop `+eng` | 26/32 | faster |
  | **PSM 6 instead of PSM 3** | **28/32** | faster |

  `tessdata_best` was *not better even once*. PSM 3 runs full layout analysis
  and reads an invoice as two columns, so amounts land on different lines from
  their labels and `_extract_fields` — which matches per line — sees
  "Ara Toplam:" with no number. PSM 6 treats the page as one block. Running
  `tur+eng` makes Tesseract reconcile two dictionaries against Turkish text
  and loses fields rather than winning them. Preprocessing is what rescues a
  distant photo (1/4 fields → 3/4); it does nothing for a clean scan. If you
  do revisit the model, re-run the benchmark rather than assuming — and
  remember any model must be baked into the image, never fetched at runtime
  (N13).

- **N19 — A bank connection is configuration, not code.** Turkish banks hand
  out the gateway host, the paths and the scopes *with* the credentials; they
  are not published, and a hostname written from memory fails in front of the
  audience. So `bank_providers.py` presets carry only what is stable — auth
  style, header names, field vocabulary — and every endpoint detail comes from
  `BANK_*` in the environment. Three consequences worth knowing before
  touching that code: field lookup is **tolerant** (candidate keys, folded and
  case-insensitive, descending into nested objects, covering Turkish, ISO
  20022 and English at once), so an unfamiliar response shape usually works
  first try and `BANK_FIELD_MAP` fixes the rest without a deploy; the
  `mock` provider serves a deliberately awkward statement (Turkish decimals,
  borç/alacak flag, nested amount) with no network, which is what to demo on;
  and CSV import is not a fallback bolted on, it is the same normaliser, so
  nothing about the feature depends on a bank saying yes.

- **N20 — `web/src/lib/*` has two consumers now.** The Expo app bundles those
  files directly (Metro `watchFolders` → `mobile/src/shared/`), so a change
  there ships to the phone as well as the browser, and **no web test will
  catch a break**. Three rules keep it working: no `import.meta` anywhere in
  the shared files — Metro cannot *parse* it, so the whole mobile bundle dies
  with a syntax error pointing at a web file; no `window`/`document`/
  `localStorage` — put those in `main.jsx` or the page layer; and no importing
  `ocr.js`, which `metro.config.js` blocks outright. The platform facts are
  injected at boot instead: `configureClient({ baseUrl, tokenStore, token })`,
  called from `web/src/main.jsx` and from `mobile/src/boot.js`. `apiBaseUrl`
  is an `export let` live binding so the re-export in `api.js` and the read in
  `Settings.jsx` needed no change — do not snapshot it at module scope.
  Enforced, not just documented: **`npm --prefix mobile run check:shared`**
  reads the barrel, follows it into `web/src`, strips comments and string
  literals, and fails on `import.meta` or an un-feature-detected browser
  global. A plain grep was tried first and was useless — it matched prose
  about `localStorage` and the deliberate adapter in `client.js`, so it cried
  wolf every run. `analytics.js` had a local `Set` named `window`; it is
  `span` now, because shadowing a browser global in a shared file is a trap
  for every future reader as well as the checker.

- **N21 — `mobile/.npmrc` pins `legacy-peer-deps=true`, deliberately.** Expo 57
  ships `react@19.2.3` while `@expo/devtools` pulls `react-dom@19.3.0`, which
  peer-requires `react@^19.3.0`; npm's strict resolution refuses the tree.
  Worse, *mixing* `npx expo install` with a plain `npm install` prunes
  transitive dependencies and leaves Metro unable to resolve `expo-asset`. If
  the bundler starts reporting a missing package nobody removed, delete
  `mobile/node_modules` and `package-lock.json` and install once.

- **N22 — Expo SDK 57 killed React Native's `{uri, name, type}` upload.** SDK 57
  replaces the global `fetch` with the winter runtime's, and its
  `convertFormDataAsync()` accepts only a `Blob`, a `File`, or an object
  exposing `bytes()`. Handed RN's long-standing `{uri}` part it throws
  **"Unsupported FormDataPart implementation"** — in JS, *before any request
  leaves the phone*, so the shared client reports it as
  "Sunucuya ulaşılamıyor" and the server log stays empty. Two hours went into
  the firewall, the file and the server before the message was traced to
  `expo/src/winter/fetch/convertFormData.ts`, whose own comment says "`uri` is
  not supported for React Native's FormData". The fix is
  `new File(uri)` from **expo-file-system**, whose `File` implements `Blob` —
  so `scanInvoice()` in the shared `api.js` still just appends what it is
  handed, exactly as it does on the web with a `File` from an `<input>`.
  A `Blob` would *not* work: RN's `FormData.getParts()` spreads it into an
  empty object and you get the same error from the other end.

- **N23 — OCR confidence is measured now; it used to be a table of constants.**
  Every field returned a literal — vendor `0.6`, invoice no `0.85`, date and
  total `0.8`, KDV `0.75` — and the review badge is
  `min(vendor, number, total)`, so it read **exactly 60% on every invoice ever
  scanned**, pristine or blurred. `image_to_data` gives per-word confidence
  Tesseract was already computing and the code discarded; the engine now reads
  the page **once** and returns lines with scores, and each field multiplies
  the rule's own certainty by the measured quality of the line it came from.
  Two traps if you touch this: an amount's parsed float (`14820.0`) never
  appears in the text (`14.820,00`), so amount fields must carry their source
  line or they silently keep the old constant; and `OcrEngine.image_to_lines()`
  defaults to `[]` so a cloud provider can still be dropped in without it.
  Vendor extraction changed with it — it was "first mostly-alphabetic line",
  which is fine on a clean scan and wrong on a photo, where the top of the
  frame is glare, the paper edge or the word "FATURA". It now matches the
  legal form (`A.Ş.`, `Ltd. Şti.`, `San.`, `Tic.`), which is near-proof on a
  Turkish invoice and indifferent to position. Measured against four capture
  conditions: 4/4 fields on clean, handheld and dim (vendor ~0.84), collapsing
  to 1/4 and 0.49 with `needs_review` on a too-distant shot. Re-run that
  benchmark rather than assuming, exactly as N18 says.

- **N24 — A 401 only means "session expired" when a token was sent.** The
  client intercepted *every* 401 before reading the body and replaced it with
  "Oturumunuzun süresi doldu. Tekrar giriş yapın." On `/api/auth/login`, which
  is called with `auth: false`, that discarded the API's own
  "E-posta veya şifre hatalı." and told someone with a mistyped password to
  log in again — the one instruction that could not help. `request()` now
  requires a token to have been sent before treating a 401 as session expiry.
  Affected the web app just as much; it only surfaced on the phone because
  that was the first time anyone mistyped the password.

- **N25 — Mobile defaults to Turkish regardless of the phone's locale.** It
  used to read `expo-localization` and hand an English-set handset an English
  app. Wrong default for this product: the invoices, the tax vocabulary and
  the customers are Turkish, and plenty of that market carries an English
  phone. `LanguageContext` now starts at `tr` and only a stored choice moves
  it. Because the native app has **no Settings screen**, that change would
  have made English unreachable, so the `TR / EN` control on the login screen
  is load-bearing — do not remove it without adding another way through.

The 2026-09-01 data-loss recovery is history now; `docs/RECOVERY.md` was
deleted in ca3f72f. The dump that survived it is `db_backup/`, and the
technique that saved the source is N8 above.
