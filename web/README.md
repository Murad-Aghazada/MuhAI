# Muhai · Akıllı Muhasebe

The web client for Muhai — an accounting and finance OS for Turkish SMEs.
Vite + React 18, dual-language (TR/EN), custom SVG charts, and no third-party
service of its own: everything it shows comes from the FastAPI backend in
`../backend/`.

![stack](https://img.shields.io/badge/Vite-React_18-35363b) ![lang](https://img.shields.io/badge/i18n-TR%20%2F%20EN-d9ff5c)

## Screens

1. **Akıllı Analitik (Dashboard)** — cash-flow chart, KPI cards, Muhai Score,
   compliance & risk alerts, assistant insight.
2. **Fatura Yönetimi (Invoices)** — invoice CRUD, OCR scan (browser or server),
   per-field confidence with a review queue, learned expense categories.
3. **Vergi (Tax)** — 2026 KDV / income / corporate / stopaj rates and the
   filing calendar.
4. **Stok Yönetimi (Inventory)** — stock levels, minimums, monthly usage.
5. **Bordro & SGK (Payroll)** — payroll run and cost breakdown.
6. **Finansal Asistan (AI)** — the backend's assistant: Gemini 2.5 Flash when
   it is reachable, a local BM25 knowledge base when it is not, badged either
   way.
7. **Ayarlar (Settings)** — company profile, learned categories, data tools.

## Stack

- **Vite + React 18** (JSX), **react-router-dom** routing
- **Framer Motion** — page transitions and staggered reveals
- **Custom SVG charts** — area, bar, donut, trend, forecast, score gauge
- **tesseract.js** — the browser OCR path, fully vendored under
  `public/tessdata` (nothing is fetched from a CDN)
- Fonts: **Syne**, **Inter Tight** (Google Fonts, stylesheet only)

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

The API it talks to is `VITE_API_URL` (copy `.env.example` to `.env.local`).
Leave it empty for a Docker build: there the bundle and the API share an
origin and nginx proxies `/api`.

## Auth

Email and password against `/api/auth`, with the JWT in localStorage. There is
no federated sign-in and no password reset — "continue with Google" and the
Firebase SDK behind it were removed on 2026-09-24, and a reset would need an
SMTP sender the self-hosted stack does not have.

## Structure

This is the web frontend only; it lives in `web/` inside the Muhai repo. The
FastAPI backend is in `../backend/`, the Expo app in `../mobile/`, project docs
in `../docs/`.

```
src/
  i18n/            LanguageContext + TR/EN dictionary
  context/         AuthContext, DataContext
  lib/             client (transport), db (workspace), api (compute),
                   ocr, vat, format, analytics, ragKnowledge, useReveal
  components/
    auth/          AuthShell, ProtectedRoute
    layout/        AppLayout, SideRail, Topbar
    charts/        Area, Bar, Donut, Trend, Forecast, ScoreGauge, chartKit
    ui/            lp primitives, icons, Reveal, Figures, Badge, EmptyState
    invoices/      InvoiceModal (entry, OCR review, category learning)
    chatbot/       ChatMessages, ChatComposer, useChat
  pages/           Landing, Login, Register, CompanySetup, Dashboard,
                   Invoices, Tax, Inventory, Payroll, Assistant, Settings
  styles/          landing, console, auth, components, layout, pages, chat
```

`src/lib/*` is shared with the Expo app, which bundles those files directly —
see **N20** in `../CLAUDE.md` before changing anything in there.

## Note on secrets

Nothing secret belongs in this bundle. Any `VITE_`-prefixed value is public
once built, so the Gemini key lives on the server and the assistant is reached
through the backend's `/api/compute/chat`.
