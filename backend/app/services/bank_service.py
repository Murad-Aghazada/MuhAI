"""Bank import, classification & reconciliation (Module 6).

Pure functions:
- parse_bank_csv: tolerant CSV/TSV parser → normalised rows
- classify_transaction: keyword rules → category
- reconcile: fuzzy-match bank rows to invoices (amount/date/vendor)

The route persists the parsed rows and reconciliation results.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta

# ── Classification ─────────────────────────────────────────────────────
_CATEGORY_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("salary", ("maaş", "bordro", "salary", "ücret")),
    ("tax_payment", ("vergi", "kdv", "sgk", "muhtasar", "gib", "tax")),
    ("utility", ("elektrik", "su", "doğalgaz", "dogalgaz", "internet", "fatura", "telekom")),
    ("loan", ("kredi", "taksit", "loan", "faiz")),
    ("credit_card", ("kredi kart", "kart ödeme", "kkb", "pos komisyon")),
    ("pos_payment", ("pos", "üye iş yeri", "uye is yeri")),
    ("transfer", ("havale", "eft", "transfer", "fast", "virman")),
    ("refund", ("iade", "refund")),
    ("supplier_payment", ("tedarik", "ödeme", "satıcı", "fatura ödeme")),
]


def classify_transaction(description: str, amount: float) -> str:
    text = (description or "").lower()
    for category, keywords in _CATEGORY_RULES:
        if any(k in text for k in keywords):
            return category
    return "other"


# ── CSV parsing ────────────────────────────────────────────────────────
_DATE_FORMATS = ("%d.%m.%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y")
_AMOUNT_CLEAN_RE = re.compile(r"[^\d,.\-]")


def _parse_date(raw: str) -> date | None:
    raw = (raw or "").strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(raw: str) -> float | None:
    s = _AMOUNT_CLEAN_RE.sub("", raw or "").strip()
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return round(float(s), 2)
    except ValueError:
        return None


@dataclass
class BankRow:
    date: date | None
    description: str
    amount: float
    category: str


def _find_key(headers: list[str], candidates: tuple[str, ...]) -> str | None:
    lowered = {h.lower().strip(): h for h in headers}
    for cand in candidates:
        for low, original in lowered.items():
            if cand in low:
                return original
    return None


def parse_bank_csv(content: str) -> list[BankRow]:
    """Parse a bank statement CSV/TSV. Detects delimiter and Turkish columns."""
    sample = content[:2048]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    if sample.count("\t") > sample.count(delimiter):
        delimiter = "\t"

    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    if not reader.fieldnames:
        return []

    headers = list(reader.fieldnames)
    date_key = _find_key(headers, ("tarih", "date"))
    desc_key = _find_key(headers, ("açıklama", "aciklama", "description", "işlem", "islem"))
    amount_key = _find_key(headers, ("tutar", "amount", "miktar"))

    rows: list[BankRow] = []
    for raw in reader:
        amount = _parse_amount(raw.get(amount_key, "")) if amount_key else None
        if amount is None:
            continue
        description = (raw.get(desc_key, "") if desc_key else "").strip()
        rows.append(
            BankRow(
                date=_parse_date(raw.get(date_key, "")) if date_key else None,
                description=description,
                amount=amount,
                category=classify_transaction(description, amount),
            )
        )
    return rows


# ── Reconciliation ─────────────────────────────────────────────────────
@dataclass
class InvoiceRef:
    id: str
    vendor_name: str | None
    amount: float
    date: date | None


@dataclass
class MatchResult:
    bank_index: int
    invoice_id: str | None
    status: str  # "matched" | "unmatched"
    confidence: float


def _amounts_close(a: float, b: float, tol_pct: float = 0.01) -> bool:
    if b == 0:
        return abs(a) < 0.01
    return abs(abs(a) - abs(b)) <= abs(b) * tol_pct


def _fuzzy_vendor(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    at, bt = a.lower().strip(), b.lower().strip()
    if at in bt or bt in at:
        return 1.0
    aset, bset = set(at.split()), set(bt.split())
    if not aset or not bset:
        return 0.0
    return len(aset & bset) / len(aset | bset)


def reconcile(
    bank_rows: list[BankRow],
    invoices: list[InvoiceRef],
    *,
    date_window_days: int = 7,
    amount_tol_pct: float = 0.01,
) -> list[MatchResult]:
    """Match each bank row to at most one invoice (greedy, best score first)."""
    results: list[MatchResult] = []
    used_invoice_ids: set[str] = set()

    for idx, row in enumerate(bank_rows):
        best: tuple[float, str] | None = None
        for inv in invoices:
            if inv.id in used_invoice_ids:
                continue
            if not _amounts_close(row.amount, inv.amount, amount_tol_pct):
                continue
            if row.date and inv.date and abs((row.date - inv.date).days) > date_window_days:
                continue
            score = 0.6  # amount + date in-window
            score += 0.4 * _fuzzy_vendor(row.description, inv.vendor_name)
            if best is None or score > best[0]:
                best = (score, inv.id)
        if best is not None:
            used_invoice_ids.add(best[1])
            results.append(MatchResult(idx, best[1], "matched", round(best[0], 2)))
        else:
            results.append(MatchResult(idx, None, "unmatched", 0.0))
    return results


def reconciliation_summary(results: list[MatchResult]) -> dict[str, float]:
    total = len(results)
    matched = sum(1 for r in results if r.status == "matched")
    return {
        "total": total,
        "matched": matched,
        "unmatched": total - matched,
        "match_rate": round(matched / total, 3) if total else 0.0,
    }
