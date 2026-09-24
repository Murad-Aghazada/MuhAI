"""Loading a company's workspace for the agent, and folding it into a snapshot.

The browser has ``analytics.js``'s ``buildSnapshot`` for the same job, because
``/api/compute`` reads no table and the client has to carry its own data up.
The agent is the opposite case — it is company-scoped and reads the tables
directly — so it needs the equivalent on this side.

Kept deliberately thin: rows become the *same documents* the workspace API
already returns (``ws.to_document``), and the snapshot is built from those
documents rather than from the ORM rows. One vocabulary, one set of field
names, and the compute engines below receive exactly what they receive when
the browser posts.

Everything here is read-only. There is no write path in this module, in
``agent_tools`` or in ``agent_service``, which is what makes "the agent can see
everything and change nothing" a property of the code rather than a promise.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import nulls_last, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.company import Company
from app.schemas.compute import ADJUSTMENT_CATEGORY, BusinessSnapshot
from app.services import workspace as ws

# Movements older than this cannot influence any figure the agent reports: the
# monthly series is 12 months and the forecast reads 120 days.
SNAPSHOT_HORIZON_DAYS = 400


@dataclass
class Workspace:
    """One company's whole dataset, in document form."""

    company: dict[str, Any]
    invoices: list[dict[str, Any]] = field(default_factory=list)
    transactions: list[dict[str, Any]] = field(default_factory=list)
    products: list[dict[str, Any]] = field(default_factory=list)
    employees: list[dict[str, Any]] = field(default_factory=list)
    tax_obligations: list[dict[str, Any]] = field(default_factory=list)
    vendor_categories: list[dict[str, Any]] = field(default_factory=list)
    as_of: dt.date = field(default_factory=dt.date.today)

    @property
    def counts(self) -> dict[str, int]:
        return {
            "invoices": len(self.invoices),
            "transactions": len(self.transactions),
            "products": len(self.products),
            "employees": len(self.employees),
            "taxObligations": len(self.tax_obligations),
        }


async def _documents(
    db: AsyncSession, company_id: str, name: str
) -> list[dict[str, Any]]:
    spec = ws.COLLECTIONS[name]
    if spec.order_by is None:
        order = (spec.model.created_at.desc(),)
    else:
        column = getattr(spec.model, spec.order_by)
        order = (nulls_last(column.desc()), spec.model.created_at.desc())

    rows = await db.scalars(
        select(spec.model).where(spec.model.company_id == company_id).order_by(*order)
    )
    return [ws.to_document(spec, row) for row in rows]


async def load_workspace(
    db: AsyncSession, company: Company, as_of: dt.date | None = None
) -> Workspace:
    """Every collection, in one pass, as the documents the client also sees."""
    return Workspace(
        company=ws.company_document(company),
        invoices=await _documents(db, company.id, "invoices"),
        transactions=await _documents(db, company.id, "transactions"),
        products=await _documents(db, company.id, "products"),
        employees=await _documents(db, company.id, "employees"),
        tax_obligations=await _documents(db, company.id, "taxObligations"),
        vendor_categories=await _documents(db, company.id, "vendorCategories"),
        as_of=as_of or dt.date.today(),
    )


# ── Snapshot ──────────────────────────────────────────────────────────


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _movement(t: dict) -> float:
    """A movement's amount the way web/src/lib/analytics.js posts it: made
    positive, except a dashboard correction, whose sign is the correction."""
    amount = _num(t.get("amount"))
    return amount if t.get("category") == ADJUSTMENT_CATEGORY else abs(amount)


def _date(value: Any) -> dt.date | None:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _filing_record(
    obligations: list[dict[str, Any]], sgk: bool, as_of: dt.date
) -> tuple[int, int]:
    """(due, settled on time) for the score's two compliance categories.

    An obligation still inside its window is not counted at all — it is neither
    a success nor a failure yet, and counting it as a miss would mark a company
    down for a deadline that has not arrived.
    """
    total = on_time = 0
    for row in obligations:
        is_sgk = str(row.get("type", "")).lower() == "sgk"
        if is_sgk != sgk:
            continue
        due = _date(row.get("dueDate"))
        paid = _date(row.get("paidDate"))
        settled = str(row.get("status", "")) == "paid"
        if not settled and (due is None or due >= as_of):
            continue
        total += 1
        if settled and (due is None or paid is None or paid <= due):
            on_time += 1
    return total, on_time


def cash_balance(workspace: Workspace) -> float:
    """The company's declared opening cash plus every movement since."""
    opening = _num(workspace.company.get("cashBalance"))
    net = 0.0
    for t in workspace.transactions:
        amount = _movement(t)
        net += amount if t.get("type") == "income" else -amount
    return round(opening + net, 2)


def build_snapshot(workspace: Workspace) -> BusinessSnapshot:
    """The exact payload ``/api/compute`` would have been posted."""
    as_of = workspace.as_of
    horizon = as_of - dt.timedelta(days=SNAPSHOT_HORIZON_DAYS)

    tax_total, tax_on_time = _filing_record(workspace.tax_obligations, False, as_of)
    sgk_total, sgk_on_time = _filing_record(workspace.tax_obligations, True, as_of)

    transactions = []
    for t in workspace.transactions:
        date = _date(t.get("date"))
        if date is None or date < horizon or date > as_of:
            continue
        transactions.append(
            {
                "date": date,
                "amount": _movement(t),
                "type": "income" if t.get("type") == "income" else "expense",
                "category": t.get("category") or None,
                "description": t.get("description") or None,
                "vendor": t.get("vendor") or None,
            }
        )

    invoices = [
        {
            "id": i.get("id"),
            "number": i.get("number") or None,
            "date": _date(i.get("issueDate")),
            "due_date": _date(i.get("dueDate")),
            "paid_date": _date(i.get("paidDate")),
            "amount": _num(i.get("amount")),
            "vat_amount": _num(i.get("vatAmount")),
            "vendor": i.get("vendor") or None,
            "status": i.get("status") if i.get("status") in {"paid", "pending", "overdue"} else "pending",
            "direction": "sales" if i.get("direction") == "sales" else "purchase",
        }
        for i in workspace.invoices
    ]

    return BusinessSnapshot(
        as_of=as_of,
        cash_balance=cash_balance(workspace),
        transactions=transactions,
        invoices=invoices,
        products=[
            {
                "name": p.get("name") or "",
                "stock": _num(p.get("stock")),
                "min_stock": _num(p.get("minStock")),
                "unit_price": _num(p.get("unitPrice")),
                "monthly_usage": _num(p.get("monthlyUsage")),
            }
            for p in workspace.products
        ],
        employees=[
            {
                "name": e.get("name") or "",
                "gross_salary": _num(e.get("grossSalary")),
                "start_date": _date(e.get("startDate")),
            }
            for e in workspace.employees
        ],
        tax_deadlines_total=tax_total,
        tax_deadlines_on_time=tax_on_time,
        sgk_payments_total=sgk_total,
        sgk_payments_on_time=sgk_on_time,
    )
