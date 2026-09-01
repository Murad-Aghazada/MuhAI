"""Single-call dashboard aggregator (Module 13).

GET /api/dashboard returns every dashboard section in one round-trip, computed
live from the DB. Reuses the tax engine, Muhai Score engine (which also
refreshes the daily score snapshot) and the tax calendar.
"""
from datetime import date, timedelta

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.api.routes.muhai_score import recompute_and_store
from app.db.models.employee import Employee
from app.db.models.invoice import Invoice
from app.db.models.product import Product
from app.db.models.transaction import Transaction, TransactionType
from app.schemas.dashboard import (
    AlertItem,
    CashSection,
    CategoryBreakdown,
    DashboardOut,
    DeadlineItem,
    ExpenseSection,
    InventorySection,
    PayrollSection,
    ProfitSection,
    RevenueSection,
    ScoreSection,
    TaxSection,
)
from app.services.tax_calendar import upcoming_deadlines
from app.services.tax_service import calc_corporate_tax, calc_kdv, calc_sgk

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _month_bounds(today: date) -> tuple[date, date]:
    """First day of this month and first day of last month."""
    month_start = today.replace(day=1)
    last_month_end = month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    return month_start, last_month_start


@router.get("", response_model=DashboardOut)
async def get_dashboard(current_user: CurrentUser, db: DbSession) -> DashboardOut:
    uid = current_user.id
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start, last_month_start = _month_bounds(today)
    year_start = date(today.year, 1, 1)

    # ── Transactions: one pass over all rows ───────────────────────────
    txs = list(await db.scalars(select(Transaction).where(Transaction.user_id == uid)))
    rev = {"today": 0.0, "week": 0.0, "month": 0.0, "year": 0.0, "last_month": 0.0}
    exp = {"month": 0.0, "year": 0.0}
    exp_by_cat: dict[str, float] = {}
    all_income = all_expense = 0.0

    for tx in txs:
        amount = float(tx.amount)
        d = tx.date
        if tx.type == TransactionType.income:
            all_income += amount
            if d == today:
                rev["today"] += amount
            if d >= week_start:
                rev["week"] += amount
            if d >= month_start:
                rev["month"] += amount
            elif last_month_start <= d < month_start:
                rev["last_month"] += amount
            if d >= year_start:
                rev["year"] += amount
        else:
            all_expense += amount
            if d >= month_start:
                exp["month"] += amount
                key = tx.category or "Diğer"
                exp_by_cat[key] = round(exp_by_cat.get(key, 0.0) + amount, 2)
            if d >= year_start:
                exp["year"] += amount

    month_change_pct: float | None = None
    if rev["last_month"] > 0:
        month_change_pct = round(
            (rev["month"] - rev["last_month"]) / rev["last_month"] * 100, 1
        )

    profit_month = rev["month"] - exp["month"]
    profit_year = rev["year"] - exp["year"]
    net_margin_pct = (
        round(profit_month / rev["month"] * 100, 1) if rev["month"] > 0 else None
    )

    # ── Invoices: KDV recorded year-to-date ────────────────────────────
    invoices = list(await db.scalars(select(Invoice).where(Invoice.user_id == uid)))
    kdv_paid_ytd = round(
        sum(
            float(i.vat_amount)
            for i in invoices
            if i.date is not None and i.date >= year_start
        ),
        2,
    )
    # Output-VAT estimate on this month's revenue (treated as KDV-inclusive).
    estimated_kdv_next_month = (
        calc_kdv(rev["month"], 0.20, inclusive=True).kdv if rev["month"] > 0 else 0.0
    )
    estimated_corporate_tax = calc_corporate_tax(rev["year"], exp["year"]).tax

    # ── Payroll: full employer cost ────────────────────────────────────
    employees = list(await db.scalars(select(Employee).where(Employee.user_id == uid)))
    monthly_cost = round(
        sum(calc_sgk(float(e.base_salary)).total_employer_cost for e in employees), 2
    )

    # ── Inventory ──────────────────────────────────────────────────────
    products = list(await db.scalars(select(Product).where(Product.user_id == uid)))
    low_stock_count = sum(1 for p in products if p.is_low_stock)

    # ── Muhai Score (recomputes + persists today's snapshot) ───────────
    score = await recompute_and_store(db, uid)
    cash_balance = round(all_income - all_expense, 2)

    # ── Upcoming tax deadlines ─────────────────────────────────────────
    deadlines = [
        DeadlineItem(
            type=d.type,
            name=d.name,
            due_date=d.due_date,
            days_remaining=d.days_remaining,
            due_soon=d.is_due_soon,
        )
        for d in upcoming_deadlines(today, count=3)
    ]

    # ── Alerts (lightweight; Module 8 will expand) ─────────────────────
    alerts: list[AlertItem] = []
    if score.cash_runway_days < 30:
        alerts.append(
            AlertItem(
                type="cash_runway",
                severity="high",
                message=f"Nakit rezerviniz yaklaşık {round(score.cash_runway_days)} gün.",
            )
        )
    for d in deadlines:
        if d.due_soon:
            alerts.append(
                AlertItem(
                    type="tax_deadline",
                    severity="high",
                    message=f"{d.name} son {d.days_remaining} gün.",
                )
            )
    if low_stock_count > 0:
        alerts.append(
            AlertItem(
                type="low_stock",
                severity="medium",
                message=f"{low_stock_count} ürün düşük stok seviyesinde.",
            )
        )
    if profit_month < 0:
        alerts.append(
            AlertItem(
                type="negative_profit",
                severity="medium",
                message="Bu ay giderleriniz gelirinizi aşıyor.",
            )
        )
    severity_rank = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: severity_rank.get(a.severity, 3))

    return DashboardOut(
        revenue=RevenueSection(
            today=round(rev["today"], 2),
            this_week=round(rev["week"], 2),
            this_month=round(rev["month"], 2),
            this_year=round(rev["year"], 2),
            month_change_pct=month_change_pct,
        ),
        expenses=ExpenseSection(
            this_month=round(exp["month"], 2),
            this_year=round(exp["year"], 2),
            by_category=[
                CategoryBreakdown(category=k, total=v)
                for k, v in sorted(exp_by_cat.items(), key=lambda kv: kv[1], reverse=True)
            ],
        ),
        profit=ProfitSection(
            this_month=round(profit_month, 2),
            this_year=round(profit_year, 2),
            net_margin_pct=net_margin_pct,
        ),
        taxes=TaxSection(
            kdv_paid_ytd=kdv_paid_ytd,
            estimated_kdv_next_month=round(estimated_kdv_next_month, 2),
            estimated_corporate_tax=estimated_corporate_tax,
        ),
        payroll=PayrollSection(monthly_cost=monthly_cost, headcount=len(employees)),
        inventory=InventorySection(
            total_skus=len(products), low_stock_count=low_stock_count
        ),
        cash=CashSection(balance=cash_balance, runway_days=score.cash_runway_days),
        muhai_score=ScoreSection(
            total_score=score.total_score, rating=score.rating
        ),
        alerts=alerts[:3],
        upcoming_deadlines=deadlines,
    )
