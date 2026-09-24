# Muhai — project state and next steps

**Muhai / MuhAI** — AI-powered accounting & finance OS for Turkish SMEs.
TEKNOFEST 2026 Financial Technologies. Team Nasimi BHOS · Team ID 821808 ·
Application ID 4579275 · Baku Higher Oil School.

Auto-loaded each session. Read it before starting; update it when facts change.
**Keep it lean — delete finished work rather than striking it through.**

Last verified: **2026-09-24**.

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
     │   Tesseract OCR · assistant + agent (a model online, BM25 offline)
     │
     ├── agent tool loop ──▶ reads the company's own tables, read-only
     │   renders typed blocks → report artifact → WeasyPrint PDF
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

Four surfaces to the API — two that own the product, one that reasons over it,
one that is optional:

* **`/api/workspace`** — the data layer. Company profile plus five
  collections. The signed-in token *is* the company scope: every query is
  filtered by the caller's `company_id`, so no client can name another
  company's rows. That replaced the Firestore security rules with something
  the database enforces.
* **`/api/compute`** — stateless. Reads no table; a pure function of the
  snapshot posted to it plus today's date. Authenticates the caller but never
  resolves a company.
* **`/api/agent`** — company-scoped like the workspace, and the *only* other
  surface that reads those tables. It exists rather than living inside
  `/api/compute` because the agent has to decide what to read and then read
  it, which a stateless layer cannot do. Its access is **read-only by
  construction**: `agent_tools.py` contains no create, update or delete, so
  there is no write for a model to reach (N29).
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

agent_conversations       title, pinned, messageCount, lastMessageAt
agent_messages            role, content, source, blocks, toolCalls, artifactIds
agent_artifacts           kind, title, subtitle, period, blocks
```

The three `agent_*` tables (migration `0012`) hang off `company_id` exactly
like the rest, so deleting a company takes its chat history with it. They are
**not** workspace collections: they are the agent's own memory, they carry no
`extra` round-trip contract, and `db.js`'s `COLLECTIONS` does not list them —
"clear all data" must not wipe a conversation.

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
through `0013_agent_attachments`. **5 routers, 39 paths / 47 operations,
436 tests.**

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
- **The model vendor is configuration (2026-09-24).** `services/llm.py` is the
  only file that knows a provider exists: `AI_PROVIDER` picks `openai` /
  `gemini` / `offline`, empty auto-selects whichever key is set (OpenAI first),
  and the assistant, the agent loop and the expense classifier all go through
  it. Defaults `gpt-4o-mini` and `gemini-2.5-flash`, overridable per provider.
  **This machine's `.env` runs `AI_PROVIDER=openai` on `gpt-6-luna`** as of
  2026-09-24, verified live: a plain answer and a full tool round trip. It is
  a *reasoning* model, which is the whole reason N30's second repair exists.
  `OPENAI_BASE_URL` points the OpenAI path at any compatible gateway — Azure,
  OpenRouter, LiteLLM, a local Ollama — and a base URL alone is enough to go
  online, since a gateway on your own network authenticates nothing. Both
  transports are **stdlib urllib**: no `openai` package, no
  `google-generativeai`, so a model change never rebuilds the image. See N30
- Assistant has two modes. **Online** it calls the configured provider.
  **Offline** — on any network, quota or key failure, or with no key at all —
  it answers from a local BM25 knowledge base plus pre-answered questions and
  returns `source="offline"`, which the chat UI badges. Neither mode needs
  anything downloaded at runtime (N14)
- **`/api/agent/*` — the agent (2026-09-24).** Conversations, grounded answers
  and report artifacts. Seven paths: `capabilities`, conversation list /
  create / read / rename+pin / delete, `conversations/{id}/ask`, and
  `artifacts`, `artifacts/{id}`, `artifacts/{id}/pdf`. One turn loads the
  whole workspace once, runs the model's tool calls against that one copy
  (so two tools in an answer cannot disagree about the data) and stores both
  messages. `ask` runs the model in `asyncio.to_thread` — blocking urllib plus
  a Prophet fit on the event loop would stall every other request behind it
- **16 read tools + 7 render tools** (`agent_tools.py`). Reads: company
  profile, invoices, transactions, products, employees, tax obligations,
  financial summary, expense breakdown, top counterparties, Prophet forecast,
  Muhai Score, tax summary, payroll, compliance, tax calendar, learned
  categories. Renders: heading, text, KPI row, chart, table, callout and
  `create_report`. **There is no write tool** — that, not the prompt, is the
  read-only guarantee, and `test_agent_tools.py` asserts it
- Answers carry **typed blocks** beside the prose, never markdown that each
  end has to re-parse. `agent_blocks.py` is the schema and three renderers
  read it: React in the thread, React again in the report pane, and
  `report_pdf.py` into a PDF. `normalise()` is the boundary — a malformed
  block is dropped, because the React side has no error boundary and one bad
  chart would cost the whole answer
- **Reports are WeasyPrint PDFs**: A4, running footer with the company and the
  page number, charts drawn as plain SVG in Python. `weasyprint` and `pydyf`
  are both pinned — see the comment in `requirements.txt`, they break in a way
  that only shows at render time. The runtime image carries Pango, Cairo,
  GDK-PixBuf and DejaVu (the font that has `₺`). Missing those gives a **503
  with an explanation**, not a 500: the report is still readable on screen
- `/api/bank/*` — statement import, live fetch and reconciliation. Built
  2026-09-20 on the workspace; the deleted `bank_service.py` was recovered and
  extended. `bank_providers.py` holds a preset per Turkish bank (auth style,
  header names, field vocabulary) and `bank_client.py` the transport: stdlib
  urllib, OAuth2 client-credentials with a cached token, mutual TLS, retry on
  429/5xx and never on 4xx. **Connecting a real bank is an `.env` change, not
  a code change** — see N19 and the `BANK_*` block in `.env.example`
- Prophet 1.1.5 forecasting on real data, moving-average fallback under 10
  points and on any Prophet failure
- **The agent takes photos and PDFs (2026-09-24), and the model reads the
  file itself.** Paperclip, drag-and-drop or paste in the composer; the file
  uploads at once to `POST /api/agent/attachments` (10 MB, five a message,
  bytes kept in Postgres in `agent_attachments`, unsent uploads swept after
  a day). On `ask`, the photo or PDF goes to the model **as a file**:
  OpenAI `image_url` / `file` content parts, Gemini `inline_data`
  (`llm.FilePart`). Photos are sent upright and capped at 2048 px
  (`document_reader.for_model`); files are sent within a 12 MB request budget,
  this question's first, then earlier questions' newest first, so follow-ups
  still see the document. Text extracted on upload (a PDF's own text layer, or
  Tesseract) is only the backup: used if the vendor refuses files (a 4xx
  triggers one retry with the text) and for the offline answer. Verified live
  on `gpt-6-luna` with a photo and a PDF: see N32 for what it gets wrong. The
  agent stays read-only; it points to "Fatura yükle" to save an invoice
- Tesseract 5 with **tessdata_best's Turkish model, vendored at
  `backend/tessdata/tur.traineddata`** (the apt package ships the "fast"
  one); `OCR_TESSDATA_DIR` overrides. Per-field confidence, threshold 0.7.
  `/api/compute/ocr` also takes PDFs and reads their text layer, which is
  exact.
  Both paths run **Turkish only at PSM 6**, with the server path also
  preprocessing (EXIF rotation, grayscale, upscale under 1600 px,
  autocontrast — **no sharpening**, see N18). The settings matter far more
  than the model does. Both paths report the page's **mean word confidence**
  as the document figure; the server's per-field scores still mark doubtful
  fields and decide `needs_review`. The browser-side
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
**567 kB (175 kB gzipped)** — 543/168 before the agent screen, and 973 kB
when the Firebase SDK was still in it.
**Nothing in the repo depends on Firebase any more** (2026-09-24) — see
"sign-in" below.

**One design language, everywhere (2026-09-24).** The marketing page and
the product used to be two products: `.lp` on the landing page (Inter
Tight, #ebeff5 ground, #35363b ink-dark, #d9ff5c lime) and a blue-forward
console on Cal Sans + Manrope. The console and the auth screens now render
the landing language.

- `styles/console.css` is still a **token override scoped to `.app-shell`**
  — that is what moves 3,000 lines of component CSS at once — but the
  tokens it sets are the landing page's, restated. Read its header before
  changing a colour in here
- **Dark acts, lime marks.** A button, the avatar, the compose tile: dark.
  The live rail tile, the selected segment, the assistant's icon: lime.
  Neither is decoration and neither appears twice in one card
- `styles/auth.css` is the landing language too, and `/login`, `/register`
  and the company-setup screen render **inside a `.lp` element** so they
  read landing.css directly rather than restating it
- `components/ui/lp.jsx` holds the landing primitives — the arrow, the
  chip button, the eyebrow pill, the two flags — extracted from
  `Landing.jsx` because the auth screens render the same controls and a
  second copy would drift (see N26)
- **The logo is the word.** `components/ui/Logo.jsx` (the "M" glyph) is
  deleted; the wordmark is Syne at -0.02em and nothing sits beside it.
  `LanguageToggle.jsx` went with it — the language control is the landing
  page's two drawn flags, on every surface
- The console's bar is **flush and full width**, not the landing's floating
  pill: a rounded slab hovering over the work reads as a card competing
  with the real ones. Its contents are padded to line up with `--measure`
- `--measure` is **1640px**. At 1280 a 1920 window had ~300px of dead page
  either side while the invoice table wrapped its date columns
- **One theme: light.** The dark palette, `ThemeContext`, the rail's theme
  tile, the landing footer's toggle and the pre-paint script in
  `index.html` were all deleted on 2026-09-24. Do not re-add a toggle
- **One gap: 16px.** `.page` is a flex column and every grid on it takes
  the same 16, so a two-column row and the stack around it share a rhythm.
  Ad-hoc block margins are zeroed at the top level (`.page > *`) rather
  than hunted down — see N28
- Icons are **Lucide at stroke 1.5 on the 24 grid**, the weight
  `landing.css` sets for its own. The assistant's mark is not Lucide:
  `components/ui/icons.jsx` draws `Spark`, one **filled** four-point star.
  Filled matters — a stroked star at 15px is four thin outlines and a
  hole, and it is the hole you see. `Sparkles` appears nowhere now
- **Nothing floats over the page.** The bottom dock (`Dock.jsx`,
  `AppDock.jsx`, `dock.css`), the assistant launcher and its popover
  (`ChatWidget.jsx`, `SiteChat.jsx`, `site-chat.css`) and the dashboard's
  compose FAB are deleted. The assistant has its own room in the rail; the
  rail's "Oluştur" tile only went to `/app/invoices`, which is the tile
  directly beneath it

- **The agent screen is a room, not a page (2026-09-24).** `/app/assistant`
  renders `pages/Agent.jsx`: a full-height three-column grid — previous chats,
  the conversation, and the open report — under the topbar, each column
  scrolling on its own. It is the one signed-in screen that does **not** use
  `.page`, `--measure` or the 16px rhythm, because a conversation with a
  document beside it is a workspace and a workspace that paginates is
  unusable. It still speaks the console's language: same ink, same lime for
  what is live, same Inter Tight, same categorical ramp on the charts
  (`styles/agent.css`, which introduces no colour of its own)
  - a thread is created **lazily**, on the first question. Landing on the
    screen and immediately owning an empty "Yeni sohbet" is how a chat list
    fills with noise
  - `components/agent/AgentBlocks.jsx` renders the block schema and
    `AgentChart.jsx` draws bar / line / area / donut with the *same*
    arithmetic `report_pdf.py` uses — same viewBox, same padding, same tick
    rule. Change a constant in one and change it in the other
  - the tool trace under each answer is collapsed by default and lists what
    the agent read. An answer about money has to be able to show its work
  - a report opens in the right pane automatically when a turn writes one,
    and "PDF indir" fetches the bytes **with the auth header** and hands over
    a blob — never `?token=` in a URL, which would put the session token in
    the browser history, the Referer and every proxy log in between
  - "Yazdır" prints the report and nothing else; the `@media print` block in
    `agent.css` hides the rail, the topbar and the conversation
- The old one-shot chat is **gone**: `pages/Assistant.jsx`,
  `components/chatbot/*` and `styles/chat.css` were deleted with it, along
  with their skin in `console.css` and `pages.css`. The native app still
  calls `/api/compute/chat`, which is untouched
- Own JWT auth against `/api/auth`, token in localStorage, two-step company
  sign-up, protected `/app`. **There is no password reset** — Firebase used to
  send that mail and self-hosting would need an SMTP sender. Removed on
  purpose (2026-09-08); do not re-add it as a dead button
- **Sign-in is email + password, and nothing else (2026-09-24).** "Continue
  with Google" is gone and so is Firebase, which was in the tree for that one
  button: `lib/firebase.js`, `components/auth/GoogleButton.jsx`, the
  `firebase` dependency, `AuthContext`'s `loginWithGoogle` / redirect leg /
  `signOutOfGoogle`, the `auth.google*` strings, `.lp-google` and `.lp-or`,
  and on the server `/api/auth/google`, `services/google_identity.py`,
  `schemas.GoogleAuth`, `FIREBASE_PROJECT_ID` and
  `tests/test_google_identity.py`. That removes the last third party from the
  auth path and the last thing in `.env` naming a Firebase project. Recover it
  all from commit `4f1d785` if a federated sign-in is ever wanted — but
  re-adding it means re-adding a dependency on someone else's console
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

1. **Web `/app/bank` does not exist.** `web/src/pages/Bank.jsx` was deleted
   in `96fe445` and `App.jsx` has no route for it, so the Banka Mutabakatı
   screen described under "Web frontend" is not reachable — the backend's
   `/api/bank` and the native app's bank screen are both still there.
   Recover the page from `46b6d80` and re-skin it to the console language,
   or drop the claim.
2. **Touch targets and drawers on a phone.** All seven signed-in screens
   plus `/login` and `/register` were measured at 375px on 2026-09-24 with
   a real signed-in account and real data: nothing scrolls sideways, every
   table scrolls inside `.tbl-scroll` (N15/N17 hold). What that pass did
   *not* judge is touch-target size, the modals, or long lists under a
   thumb. Test account in the dev database: `ui-test@example.com` /
   `TestParola2026!`, filled by
   `docker compose exec backend python -m scripts.seed_demo --email
   ui-test@example.com --password 'TestParola2026!'`.
3. Grow the offline knowledge base. 20 passages cover the common ground; add a
   passage whenever a plausible question falls through to the default reply.
4. **Walk the remaining native screens.** The app runs on a phone now, and
   dashboard, invoices, scan and login were exercised on 2026-09-20.
   **Assistant and bank have not been opened on the device.** Also unverified:
   what the app does when the API disappears mid-session — the shared client
   falls back on web, and nothing has tested that path natively.
5. **Run the bank client against a real sandbox.** The integration is built
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
| S18 **"13 servis geliştirildi"** | 5 routers, 39 paths / 47 operations, 436 tests. 17 routers existed until the legacy half was deleted | say "47 uç nokta, 436 test" — a small, defensible surface beats a big one you cannot explain |
| Anything claiming the assistant **"acts on"** your books | The agent reads 16 data sources and writes nothing: there is no create/update/delete tool for it to call (N29) | say "salt okunur" and mean it — it is a stronger claim than autonomy, and it is true |
| S14 **Expo / React Native shipped** | A native Expo app runs on a real Android phone as of 2026-09-20 (`mobile/`, SDK 57, 5 screens, camera→OCR verified end to end over the LAN). Still **Expo Go only** — no EAS build, no store listing, and it has not run on iOS. | say "Expo ile native mobil uygulama" — it is now true. Do **not** say "yayında"/"mağazada": it runs through Expo Go on a development machine, not as an installable build |
| S3/S16 **GİB / SGK / bank APIs** | **Bank**: a real, config-driven integration exists (`/api/bank`, OAuth2 + mTLS, preset per bank) — but no live credential has run through it yet, and with none configured it falls back to CSV import. **GİB / SGK**: still no external call; the tax routes read a local 2026 calendar and rate table | say "bank integration ready for the bank's API, and a CSV path that works with no internet at all". Do not claim a live GİB or SGK connection |

True as written and needing no change: S1 (Python 3.11 / FastAPI / SQLAlchemy 2
/ Pydantic v2 — drop Celery if the slide names it), S5 (Tesseract 5 + Turkish pack, swappable `OcrEngine`),
S6 (Prophet), S7 (RAG over a swappable model — OpenAI or Gemini, `AI_PROVIDER`;
name whichever one the demo machine is configured for rather than the slide), S9 (per-field confidence, 0.7
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
  **2026-09-24: the server path scored 16/28 against the browser's 27/28**
  on seven captures of the sample invoice, with the same engine and the same
  `tur` model (both are the fast `Lfx128` network). Two causes, neither the
  model nor the parser (the server parser on the browser's text: 27/28).
  Pillow does not apply the EXIF Orientation tag unless asked, and phones
  store portrait shots as landscape pixels plus that tag, so every portrait
  photo was read sideways (0/4; tesseract.js honours the tag). And the
  unsharp mask turned sensor noise on a dim photo into speckle: grayscale
  alone 3/4, grayscale + unsharp 0/4. `_prepare` now calls
  `ImageOps.exif_transpose` first and does not sharpen; 27/28 after. The
  route runs `scan_invoice` in `asyncio.to_thread` (inline, one photo
  froze the whole API) and the image sets `OMP_THREAD_LIMIT=1`.

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
  **This broke once already.** Commit `96fe445` swapped in a `web/` from
  before the native app existed: `lib/bank.js` and `lib/invoiceDraft.js`
  vanished, `client.js` went back to `import.meta` without
  `configureClient` (and lost N24), and the `window` above came back. Metro
  reported only the first missing file. All restored 2026-09-24 from
  `ba5ccf3` and verified with `check:shared` plus `npx expo export
  --platform android`. If `web/` is ever replaced wholesale again, run both
  before anything else. Mobile `t()` keys also live in the web dictionary
  (`bank.*`, `nav.bank`, `common.error`), so do not prune them as unused.

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

- **N26 — `.lp button` out-specifies every `.lp-*` class.** landing.css
  strips buttons to `background: none; border: 0` at (0,1,1) — one class
  and one element — which beats a plain `.lp-btn` at
  (0,1,0). Nothing noticed for as long as the chip button was only ever a
  `<Link>`; the first real `<button type="submit">` on /login came out
  white and borderless. Any button rule written for a `.lp` surface needs
  the extra class (`.lp button.lp-btn`). The same trap
  caught a media query in auth.css: `@media { .lp-auth__pitch {
  display: none } }` sat *above* the block that sets `display: flex`, same
  specificity, so the later rule won and the dark panel stayed on phones.

- **N27 — The console's chip button carries one label, not two.** The
  landing control renders its label twice so the lime chip can sweep the
  second copy into view. `<button class="btn">` in the console has one
  child list and no chip, so it runs the same idea with a `::before` lime
  panel inset 3px that scales from the left under the text. `isolation`
  on the button plus `z-index: -1` on the sweep is what keeps it behind a
  label nobody had to wrap in a span — do not remove either.

- **N28 — Spacing is a flex gap, not a pile of margins.** Measured on the
  dashboard before this: the banner sat 10px above the figure band, the
  band 21px above the insight card, that 12px above the day strip and the
  strip 25px above the chart — four gaps, four values, none chosen.
  `.app-shell .page` is `display: flex; gap: 16px` and
  `.app-shell .page > *` zeroes top-level margins, so a stray
  `margin-bottom` in `pages.css` or an inline `style={{ marginBottom: 20 }}`
  cannot add to the gap. If a block needs different air, it does not.
  Two related traps found the same day: `.dash-cols` on the dashboard had
  **no rule anywhere**, so its four half-width cards stacked at full page
  width with a gauge adrift in each; and the charts carried a fixed pixel
  `height` beside an 880-unit `viewBox`, so a wide card letterboxed the
  drawing *and* mis-mapped the crosshair, which reads the pointer through
  `rect.width` — the whole element, letterbox included.

- **N29 — The agent: what makes it safe, and the two shapes it produces.**
  Four things about `/api/agent` that are not obvious from reading it.
  **Read-only is structural, not prompted.** `agent_tools.py` has no create,
  update or delete function in it, so there is nothing for a jailbroken
  prompt to reach — and no tool takes a company id, so scope comes from the
  resolved token and a hallucinated id has nowhere to go. Both are asserted
  in `test_agent_tools.py`; keep them asserted if you add a tool.
  **A report is bound when the turn ends, never when `create_report` is
  called.** The first design bound eagerly and told the model to call the
  render tools first and `create_report` last. It cannot do that reliably:
  it emits a whole batch of calls in one response and orders that array
  itself. Measured on a five-section report — `create_report` came *fourth
  of thirteen*, bound nothing, and the nine blocks after it fell loose into
  the chat. Asking for a report is a flag on `ToolContext` now, and the
  ordering problem is gone.
  **Blocks are a contract between three renderers**, not markdown. React
  draws them in the thread, React draws them again in the report pane and
  `report_pdf.py` draws them into a PDF; `agent_blocks.normalise()` is the
  only thing between a malformed function call and a blank answer, because
  none of the three has an error boundary worth the name. A short series is
  padded rather than shifted — a hole in a chart is honest, a series slid
  one category left is not.
  **The round budget is measured.** Six was the first number and a full
  quarterly report blew through it: the model batches its *reads* but not
  its render calls — heading, look, chart, heading, one round each. That
  report took 14, so the budget is 16 and hitting it answers with what was
  gathered rather than erroring.

- **N29b — WeasyPrint: the two pins and the one CSS property it drops.**
  `weasyprint==61.2` declares `pydyf>=0.8.0`, so a fresh install resolves
  0.11 — whose `PDF()` constructor no longer takes the version and
  identifier. Every render then dies with "PDF.__init__() takes 1 positional
  argument but 3 were given", **at render time, not import time**, so the API
  starts perfectly and only the download fails. Both are pinned; re-render a
  PDF before bumping either. Second trap: WeasyPrint 61 lays out flex
  containers but drops `gap` as an unknown property, so every gap in
  `report_pdf.STYLESHEET` is a margin — the masthead read
  "2026 3. ÇeyrekOluşturulma: 2026-09-24VKN: …" before that was found. Third:
  the charts are hand-built SVG with no filters, no `foreignObject` and no
  embedded CSS, because a chart that renders in a browser preview and
  silently vanishes in the PDF is the worst possible failure for a document
  someone is about to send their accountant.

- **N30 — One model seam, two vendors, and they are not symmetric.**
  `services/llm.py` is the only file allowed to know a provider exists.
  Everything above it — `chat_service`, `agent_service`,
  `expense_classifier` — sees `complete()`, `tool_session()` and a
  provider-neutral `Step`/`ToolCall`, never a `functionCall` or a
  `tool_calls`. Four things to know before touching it:
  **Tool schemas have one source.** They are written in `agent_tools` in
  Gemini's uppercase OpenAPI dialect and lower-cased for OpenAI by
  `llm._json_schema`. Do not add a second copy: that is how a tool gains an
  argument on one vendor and not the other.
  **The empty-schema rule differs.** Gemini rejects an `OBJECT` with no
  `properties` with a 400 that names no field, so `_gemini_declarations`
  omits `parameters` entirely; OpenAI wants the empty object. Tested both
  ways in `test_llm_provider.py`.
  **Results correlate differently.** OpenAI matches a result to its call by
  `tool_call_id` and needs the assistant message echoed back before the
  `role: "tool"` messages; Gemini matches by tool *name*. `ToolCall` carries
  an `id` for exactly this and the loop never branches on provider.
  **Reasoning models 400 on knobs everything else accepts, and only at
  request time** — there is no capability flag to read first. `_openai_post`
  reads the body (the default `HTTPError` message is "Bad Request" and
  nothing else) and repairs up to twice, since each 400 names only the first
  thing it tripped over: drop `temperature`, then set
  `reasoning_effort: "none"`. The second one is not a guess — `gpt-6-luna`
  answers a plain completion happily and rejects the identical request with
  tools attached: *"Function tools with reasoning_effort are not supported
  for gpt-6-luna in /v1/chat/completions ... set reasoning_effort to
  'none'"*. Thinking and tool use are exclusive there, and this agent's
  reasoning **is** the tool loop, so turning the internal one off is the
  right trade rather than a workaround. `OPENAI_REASONING_EFFORT` sets it
  deliberately; you do not need it for tool calls to work.
  Tests patch at `llm.complete` / `llm._openai_post` / `llm._gemini_post`,
  not at `urlopen` — a test that reaches past the seam into the transport
  passes for one vendor and quietly stops covering the other.

- **N31 — A chart re-skin must keep the layout block.** `console.css`'s
  chart section holds two kinds of rule: skin (colour, type) and layout
  (`.ck__plot { position: relative }`, `.ck-tip { position: absolute }`,
  the legend's flex, the band swatch's size). The 2026-09-24 re-skin kept
  only the skin. The readout card then fell into the flow as a full-width
  block under the plot, and past 58% of the width `ChartTooltip`'s flip,
  `translate(calc(-100% - 14px))`, moved it by its own width, the whole
  card, off the screen, on both the forecast and the cash-flow chart.
  Restored and measured from 10% to 99% of the width.

- **N32 — Turkish OCR, measured, and what the model gets wrong.** On 56
  synthetic Turkish invoices (12 fonts, four capture conditions, half held
  out), Turkish letters read correctly: Tesseract fast 97.0%, **best 98.6%**,
  EasyOCR 86.5%, **PaddleOCR/RapidOCR Latin 58%** (İ→I and ı→i by the
  hundred; 0/28 vendor names exact). Do not switch to PaddleOCR for Turkish.
  Fields on the held-out half: fast 101/136, best 107/136. Two tricks that
  looked good on the tuning half (merging fast+best reads, trimming specks
  off the vendor line) gave 101→104 held out, so they were not shipped. The
  vision model reads Turkish letters and amounts well, including from a
  photo the server extracted nothing from, but **drops a zero from long digit
  runs**: `SGT2026000001482` → `SGT202600001482`, VKN `4830027561` →
  `483027561`. Seen twice in four live questions. A VKN is always 10 digits
  and a TCKN 11 — a check on that is the obvious next guard.

- **N33 — Motion pass (2026-09-24).** `main.jsx` wraps the app in
  `<MotionConfig reducedMotion="user">`; before it, only CSS animation
  honoured the OS setting. The rail's lime tile is one `layoutId="rail-live"`
  element (`.rail__fill`) that springs between destinations. The three side
  sheets render inside `<AnimatePresence>` with `ui/sheetMotion.js`, and their
  scrim carries `.is-presence`, which switches off `sheet-in` / `sheet-fade`:
  `sheet-in` fills forwards, a filled CSS animation outranks Framer's inline
  transform, and the exit slide would silently never show. Composer
  attachment chips animate in and out (`animated` prop); the sent copies in
  the thread do not.

The 2026-09-01 data-loss recovery is history now; `docs/RECOVERY.md` was
deleted in ca3f72f. The dump that survived it is `db_backup/`, and the
technique that saved the source is N8 above.
