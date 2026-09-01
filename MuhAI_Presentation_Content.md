# MuhAI — TEKNOFEST 2026 Financial Technologies Competition
## Presentation Slide Content (English)

**Project:** MuhAI — AI Accountant & SME Finance OS
**Team:** Nasimi BHOS · **Team ID:** 821808 · **Application ID:** 4579275

> This document maps the MuhAI evaluation report onto the official presentation
> template's exact heading sequence. The template splits **Solution (15 pts)** and
> **Methodology (20 pts)** into separate slides and adds dedicated **Market (TAM/SAM/SOM)**
> and **Team** slides, so report content has been redistributed accordingly.

---

## Color Theme — "Petrol & Gold"

Deep teal reads as money / trust / stability (right for fintech) without the generic
startup-blue default; the mint signals the "AI" layer; gold is the value/CTA accent.
Use it on every slide.

| Role | Color | Hex | Where to use |
|------|-------|-----|--------------|
| Primary (dominant 60–70%) | Deep petrol teal | `0E4D4A` | Title + Thank-You backgrounds, sidebars, headers |
| Secondary | AI mint / seafoam | `00A896` | Module icons, AI-feature highlights, active timeline step |
| Accent (sharp, sparing) | Warm gold | `F5A524` | Key stats, MuhAI table column, price callouts, CTA |
| Text dark | Near-black | `0F1115` | Body text on light slides |
| Background light | Off-white | `F8FAFC` | Content-slide backgrounds (dark cover → light content → dark close) |
| Negative / risk | Muted coral | `E5645E` | Risk impact markers, competitor "✗" marks |

**Motif to repeat:** each of the six modules shown as a rounded card with its icon in a
mint circle. Tables use a petrol header row with the **MuhAI column tinted gold**. No
accent stripes or underlines.

**Fonts:** headers in Century Schoolbook or Cambria; body in Calibri.
Titles 36–44pt · section headers 20–24pt · body 14–16pt.

---

## Slide 1 — Cover

- **PROJECT NAME:** MuhAI — AI Accountant & SME Finance OS
- **TEAM EDUCATION LEVEL:** University (Baku Higher Oil School) *(confirm/adjust)*
- **SUBJECT:** Financial Technologies
- **TEAM NAME:** Nasimi BHOS
- **TEAM ID:** 821808
- **APPLICATION ID:** 4579275

Keep the template's cover layout untouched per the rules; only fill these fields.
Delete the grey instruction note.

---

## Slide 2 — PROBLEM (0–5 pts)

**Headline:** *Turkey's 3.5 million SMEs are drowning in financial admin they can't afford to outsource.*

Turkey's SMEs make up **99.8% of all businesses and 72% of employment**, yet financial
management remains expensive, complex, and manual. Three burdens stack on top of each other:

- **Cost barrier** — Outsourced accounting runs **2,000–3,000 TRY/month**, out of reach for
  most micro-enterprises, so owners either overpay or do it themselves and make costly mistakes.
- **Regulatory complexity** — Turkish tax law is intricate; SMEs rarely have in-house finance
  or legal staff, so compliance gaps turn into penalties.
- **Digital-compliance load** — Mandatory **e-Invoice / e-Ledger** obligations (GIB) are hard
  to implement without dedicated IT.

**The gap:** the one task every tool still fails at — *paper receipts and PDF invoices don't
enter the system by themselves.* That manual data-entry gap is MuhAI's wedge.

*Visual:* three icon cards (cost / complexity / compliance) above one big gold stat —
**"3.5M SMEs · 99.8% of all businesses."**

---

## Slide 3 — SOLUTION (0–15 pts)

**Headline:** *MuhAI — Turkey's first AI-native finance operating system for SMEs.*

MuhAI brings six functions an SME would otherwise split across an accountant, spreadsheets,
and legacy software into **one SaaS platform**:

1. **Smart invoice capture (OCR)** — scan or upload an invoice; it's read and recorded automatically.
2. **Automated tax & e-Declaration** — VAT and tax computed and filed via GIB, no manual effort.
3. **Cash-flow forecasting** — time-series AI predicts inflows/outflows from past activity.
4. **Inventory & operations tracking.**
5. **Payroll automation** — direct SGK integration.
6. **Turkish AI assistant** — owners ask finance questions in plain Turkish and get
   accountant-style answers, 24/7.

**Why it matters (social benefit):** MuhAI replaces "advanced knowledge + big budget" with
"scan, ask, done." It plugs SMEs into regulatory compliance, frees owners' time for growth,
and democratizes financial management for the backbone of the economy — at
**299–999 TRY/month (≈90% cheaper** than traditional accounting).

*Visual:* the dashboard screenshot (Figure 1 from the report) on one side; the 6 modules as
mint-circle icon cards on the other. This is a 15-pt slide — lead with the product visual.

---

## Slide 4 — METHODOLOGY (0–20 pts)

**Headline:** *A three-layer AI stack, engineered for Turkish regulation and reliability.*

**AI / ML architecture**

- **OCR** — hybrid **Tesseract 5.0 + custom CNN**, fine-tuned on Turkish invoice data for
  high field-extraction accuracy.
- **Forecasting** — **Facebook Prophet** for cash-flow/sales prediction; handles missing data,
  minimal tuning, interpretable output.
- **Conversational NLP** — **GPT-based LLM with RAG (retrieval-augmented generation)**, so
  answers reflect *current* Turkish regulations rather than stale model memory.

**Backend & integration**

- **Python / Django** with **PostgreSQL** (ACID-compliant — critical for financial data integrity).
- **Celery + Redis** for async heavy jobs (invoice processing, model retraining).
- **Official integrations:** **GIB** (e-Invoice submission), **SGK** (payroll), and **bank APIs**
  (İş Bankası, Garanti, YKB) for real-time transaction sync.
- A **modular API-adapter layer** lets the system absorb regulatory changes fast and improve
  models continuously from user data and corrections.

**Innovation / originality:** the combination — Turkish-tuned OCR + interpretable forecasting +
regulation-aware RAG chatbot — is what no legacy or global tool offers.

*Visual:* a 3-layer architecture diagram (OCR → Forecasting → NLP) feeding a backend block,
with GIB/SGK/Bank API connectors branching out. Highest-weighted slide — make the diagram
the centerpiece.

---

## Slide 5 — COMPETITOR ANALYSIS (0–10 pts)

**Headline:** *Everyone covers part of the job. Only MuhAI covers all of it, affordably.*

| Feature | **MuhAI** | Logo / Mikro | QuickBooks / Xero | Human Accountant |
|---|:--:|:--:|:--:|:--:|
| GIB e-Invoice integration | ✓ | ✓ | ✗ | ✓ |
| AI invoice OCR | ✓ | ✗ | ✗ | ✗ |
| Turkish NLP chatbot | ✓ | ✗ | ✗ | ✗ |
| Cash-flow AI forecast | ✓ | ✗ | Partial | ✗ |
| Auto tax declaration | ✓ | ✗ | ✗ | ✓ |
| Mobile-first | ✓ | ✗ | ✓ | ✗ |
| **Monthly cost (TRY)** | **299–999** | 2,000+ | 1,500+ | 2,000–3,000 |

**Takeaway:** QuickBooks/Xero aren't localized for Turkish tax, GIB or SGK; Logo/Mikro have
no AI and start above 2,000 TRY; human accountants are costly and can't answer instantly.
MuhAI uniquely fuses **full Turkish compliance (GIB, SGK, MASAK)** + **three AI automations**
+ **sub-1,000 TRY pricing**.

*Visual:* tint the **MuhAI column gold**; green ✓ in mint, red ✗ in coral. This is the
differentiation slide the rubric rewards — let the table breathe.

---

## Slide 6 — MARKET (0–10 pts, TAM / SAM / SOM)

**Headline:** *A $420M market, growing 18% a year, with a clear beachhead.*

- **TAM — Total Addressable Market:** Turkey's SME accounting/finance software market
  ≈ **$420M/year**, growing at **18% CAGR**, across **3.5M SMEs (99.8% of all businesses)**.
  Tailwind: GIB's accelerating e-transformation mandates push every SME toward digital compliance.
- **SAM — Serviceable Addressable Market:** ≈ **380,000 cloud-ready SMEs** in MuhAI's four
  beachhead verticals — freelancers/consultants (200,000+), e-commerce (100,000+),
  cafés/restaurants (50,000+), small manufacturers (30,000+).
- **SOM — Serviceable Obtainable Market (3-yr target):** capture **~1.5% of SAM ≈ 5,700 paying
  businesses by Year 3** (Year 1 ≈ 1,500). At a blended ~599 TRY/mo that's roughly
  **~41M TRY ARR** — a defensible, bottom-up goal, not a top-down guess.

*Visual:* a concentric-funnel or nested-circle graphic (TAM → SAM → SOM) with the three
numbers in gold. Label SOM clearly as a **3-year projection** so judges see it's grounded.

> Consistency note: the report frames the 380,000 as the "primary addressable market." It is
> placed here as **SAM**, with a **SOM** capture target added on top, because the template
> explicitly grades all three layers — points are lost if SOM is missing.

---

## Slide 7 — BUSINESS MODEL (0–15 pts)

**Headline:** *Tiered SaaS, plus a B2B white-label channel.*

| Plan | TRY/month | Target | Key features |
|---|:--:|---|---|
| **Starter** | 299 | Freelancers | Invoice OCR, VAT calc, e-Invoice |
| **Growth** | 599 | SMEs ≤10 staff | + Payroll, inventory, AI chatbot |
| **Pro** | 999 | SMEs ≤50 staff | + Cash-flow forecast, bank sync |
| **White-Label** | Custom | Accounting offices / banks | Full API + branding |

- **Go-to-market:** product-led free trial → in-app guided onboarding → self-serve upgrade;
  partnerships with accounting firms and banks for distribution.
- **Who buys:** the four SAM verticals direct (B2C-SME); accounting offices and banks as
  resellers (B2B).
- **Revenue model:** recurring monthly subscription (high stickiness, high retention) +
  **white-label/bank-reseller** as a second channel that multiplies reach. Starter alone is
  **~90% cheaper** than the 2,000–3,000 TRY status quo.

*Visual:* the four-tier pricing table (header row petrol, **highlight Growth or Pro in gold**
as the "recommended" tier) + two small channel icons (direct SME / white-label).

---

## Slide 8 — RISK ANALYSIS (0–10 pts)

**Headline:** *Identified honestly, mitigated concretely.*

| Risk | Likelihood | Impact | Mitigation |
|---|:--:|:--:|---|
| GIB API changes break integration | Medium | High | Compliance team monitors GIB bulletins; modular adapter layer for rapid updates |
| AI OCR errors on invoices | Medium | Medium | Human-in-the-loop review flag for low-confidence reads; continuous retraining on user corrections |
| Data security breach | Low | Very High | ISO 27001 roadmap; daily encrypted backups; pen-testing; 2FA |
| Low SME digital literacy / adoption | High | High | Guided onboarding; Turkish-language support; free trial; accounting-firm partnerships |
| Regulatory / licensing risk | Low | High | Legal advisory partnership; proactive MASAK & BDDK review |

*Visual:* a clean table, or a 2×2 likelihood-vs-impact matrix with the five risks plotted
(impact markers in coral). Pair each risk visually with its mitigation so it reads as
"managed," not "scary."

---

## Slide 9 — PROJECT TIMELINE (0–5 pts)

**Headline:** *Five quarters to market — launch Q4 2026.*

| Work package | Q1'26 | Q2'26 | Q3'26 | Q4'26 | Q1'27 |
|---|:--:|:--:|:--:|:--:|:--:|
| WP1 Requirements & architecture | ■ | | | | |
| WP2 OCR & invoice AI | ■ | ■ | | | |
| WP3 GIB & SGK integration | | ■ | ■ | | |
| WP4 NLP chatbot & analytics | | | ■ | ■ | |
| WP5 Mobile app | | | ■ | ■ | |
| WP6 Beta testing & security audit | | | | ■ | |
| WP7 Commercial launch & marketing | | | | ■ | ■ |

**Why it's realistic:** core AI components (Tesseract, Prophet) are open-source, and the team
has prior startup-founding and GIB-integration experience — so the critical path is
integration and testing, not invention.

*Visual:* a horizontal Gantt with the **current quarter highlighted in mint** and the
**Q4'26 launch milestone flagged in gold**.

---

## Slide 10 — TEAM (0–5 pts)

**Headline:** *Nasimi BHOS — builders who've shipped and integrated before.*

This slide isn't in the report, so member details are needed. Suggested structure —
one mint-circle photo card per member:

> **[Name] — Role** (e.g., Team Lead / Backend) · *key skill relevant to the WP they own*

Suggested role coverage:
- ML/AI (OCR + Prophet + RAG)
- Backend (Django / PostgreSQL / GIB-SGK APIs)
- Frontend / Mobile
- Finance / Regulatory (tax, MASAK / SGK compliance)
- Business / GTM

Tie each member to a work package from Slide 9 to show the team is sufficient and equipped.
Mention the **prior startup-founding and GIB-API integration experience** the report
references — that's the credibility line for these 5 points.

*Visual:* 3–5 uniform rounded cards (photo + name + role + one-line strength). Keep it symmetric.

---

## Slide 11 — THANK YOU (slogan)

Per the rules, use the page as-is and add only a slogan. Options:

- *"MuhAI — Your accountant, reinvented by AI."*
- *"Scan. Ask. Done. Finance for every SME."*
- *"Big-business finance, micro-business price."*
- *"Compliance without the complexity."*

**Recommended:** *"Scan. Ask. Done. — Finance for every SME."*

---

## Cleanup Reminders (from the template's own rules)

- Delete the final "Presentation Preparation Rules" page (Slide 12) and the grey instruction
  note on the cover.
- Keep the total **≤ 15 pages**. Currently 11 content slides — room to split Methodology or
  Solution across two pages if a diagram needs space.
