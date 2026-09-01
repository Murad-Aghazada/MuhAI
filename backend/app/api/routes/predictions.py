"""Prediction engine endpoint (Module 11).

GET /api/predictions/summary — next-month projections + liquidity risk.
"""
from collections import OrderedDict
from datetime import date

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.transaction import Transaction, TransactionType
from app.schemas.prediction import PredictionSummaryOut
from app.services.prediction_service import build_prediction_summary
from app.services.tax_service import calc_kdv

router = APIRouter(prefix="/predictions", tags=["predictions"])

HISTORY_MONTHS = 6


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


@router.get("/summary", response_model=PredictionSummaryOut)
async def predictions_summary(
    current_user: CurrentUser, db: DbSession
) -> PredictionSummaryOut:
    txs = list(
        await db.scalars(select(Transaction).where(Transaction.user_id == current_user.id))
    )

    # Build the last HISTORY_MONTHS month buckets (chronological).
    today = date.today()
    months: "OrderedDict[str, list[float]]" = OrderedDict()
    y, m = today.year, today.month
    keys: list[str] = []
    for _ in range(HISTORY_MONTHS):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    keys.reverse()
    rev = {k: 0.0 for k in keys}
    exp = {k: 0.0 for k in keys}

    for t in txs:
        key = _month_key(t.date)
        if key not in rev:
            continue
        if t.type == TransactionType.income:
            rev[key] += float(t.amount)
        else:
            exp[key] += float(t.amount)

    monthly_revenue = [round(rev[k], 2) for k in keys]
    monthly_expense = [round(exp[k], 2) for k in keys]
    cash_balance = round(
        sum(
            float(t.amount) if t.type == TransactionType.income else -float(t.amount)
            for t in txs
        ),
        2,
    )

    summary = build_prediction_summary(monthly_revenue, monthly_expense, cash_balance)
    est_tax = calc_kdv(summary.predicted_revenue, 0.20, inclusive=True).kdv if summary.predicted_revenue else 0.0

    return PredictionSummaryOut(
        months_of_history=summary.months_of_history,
        predicted_revenue=summary.predicted_revenue,
        predicted_expense=summary.predicted_expense,
        predicted_profit=summary.predicted_profit,
        revenue_trend=summary.revenue_trend,
        liquidity_runway_days=summary.liquidity_runway_days,
        liquidity_level=summary.liquidity_level,
        estimated_tax_next_month=round(est_tax, 2),
    )
