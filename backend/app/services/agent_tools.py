"""The agent's tools — everything it can see, and everything it can draw.

Two families, and the split is the whole security story:

* **Read tools** query this company's workspace and run the same engines the
  dashboard runs. Every one of them is a pure read. There is no create, no
  update, no delete anywhere in this module, so "the agent has access to the
  organisation's data, read-only" is enforced by there being no other kind of
  function to call — not by asking the model nicely in a prompt.
* **Render tools** do not read anything. They append a block to the answer, or
  bind the blocks so far into a report. The model uses them the way it would
  use markdown, except the output is typed (see ``agent_blocks``).

Scope comes from the caller, not from an argument: ``ToolContext`` is built
from the already-resolved company, and no tool takes a company id. A model that
hallucinated one would have nowhere to put it.

Everything is synchronous and operates on data already in memory — the whole
workspace is loaded once per turn in ``agent_service``. A company's dataset is
a few hundred rows; a per-tool round trip to Postgres would be slower and would
let two tools in one answer disagree about the data.
"""
from __future__ import annotations

import datetime as dt
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable

from app.services import agent_blocks as blocks
from app.services import compute_service as agg
from app.services.agent_context import Workspace, build_snapshot, cash_balance
from app.services.compliance_service import InvoiceRecord, run_all_checks
from app.services.forecast_service import MIN_POINTS_FOR_PROPHET, forecast_cashflow
from app.services.muhai_score_service import compute_muhai_score
from app.services.payroll_service import calc_detailed_payslip
from app.services.tax_calendar import upcoming_deadlines
from app.services.tax_service import (
    CORPORATE_TAX_RATE,
    VAT_STANDARD,
    calc_corporate_tax,
    calc_kdv,
)

# A tool result goes back into the prompt, so it is charged for twice — once
# going in, once as the context the next turn carries. These caps are what keep
# "list every invoice" from costing more than the answer is worth.
DEFAULT_LIMIT = 20
MAX_LIMIT = 100


# ── Context ───────────────────────────────────────────────────────────


@dataclass
class ToolContext:
    """One turn's view of one company. Built once, shared by every tool."""

    workspace: Workspace
    # Blocks rendered so far this turn, and not yet bound into a report.
    pending: list[dict] = field(default_factory=list)
    # Blocks that stay in the message stream.
    inline: list[dict] = field(default_factory=list)
    reports: list[dict] = field(default_factory=list)
    # Set by ``create_report``. Held until the turn ends rather than acted on
    # immediately — see the note on that tool.
    report_request: dict | None = None

    def __post_init__(self) -> None:
        self._snapshot = None
        self._score = None
        self._forecast: dict[int, dict] = {}

    @property
    def as_of(self) -> dt.date:
        return self.workspace.as_of

    @property
    def snapshot(self):
        """Built lazily and cached: several tools want it and it is not free."""
        if self._snapshot is None:
            self._snapshot = build_snapshot(self.workspace)
        return self._snapshot

    def emit(self, block: dict | None) -> None:
        if block is not None:
            self.pending.append(block)

    def finish(self) -> None:
        """Close the turn: everything drawn becomes a report, or stays inline.

        The binding happens **here**, at the end, and not inside
        ``create_report``. The first design bound eagerly and required the
        model to call the render tools first and ``create_report`` last — which
        it cannot reliably do, because it emits a whole batch of calls in one
        response and the order within that array is its own. Measured: on a
        five-section report the model put ``create_report`` fourth out of
        thirteen, so it bound nothing and the nine blocks after it stayed loose
        in the chat.

        Asking for a report is therefore a *flag*, not an instruction to
        execute at a point in time, and the ordering problem disappears.
        """
        if self.report_request and self.pending:
            request = self.report_request
            self.reports.append(
                {
                    "title": request.get("title") or "Rapor",
                    "subtitle": request.get("subtitle") or "",
                    "period": request.get("period") or "",
                    "blocks": list(self.pending),
                }
            )
        else:
            # No report asked for — or one asked for with nothing drawn, which
            # is a model slip that must not produce an empty document.
            self.inline.extend(self.pending)
        self.pending = []


# ── Small helpers ─────────────────────────────────────────────────────


def _limit(args: dict, default: int = DEFAULT_LIMIT) -> int:
    try:
        value = int(args.get("limit") or default)
    except (TypeError, ValueError):
        value = default
    return max(1, min(value, MAX_LIMIT))


def _date_arg(args: dict, key: str) -> dt.date | None:
    raw = args.get(key)
    if not raw:
        return None
    try:
        return dt.date.fromisoformat(str(raw)[:10])
    except ValueError:
        return None


def _in_window(value: Any, since: dt.date | None, until: dt.date | None) -> bool:
    if since is None and until is None:
        return True
    if not value:
        return False
    try:
        date = dt.date.fromisoformat(str(value)[:10])
    except ValueError:
        return False
    if since and date < since:
        return False
    if until and date > until:
        return False
    return True


def _match(value: Any, wanted: Any) -> bool:
    if not wanted:
        return True
    return str(value or "").lower() == str(wanted).lower()


def _contains(value: Any, needle: Any) -> bool:
    if not needle:
        return True
    return str(needle).lower() in str(value or "").lower()


def _round(value: float) -> float:
    return round(float(value or 0), 2)


# ── Read tools ────────────────────────────────────────────────────────


def _company_profile(ctx: ToolContext, args: dict) -> dict:
    company = ctx.workspace.company
    return {
        "name": company.get("name"),
        "taxId": company.get("taxId"),
        "taxOffice": company.get("taxOffice"),
        "sector": company.get("sector"),
        "city": company.get("city"),
        "legalForm": company.get("legalForm"),
        "currency": company.get("currency"),
        "openingCashBalance": _round(company.get("cashBalance") or 0),
        "currentCashBalance": cash_balance(ctx.workspace),
        "recordCounts": ctx.workspace.counts,
        "today": ctx.as_of.isoformat(),
    }


def _list_invoices(ctx: ToolContext, args: dict) -> dict:
    since, until = _date_arg(args, "since"), _date_arg(args, "until")
    overdue_only = bool(args.get("overdue_only"))

    rows = []
    for inv in ctx.workspace.invoices:
        if not _match(inv.get("status"), args.get("status")):
            continue
        if not _match(inv.get("direction"), args.get("direction")):
            continue
        if not _contains(inv.get("vendor"), args.get("vendor")):
            continue
        if not _in_window(inv.get("issueDate"), since, until):
            continue
        due = inv.get("dueDate")
        is_overdue = (
            inv.get("status") != "paid"
            and bool(due)
            and str(due)[:10] < ctx.as_of.isoformat()
        )
        if overdue_only and not is_overdue:
            continue
        rows.append(
            {
                "id": inv.get("id"),
                "number": inv.get("number"),
                "vendor": inv.get("vendor"),
                "direction": inv.get("direction"),
                "issueDate": inv.get("issueDate"),
                "dueDate": due,
                "amount": _round(inv.get("amount")),
                "vatAmount": _round(inv.get("vatAmount")),
                "status": inv.get("status"),
                "category": inv.get("category"),
                "overdue": is_overdue,
                "needsReview": bool(inv.get("needsReview")),
            }
        )

    limit = _limit(args)
    return {
        "matched": len(rows),
        "returned": min(len(rows), limit),
        "totalAmount": _round(sum(r["amount"] for r in rows)),
        "invoices": rows[:limit],
    }


def _list_transactions(ctx: ToolContext, args: dict) -> dict:
    since, until = _date_arg(args, "since"), _date_arg(args, "until")

    rows = []
    for txn in ctx.workspace.transactions:
        if not _match(txn.get("type"), args.get("type")):
            continue
        if not _match(txn.get("category"), args.get("category")):
            continue
        if not _contains(txn.get("vendor"), args.get("vendor")):
            continue
        if not _in_window(txn.get("date"), since, until):
            continue
        rows.append(
            {
                "id": txn.get("id"),
                "date": txn.get("date"),
                "amount": _round(txn.get("amount")),
                "type": txn.get("type"),
                "category": txn.get("category"),
                "description": txn.get("description"),
                "vendor": txn.get("vendor"),
            }
        )

    limit = _limit(args)
    income = sum(r["amount"] for r in rows if r["type"] == "income")
    expense = sum(r["amount"] for r in rows if r["type"] == "expense")
    return {
        "matched": len(rows),
        "returned": min(len(rows), limit),
        "income": _round(income),
        "expense": _round(expense),
        "net": _round(income - expense),
        "transactions": rows[:limit],
    }


def _list_products(ctx: ToolContext, args: dict) -> dict:
    low_only = bool(args.get("low_stock_only"))
    rows = []
    for product in ctx.workspace.products:
        stock = float(product.get("stock") or 0)
        min_stock = float(product.get("minStock") or 0)
        usage = float(product.get("monthlyUsage") or 0)
        if low_only and stock > min_stock:
            continue
        rows.append(
            {
                "name": product.get("name"),
                "sku": product.get("sku"),
                "stock": stock,
                "minStock": min_stock,
                "unitPrice": _round(product.get("unitPrice")),
                "stockValue": _round(stock * float(product.get("unitPrice") or 0)),
                "monthlyUsage": usage,
                # Whole months of cover at the recorded burn rate. None, not
                # zero, when nothing is consumed — "never runs out" and "out
                # tomorrow" must not be the same number.
                "monthsOfCover": round(stock / usage, 1) if usage > 0 else None,
                "belowMinimum": stock <= min_stock,
            }
        )

    limit = _limit(args)
    return {
        "matched": len(rows),
        "returned": min(len(rows), limit),
        "totalStockValue": _round(sum(r["stockValue"] for r in rows)),
        "belowMinimumCount": sum(1 for r in rows if r["belowMinimum"]),
        "products": rows[:limit],
    }


def _list_employees(ctx: ToolContext, args: dict) -> dict:
    rows = [
        {
            "name": e.get("name"),
            "role": e.get("role"),
            "grossSalary": _round(e.get("grossSalary")),
            "startDate": e.get("startDate"),
        }
        for e in ctx.workspace.employees
    ]
    return {
        "headcount": len(rows),
        "totalGross": _round(sum(r["grossSalary"] for r in rows)),
        "employees": rows[: _limit(args, 50)],
    }


def _list_tax_obligations(ctx: ToolContext, args: dict) -> dict:
    rows = [
        {
            "type": o.get("type"),
            "name": o.get("name"),
            "period": o.get("period"),
            "dueDate": o.get("dueDate"),
            "amount": _round(o.get("amount")),
            "status": o.get("status"),
            "paidDate": o.get("paidDate"),
        }
        for o in ctx.workspace.tax_obligations
        if _match(o.get("status"), args.get("status"))
        and _match(o.get("type"), args.get("type"))
    ]
    return {
        "matched": len(rows),
        "unpaidTotal": _round(
            sum(r["amount"] for r in rows if r["status"] != "paid")
        ),
        "obligations": rows[: _limit(args, 30)],
    }


def _financial_summary(ctx: ToolContext, args: dict) -> dict:
    try:
        months = int(args.get("months") or 6)
    except (TypeError, ValueError):
        months = 6
    months = max(1, min(months, 12))

    snapshot = ctx.snapshot
    series = agg.monthly_series(snapshot.transactions, ctx.as_of)[-months:]
    rollup = agg.invoice_rollup(snapshot.invoices, ctx.as_of)
    balance = agg.cash_balance(snapshot)
    current = series[-1] if series else {"income": 0.0, "expense": 0.0, "profit": 0.0}

    burn = current["expense"]
    return {
        "months": series,
        "currentMonth": current,
        "cashBalance": balance,
        "runwayDays": round(balance / burn * 30, 1) if burn > 0 else None,
        "receivables": rollup["receivables"],
        "payables": rollup["payables"],
        "overdueReceivableCount": rollup["overdue_receivable_count"],
        "overduePayableCount": rollup["overdue_payable_count"],
    }


def _expense_breakdown(ctx: ToolContext, args: dict) -> dict:
    try:
        months = int(args.get("months") or 1)
    except (TypeError, ValueError):
        months = 1
    months = max(1, min(months, 12))

    rows = agg.expense_breakdown(ctx.snapshot.transactions, ctx.as_of, months)
    total = sum(r["value"] for r in rows)
    return {
        "months": months,
        "total": _round(total),
        "categories": [
            {
                "category": r["key"],
                "amount": r["value"],
                "share": round(r["value"] / total * 100, 1) if total else 0.0,
            }
            for r in rows
        ],
    }


def _top_counterparties(ctx: ToolContext, args: dict) -> dict:
    """Who the money actually moves between — by invoice, not by ledger line.

    Ledger descriptions are free text and an invoice carries the counterparty
    as a field, so aggregating invoices gives a name that can be acted on.
    """
    direction = args.get("direction")
    totals: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"amount": 0.0, "count": 0, "unpaid": 0.0}
    )
    for inv in ctx.workspace.invoices:
        if not _match(inv.get("direction"), direction):
            continue
        name = (inv.get("vendor") or "—").strip() or "—"
        bucket = totals[name]
        bucket["amount"] += float(inv.get("amount") or 0)
        bucket["count"] += 1
        if inv.get("status") != "paid":
            bucket["unpaid"] += float(inv.get("amount") or 0)

    ordered = sorted(totals.items(), key=lambda kv: kv[1]["amount"], reverse=True)
    return {
        "direction": direction or "all",
        "counterparties": [
            {
                "name": name,
                "amount": _round(v["amount"]),
                "invoiceCount": v["count"],
                "unpaidAmount": _round(v["unpaid"]),
            }
            for name, v in ordered[: _limit(args, 10)]
        ],
    }


def _cash_forecast(ctx: ToolContext, args: dict) -> dict:
    try:
        horizon = int(args.get("horizon_days") or 30)
    except (TypeError, ValueError):
        horizon = 30
    horizon = max(7, min(horizon, 180))

    if horizon in ctx._forecast:
        return ctx._forecast[horizon]

    snapshot = ctx.snapshot
    history = agg.daily_net_history(snapshot.transactions, ctx.as_of)
    points = forecast_cashflow(history, horizon=horizon)
    projected_net = _round(sum(p.yhat for p in points))

    # A daily curve is 180 numbers the model cannot use; weekly buckets are
    # what an answer is written from.
    weekly = []
    for index in range(0, len(points), 7):
        chunk = points[index : index + 7]
        weekly.append(
            {
                "weekStarting": chunk[0].ds.isoformat()
                if hasattr(chunk[0].ds, "isoformat")
                else str(chunk[0].ds),
                "net": _round(sum(p.yhat for p in chunk)),
            }
        )

    result = {
        "engine": "prophet"
        if len(history) >= MIN_POINTS_FOR_PROPHET
        else "moving_average",
        "horizonDays": horizon,
        "historyPoints": len(history),
        "projectedNet": projected_net,
        "projectedBalance": _round(agg.cash_balance(snapshot) + projected_net),
        "weekly": weekly,
    }
    ctx._forecast[horizon] = result
    return result


def _muhai_score(ctx: ToolContext, args: dict) -> dict:
    if ctx._score is None:
        ctx._score = compute_muhai_score(agg.score_inputs(ctx.snapshot, ctx.as_of))
    score = ctx._score
    return {
        "totalScore": score.total_score,
        "rating": score.rating,
        "cashRunwayDays": score.cash_runway_days,
        "categories": [
            {
                "key": c.key,
                "label": c.label,
                # 0..1 as the engine keeps it, and the points it actually
                # contributed. Handing the model only the ratio would have it
                # rank an 8%-weighted category against a 20% one.
                "score": round(c.score, 3),
                "weight": c.weight,
                "points": round(c.points, 1),
            }
            for c in score.categories
        ],
        "strengths": score.strengths,
        "risks": score.risks,
        "recommendations": score.recommendations,
    }


def _tax_summary(ctx: ToolContext, args: dict) -> dict:
    snapshot = ctx.snapshot
    series = agg.monthly_series(snapshot.transactions, ctx.as_of)
    current = series[-1]

    collected = calc_kdv(current["income"], VAT_STANDARD, inclusive=True).kdv
    paid = calc_kdv(current["expense"], VAT_STANDARD, inclusive=True).kdv
    year_revenue = _round(sum(m["income"] for m in series))
    year_expense = _round(sum(m["expense"] for m in series))
    corporate = calc_corporate_tax(year_revenue, year_expense, CORPORATE_TAX_RATE)

    return {
        "period": current["month"],
        "kdvCollected": _round(collected),
        "kdvPaid": _round(paid),
        "kdvPayable": _round(max(collected - paid, 0.0)),
        "trailingRevenue": year_revenue,
        "trailingExpenses": year_expense,
        "taxableProfit": corporate.profit,
        "corporateTax": corporate.tax,
        "corporateQuarterly": corporate.quarterly_payment,
        "deadlines": _tax_calendar(ctx, {"count": 6})["deadlines"],
    }


def _payroll_run(ctx: ToolContext, args: dict) -> dict:
    slips = []
    for employee in ctx.snapshot.employees:
        slip = calc_detailed_payslip(
            float(employee.gross_salary),
            start_date=employee.start_date,
            as_of=ctx.as_of,
        )
        slips.append(
            {
                "name": employee.name,
                "gross": slip.gross_salary,
                "net": slip.net_salary,
                "sgkEmployee": slip.sgk_employee,
                "sgkEmployer": slip.sgk_employer,
                "incomeTax": slip.income_tax,
                "totalDeductions": slip.total_deductions,
                "employerCost": slip.total_employer_cost,
                "tenureYears": slip.tenure_years,
                "severanceEstimate": slip.severance_estimate,
            }
        )
    return {
        "headcount": len(slips),
        "totalGross": _round(sum(s["gross"] for s in slips)),
        "totalNet": _round(sum(s["net"] for s in slips)),
        "totalEmployerCost": _round(sum(s["employerCost"] for s in slips)),
        "payslips": slips,
    }


def _compliance_check(ctx: ToolContext, args: dict) -> dict:
    records = [
        InvoiceRecord(
            id=inv.id or f"#{index}",
            invoice_number=inv.number,
            vendor_name=inv.vendor,
            amount=float(inv.amount),
            vat_amount=float(inv.vat_amount),
            date=inv.date,
        )
        for index, inv in enumerate(ctx.snapshot.invoices)
    ]
    alerts = run_all_checks(records, ctx.as_of)
    return {
        "total": len(alerts),
        "high": sum(1 for a in alerts if a.severity == "high"),
        "alerts": [
            {
                "type": a.type,
                "severity": a.severity,
                "description": a.description,
                "refId": a.ref_id,
            }
            for a in alerts[:30]
        ],
    }


def _tax_calendar(ctx: ToolContext, args: dict) -> dict:
    try:
        count = int(args.get("count") or 5)
    except (TypeError, ValueError):
        count = 5
    return {
        "today": ctx.as_of.isoformat(),
        "deadlines": [
            {
                "type": d.type,
                "name": d.name,
                "dueDate": d.due_date.isoformat(),
                "daysRemaining": d.days_remaining,
                "dueSoon": d.is_due_soon,
            }
            for d in upcoming_deadlines(ctx.as_of, count=max(1, min(count, 12)))
        ],
    }


def _learned_categories(ctx: ToolContext, args: dict) -> dict:
    return {
        "count": len(ctx.workspace.vendor_categories),
        "entries": [
            {"vendor": row.get("vendor"), "category": row.get("category")}
            for row in ctx.workspace.vendor_categories[: _limit(args, 50)]
        ],
    }


# ── Render tools ──────────────────────────────────────────────────────


def _show_heading(ctx: ToolContext, args: dict) -> dict:
    ctx.emit(blocks.normalise({"type": "heading", **args}))
    return {"ok": True}


def _show_text(ctx: ToolContext, args: dict) -> dict:
    ctx.emit(blocks.normalise({"type": "text", **args}))
    return {"ok": True}


def _show_kpis(ctx: ToolContext, args: dict) -> dict:
    ctx.emit(blocks.normalise({"type": "kpi", **args}))
    return {"ok": True}


def _show_chart(ctx: ToolContext, args: dict) -> dict:
    ctx.emit(blocks.normalise({"type": "chart", **args}))
    return {"ok": True}


def _show_table(ctx: ToolContext, args: dict) -> dict:
    ctx.emit(blocks.normalise({"type": "table", **args}))
    return {"ok": True}


def _show_callout(ctx: ToolContext, args: dict) -> dict:
    ctx.emit(blocks.normalise({"type": "callout", **args}))
    return {"ok": True}


def _create_report(ctx: ToolContext, args: dict) -> dict:
    """Mark this turn's output as a report and name it.

    Order-independent by design: it records the request and the binding
    happens when the turn closes (``ToolContext.finish``). Calling it before
    the sections are drawn is not an error, because the model routinely does
    exactly that — see the note on ``finish``.
    """
    ctx.report_request = {
        "title": str(args.get("title") or "Rapor"),
        "subtitle": str(args.get("subtitle") or ""),
        "period": str(args.get("period") or ""),
    }
    return {"ok": True, "title": ctx.report_request["title"]}


# ── Declarations ──────────────────────────────────────────────────────


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[[ToolContext, dict], dict]
    # Read tools are listed in the UI's capability strip; render tools are
    # plumbing and would only be noise there.
    kind: str = "read"


# Schemas are written once, in Gemini's uppercase OpenAPI dialect, and
# ``llm._json_schema`` lower-cases them for OpenAI. One source on purpose: two
# would let a tool gain an argument on one vendor and not the other.
def _params(properties: dict[str, Any], required: list[str] | None = None) -> dict:
    return {
        "type": "OBJECT",
        "properties": properties,
        "required": required or [],
    }


_STR = {"type": "STRING"}
_NUM = {"type": "NUMBER"}
_BOOL = {"type": "BOOLEAN"}


def _enum(*values: str) -> dict:
    return {"type": "STRING", "enum": list(values)}


_DATE = {"type": "STRING", "description": "ISO tarih, YYYY-MM-DD"}

TOOLS: tuple[Tool, ...] = (
    Tool(
        "get_company_profile",
        "İşletmenin künyesi: unvan, vergi no, vergi dairesi, sektör, şehir, "
        "para birimi, güncel nakit bakiyesi ve her koleksiyondaki kayıt sayısı. "
        "Bugünün tarihini de döner.",
        _params({}),
        _company_profile,
    ),
    Tool(
        "list_invoices",
        "Faturaları filtreleyerek listeler ve eşleşenlerin toplam tutarını verir.",
        _params(
            {
                "status": _enum("paid", "pending", "overdue"),
                "direction": _enum("sales", "purchase"),
                "vendor": {**_STR, "description": "Cari adında geçen metin"},
                "since": _DATE,
                "until": _DATE,
                "overdue_only": {**_BOOL, "description": "Sadece vadesi geçmişler"},
                "limit": {**_NUM, "description": f"Varsayılan {DEFAULT_LIMIT}, en çok {MAX_LIMIT}"},
            }
        ),
        _list_invoices,
    ),
    Tool(
        "list_transactions",
        "Kasa/banka hareketlerini filtreleyerek listeler; gelir, gider ve net "
        "toplamı da döner.",
        _params(
            {
                "type": _enum("income", "expense"),
                "category": _STR,
                "vendor": _STR,
                "since": _DATE,
                "until": _DATE,
                "limit": _NUM,
            }
        ),
        _list_transactions,
    ),
    Tool(
        "list_products",
        "Stok kalemleri: mevcut adet, kritik seviye, birim fiyat, stok değeri ve "
        "aylık tüketime göre kaç aylık stok kaldığı.",
        _params({"low_stock_only": _BOOL, "limit": _NUM}),
        _list_products,
    ),
    Tool(
        "list_employees",
        "Çalışan listesi, brüt maaşlar ve toplam brüt yük.",
        _params({"limit": _NUM}),
        _list_employees,
    ),
    Tool(
        "list_tax_obligations",
        "Kayıtlı vergi ve SGK yükümlülükleri, ödenme durumlarıyla.",
        _params({"status": _enum("paid", "pending", "overdue"), "type": _STR, "limit": _NUM}),
        _list_tax_obligations,
    ),
    Tool(
        "financial_summary",
        "Aylık gelir/gider/kâr serisi, nakit bakiyesi, nakit pisti (gün), "
        "alacak ve borç toplamları. Genel 'işler nasıl gidiyor' sorularının "
        "ilk durağı.",
        _params({"months": {**_NUM, "description": "1-12, varsayılan 6"}}),
        _financial_summary,
    ),
    Tool(
        "expense_breakdown",
        "Giderlerin kategori kırılımı ve her kategorinin toplam içindeki payı.",
        _params({"months": {**_NUM, "description": "1-12, varsayılan 1"}}),
        _expense_breakdown,
    ),
    Tool(
        "top_counterparties",
        "En çok işlem yapılan cariler: toplam tutar, fatura adedi ve açık bakiye.",
        _params({"direction": _enum("sales", "purchase"), "limit": _NUM}),
        _top_counterparties,
    ),
    Tool(
        "cash_forecast",
        "Prophet ile nakit akışı tahmini (10 günden az veri varsa hareketli "
        "ortalama). Haftalık net ve dönem sonu tahmini bakiye döner.",
        _params({"horizon_days": {**_NUM, "description": "7-180, varsayılan 30"}}),
        _cash_forecast,
    ),
    Tool(
        "muhai_score",
        "Muhai Skoru: 8 ağırlıklı kategori, güçlü yönler, riskler ve öneriler.",
        _params({}),
        _muhai_score,
    ),
    Tool(
        "tax_summary",
        "2026 vergi motoru: dönem KDV pozisyonu, 12 aylık ciro/gider, kurumlar "
        "vergisi matrahı ve geçici vergi taksiti, yaklaşan beyan tarihleri.",
        _params({}),
        _tax_summary,
    ),
    Tool(
        "payroll_run",
        "Bordro hesabı: çalışan bazında brüt, net, SGK işçi/işveren payları, "
        "gelir vergisi, işveren maliyeti ve kıdem tazminatı tahmini.",
        _params({}),
        _payroll_run,
    ),
    Tool(
        "compliance_check",
        "Uyum denetimi: mükerrer faturalar, yasal orana uymayan KDV ve uyarı "
        "penceresindeki beyan tarihleri.",
        _params({}),
        _compliance_check,
    ),
    Tool(
        "tax_calendar",
        "2026 beyan takviminden yaklaşan son ödeme tarihleri.",
        _params({"count": _NUM}),
        _tax_calendar,
    ),
    Tool(
        "learned_vendor_categories",
        "Kullanıcının sınıflandırıcıya öğrettiği cari → kategori eşleşmeleri.",
        _params({"limit": _NUM}),
        _learned_categories,
    ),
    # ── render ────────────────────────────────────────────────────────
    Tool(
        "show_heading",
        "Cevaba bir başlık ekler. Sadece rapor benzeri uzun cevaplarda kullan.",
        _params({"text": _STR, "level": _enum("2", "3")}, ["text"]),
        _show_heading,
        kind="render",
    ),
    Tool(
        "show_text",
        "Cevaba bir paragraf ekler. Kısa cevaplarda buna gerek yok — normal "
        "metin olarak yaz. Bunu sadece rapor gövdesi için kullan.",
        _params({"text": _STR}, ["text"]),
        _show_text,
        kind="render",
    ),
    Tool(
        "show_kpis",
        "Bir sayı şeridi çizer: en çok 6 rakam, her biri etiket + biçimlenmiş "
        "değer. Değeri birimiyle birlikte yaz (örn. '1.240.000 ₺', '%18').",
        _params(
            {
                "items": {
                    "type": "ARRAY",
                    "items": _params(
                        {
                            "label": _STR,
                            "value": {**_STR, "description": "Biçimlenmiş, birimli"},
                            "delta": {**_STR, "description": "örn. '+%12' veya '-3 gün'"},
                            "tone": _enum("neutral", "ok", "warn", "stop"),
                            "hint": _STR,
                        },
                        ["label", "value"],
                    ),
                }
            },
            ["items"],
        ),
        _show_kpis,
        kind="render",
    ),
    Tool(
        "show_chart",
        "Grafik çizer. categories x eksenidir; her seri categories ile aynı "
        "uzunlukta values taşır. donut tek seri kullanır.",
        _params(
            {
                "chart": _enum("bar", "line", "area", "donut"),
                "title": _STR,
                "unit": {**_STR, "description": "TRY, adet, % …"},
                "categories": {"type": "ARRAY", "items": _STR},
                "series": {
                    "type": "ARRAY",
                    "items": _params(
                        {"name": _STR, "values": {"type": "ARRAY", "items": _NUM}},
                        ["name", "values"],
                    ),
                },
            },
            ["chart", "categories", "series"],
        ),
        _show_chart,
        kind="render",
    ),
    Tool(
        "show_table",
        "Tablo çizer. Sayı taşıyan sütunlarda align='right' kullan.",
        _params(
            {
                "title": _STR,
                "columns": {"type": "ARRAY", "items": _STR},
                "rows": {
                    "type": "ARRAY",
                    "items": {"type": "ARRAY", "items": _STR},
                },
                "align": {"type": "ARRAY", "items": _enum("left", "right")},
                "total": {
                    "type": "ARRAY",
                    "items": _STR,
                    "description": "İsteğe bağlı toplam satırı",
                },
            },
            ["columns", "rows"],
        ),
        _show_table,
        kind="render",
    ),
    Tool(
        "show_callout",
        "Tek cümlelik uyarı/vurgu kutusu. Bir cevapta en fazla bir tane.",
        _params(
            {
                "tone": _enum("info", "ok", "warn", "stop"),
                "title": _STR,
                "text": _STR,
            },
            ["text"],
        ),
        _show_callout,
        kind="render",
    ),
    Tool(
        "create_report",
        "Bu turda çizilen her şeyi indirilebilir bir rapora dönüştürür ve "
        "adını verir. Kullanıcı rapor / özet dokümanı / PDF istediğinde bir "
        "kez çağır — sırası önemli değil, bloklardan önce de sonra da "
        "olabilir. Rapora giren bloklar sohbet akışında tekrar gösterilmez.",
        _params(
            {
                "title": _STR,
                "subtitle": _STR,
                "period": {**_STR, "description": "örn. '2026 Eylül' veya '2026 Q3'"},
            },
            ["title"],
        ),
        _create_report,
        kind="render",
    ),
)

TOOLS_BY_NAME: dict[str, Tool] = {tool.name: tool for tool in TOOLS}

READ_TOOLS: tuple[Tool, ...] = tuple(t for t in TOOLS if t.kind == "read")


def call(name: str, args: dict, ctx: ToolContext) -> dict:
    """Run one tool. An unknown name is an error the model can recover from."""
    tool = TOOLS_BY_NAME.get(name)
    if tool is None:
        return {"error": f"Bilinmeyen araç: {name}"}
    try:
        return tool.handler(ctx, args or {})
    except Exception as exc:  # a bad argument must not end the turn
        return {"error": f"{name} çalıştırılamadı: {exc}"}


def summarise(name: str, result: dict) -> str:
    """One line describing what a call returned, for the UI's tool trace.

    Specific shapes are tested before the generic count, because several
    results carry a ``total`` that is an *amount* — reporting
    "455667.39 kayıt" for an expense breakdown was this function reading the
    money as a row count.
    """
    if not isinstance(result, dict):
        return name
    if "error" in result:
        return str(result["error"])[:160]
    if result.get("ok") is True:
        return "çizildi"
    if isinstance(result.get("categories"), list) and "total" in result:
        return f"{len(result['categories'])} kategori"
    if isinstance(result.get("counterparties"), list):
        return f"{len(result['counterparties'])} cari"
    if isinstance(result.get("deadlines"), list) and "period" not in result:
        return f"{len(result['deadlines'])} son tarih"
    if isinstance(result.get("months"), list):
        return f"{len(result['months'])} aylık özet"
    if "totalScore" in result:
        return f"Skor {result['totalScore']}/100"
    if "projectedBalance" in result:
        return f"{result['horizonDays']} günlük tahmin"
    if "period" in result and "kdvPayable" in result:
        return f"{result['period']} vergi özeti"
    if "headcount" in result:
        return f"{result['headcount']} çalışan"
    if "matched" in result:
        return f"{result['matched']} kayıt"
    if "recordCounts" in result:
        return result.get("name") or "işletme künyesi"
    if "alerts" in result:
        return f"{result.get('total', 0)} uyarı"
    if "count" in result:
        return f"{result['count']} kayıt"
    return "tamam"
