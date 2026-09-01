"""Muhai Score endpoints (Module 12).

GET  /api/muhai-score          → live score + breakdown, persists a daily snapshot
GET  /api/muhai-score/history  → score trend over time

The score recomputes from current business data on every call and upserts one
snapshot per day so the trend chart accumulates history. It should also be
recomputed after invoice saves / payroll runs / tax payments — call
:func:`recompute_and_store` from those flows.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.employee import Employee
from app.db.models.invoice import Invoice, InvoiceStatus
from app.db.models.muhai_score import MuhaiScore
from app.db.models.product import Product
from app.db.models.transaction import Transaction, TransactionType
from app.schemas.muhai_score import (
    CategoryScoreOut,
    MuhaiScoreHistoryOut,
    MuhaiScoreHistoryPoint,
    MuhaiScoreOut,
)
from app.services.muhai_score_service import (
    ScoreInputs,
    ScoreResult,
    compute_muhai_score,
)

router = APIRouter(prefix="/muhai-score", tags=["muhai-score"])

MONTH_WINDOW_DAYS = 30


async def _gather_inputs(db: DbSession, user_id: str) -> ScoreInputs:
    """Aggregate the user's current business data into score inputs.

    Categories without a dedicated source yet (tax/SGK payment history, formal
    debt vs assets) are left at their neutral defaults; Modules 6/10 will feed
    them real data later.
    """
    window_start = date.today() - timedelta(days=MONTH_WINDOW_DAYS)

    # ── Transactions: monthly flows + a cash-balance proxy ─────────────
    txs = list(
        await db.scalars(select(Transaction).where(Transaction.user_id == user_id))
    )
    monthly_revenue = monthly_expense = 0.0
    all_income = all_expense = 0.0
    for t in txs:
        amount = float(t.amount)
        if t.type == TransactionType.income:
            all_income += amount
            if t.date >= window_start:
                monthly_revenue += amount
        else:
            all_expense += amount
            if t.date >= window_start:
                monthly_expense += amount
    cash_balance = all_income - all_expense  # proxy until bank balances exist

    # ── Invoices: collection proxy (approved == collected) ─────────────
    invoices = list(
        await db.scalars(select(Invoice).where(Invoice.user_id == user_id))
    )
    invoices_total = len(invoices)
    invoices_collected = sum(
        1 for i in invoices if i.status == InvoiceStatus.approved
    )

    # ── Inventory: healthy = not below low-stock threshold ─────────────
    products = list(
        await db.scalars(select(Product).where(Product.user_id == user_id))
    )
    inventory_total = len(products)
    inventory_healthy = sum(1 for p in products if not p.is_low_stock)

    # ── Payroll ────────────────────────────────────────────────────────
    employees = list(
        await db.scalars(select(Employee).where(Employee.user_id == user_id))
    )
    monthly_payroll = sum(float(e.base_salary) for e in employees)

    return ScoreInputs(
        cash_balance=cash_balance,
        monthly_operating_expense=monthly_expense,
        invoices_total=invoices_total,
        invoices_collected_on_time=invoices_collected,
        inventory_items_total=inventory_total,
        inventory_items_healthy=inventory_healthy,
        monthly_payroll=monthly_payroll,
        monthly_revenue=monthly_revenue,
        monthly_net_profit=monthly_revenue - monthly_expense,
    )


async def recompute_and_store(db: DbSession, user_id: str) -> ScoreResult:
    """Recompute the score and upsert today's history snapshot.

    Safe to call from any data-mutation flow (invoice save, payroll run, …).
    """
    inputs = await _gather_inputs(db, user_id)
    result = compute_muhai_score(inputs)
    by_key = {c.key: c.score for c in result.categories}

    today = date.today()
    existing = await db.scalar(
        select(MuhaiScore)
        .where(MuhaiScore.user_id == user_id)
        .where(MuhaiScore.date == today)
    )
    fields = dict(
        total_score=result.total_score,
        tax_compliance=by_key["tax_compliance"],
        sgk_compliance=by_key["sgk_compliance"],
        cash_flow=by_key["cash_flow"],
        debt=by_key["debt"],
        invoice_collection=by_key["invoice_collection"],
        inventory=by_key["inventory"],
        payroll_sustainability=by_key["payroll_sustainability"],
        profitability=by_key["profitability"],
    )
    if existing is None:
        db.add(MuhaiScore(user_id=user_id, date=today, **fields))
    else:
        for key, value in fields.items():
            setattr(existing, key, value)
    await db.flush()
    return result


def _to_out(result: ScoreResult) -> MuhaiScoreOut:
    return MuhaiScoreOut(
        total_score=result.total_score,
        rating=result.rating,
        cash_runway_days=result.cash_runway_days,
        categories=[
            CategoryScoreOut(
                key=c.key,
                label=c.label,
                weight=c.weight,
                score=c.score,
                points=c.points,
            )
            for c in result.categories
        ],
        strengths=result.strengths,
        risks=result.risks,
        recommendations=result.recommendations,
    )


@router.get("", response_model=MuhaiScoreOut)
async def get_muhai_score(current_user: CurrentUser, db: DbSession) -> MuhaiScoreOut:
    result = await recompute_and_store(db, current_user.id)
    return _to_out(result)


@router.get("/history", response_model=MuhaiScoreHistoryOut)
async def get_muhai_score_history(
    current_user: CurrentUser,
    db: DbSession,
    months: int = Query(6, ge=1, le=24),
) -> MuhaiScoreHistoryOut:
    cutoff = date.today() - timedelta(days=months * 31)
    rows = list(
        await db.scalars(
            select(MuhaiScore)
            .where(MuhaiScore.user_id == current_user.id)
            .where(MuhaiScore.date >= cutoff)
            .order_by(MuhaiScore.date.asc())
        )
    )
    points = [
        MuhaiScoreHistoryPoint(date=r.date, total_score=r.total_score) for r in rows
    ]
    change = (points[-1].total_score - points[0].total_score) if points else 0
    return MuhaiScoreHistoryOut(points=points, change=change)
