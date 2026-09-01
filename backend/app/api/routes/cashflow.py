"""Cash-flow forecasting endpoint (Module 5).

GET /api/cashflow/forecast — aggregates recurring expenses, payroll, tax
deadlines and expected receivables into a daily balance projection.
"""
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.employee import Employee
from app.db.models.invoice import Invoice, InvoiceStatus
from app.db.models.transaction import Transaction, TransactionType
from app.schemas.transaction import (
    CashFlowForecastOut,
    ProjectionPointOut,
)
from app.services.cashflow_service import CashFlowEvent, build_forecast
from app.services.tax_calendar import upcoming_deadlines
from app.services.tax_service import SGK_EMPLOYER_RATE, calc_kdv

router = APIRouter(prefix="/cashflow", tags=["cashflow"])

RECEIVABLE_TERM_DAYS = 30


def _next_month_day(today: date, day: int) -> date:
    """The given day-of-month, this month if still ahead else next month."""
    candidate = today.replace(day=min(day, 28))
    if candidate >= today:
        return candidate
    nxt = (today.replace(day=1) + timedelta(days=32)).replace(day=min(day, 28))
    return nxt


@router.get("/forecast", response_model=CashFlowForecastOut)
async def cashflow_forecast(
    current_user: CurrentUser,
    db: DbSession,
    days: int = Query(90, ge=7, le=365),
    threshold: float = Query(0.0),
) -> CashFlowForecastOut:
    uid = current_user.id
    today = date.today()
    window_start = today - timedelta(days=90)

    txs = list(await db.scalars(select(Transaction).where(Transaction.user_id == uid)))
    invoices = list(await db.scalars(select(Invoice).where(Invoice.user_id == uid)))
    employees = list(await db.scalars(select(Employee).where(Employee.user_id == uid)))

    # Starting balance proxy: lifetime net cash.
    starting_balance = round(
        sum(
            float(t.amount) if t.type == TransactionType.income else -float(t.amount)
            for t in txs
        ),
        2,
    )

    events: list[CashFlowEvent] = []

    # 1) Recurring expenses: avg monthly per category over the last 90 days,
    #    scheduled mid-month for each month in the horizon.
    recent_exp: dict[str, float] = defaultdict(float)
    for t in txs:
        if t.type == TransactionType.expense and t.date >= window_start:
            recent_exp[t.category or "Gider"] += float(t.amount)
    monthly_exp = {k: v / 3.0 for k, v in recent_exp.items()}  # 90 days ≈ 3 months
    months_ahead = days // 30 + 1
    for m in range(months_ahead):
        base = (today.replace(day=1) + timedelta(days=32 * m)).replace(day=15)
        for cat, amount in monthly_exp.items():
            if amount > 0:
                events.append(CashFlowEvent(base, -round(amount, 2), cat, "recurring_expense"))

    # 2) Payroll: total employer cost, day 1 of each month.
    payroll_cost = round(
        sum(float(e.base_salary) * (1 + SGK_EMPLOYER_RATE) for e in employees), 2
    )
    if payroll_cost > 0:
        for m in range(months_ahead):
            day1 = (today.replace(day=1) + timedelta(days=32 * m)).replace(day=1)
            events.append(CashFlowEvent(day1, -payroll_cost, "Bordro", "payroll"))

    # 3) Tax deadlines with rough estimates.
    monthly_revenue = sum(
        float(t.amount)
        for t in txs
        if t.type == TransactionType.income and t.date >= today.replace(day=1)
    )
    kdv_estimate = calc_kdv(monthly_revenue, 0.20, inclusive=True).kdv if monthly_revenue else 0.0
    sgk_estimate = payroll_cost  # employer SGK already embedded; rough
    for d in upcoming_deadlines(today, count=12):
        if (d.due_date - today).days > days:
            continue
        if d.type == "kdv" and kdv_estimate > 0:
            events.append(CashFlowEvent(d.due_date, -round(kdv_estimate, 2), d.name, "tax"))
        elif d.type == "sgk" and sgk_estimate > 0:
            events.append(
                CashFlowEvent(d.due_date, -round(sgk_estimate * 0.2, 2), d.name, "tax")
            )

    # 4) Receivables: unpaid invoices expected ~30 days after invoice date.
    for inv in invoices:
        if inv.status == InvoiceStatus.pending and inv.date is not None:
            expected = inv.date + timedelta(days=RECEIVABLE_TERM_DAYS)
            if expected < today:
                expected = today + timedelta(days=3)  # overdue → expect soon
            events.append(
                CashFlowEvent(
                    expected,
                    round(float(inv.amount or 0), 2),
                    f"Tahsilat: {inv.vendor_name or inv.invoice_number or 'Fatura'}",
                    "receivable",
                )
            )

    fc = build_forecast(starting_balance, events, today, horizon_days=days, threshold=threshold)
    return CashFlowForecastOut(
        starting_balance=fc.starting_balance,
        threshold=fc.threshold,
        horizon_days=fc.horizon_days,
        points=[
            ProjectionPointOut(
                date=p.date,
                inflow=p.inflow,
                outflow=p.outflow,
                balance=p.balance,
                below_threshold=p.below_threshold,
            )
            for p in fc.points
        ],
        min_balance=fc.min_balance,
        min_balance_date=fc.min_balance_date,
        runs_out=fc.runs_out,
        runs_out_date=fc.runs_out_date,
        warnings=fc.warnings,
        actions=fc.actions,
    )
