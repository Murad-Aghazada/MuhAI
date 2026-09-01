from datetime import date, timedelta

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.transaction import Transaction, TransactionType
from app.schemas.transaction import (
    CategoryBreakdown,
    ForecastPoint,
    TransactionCreate,
    TransactionOut,
    TransactionSummary,
)
from app.services.forecast_service import forecast_cashflow

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    current_user: CurrentUser,
    db: DbSession,
    start: date | None = Query(None),
    end: date | None = Query(None),
) -> list[TransactionOut]:
    stmt = select(Transaction).where(Transaction.user_id == current_user.id)
    if start is not None:
        stmt = stmt.where(Transaction.date >= start)
    if end is not None:
        stmt = stmt.where(Transaction.date <= end)
    rows = await db.scalars(stmt.order_by(Transaction.date.desc()))
    return [TransactionOut.model_validate(r) for r in rows]


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate, current_user: CurrentUser, db: DbSession
) -> TransactionOut:
    tx = Transaction(user_id=current_user.id, **payload.model_dump())
    db.add(tx)
    await db.flush()
    await db.refresh(tx)
    return TransactionOut.model_validate(tx)


@router.get("/summary", response_model=TransactionSummary)
async def summary(current_user: CurrentUser, db: DbSession) -> TransactionSummary:
    rows = list(
        await db.scalars(
            select(Transaction).where(Transaction.user_id == current_user.id)
        )
    )
    total_income = sum(float(t.amount) for t in rows if t.type == TransactionType.income)
    total_expense = sum(
        float(t.amount) for t in rows if t.type == TransactionType.expense
    )

    by_cat: dict[str, float] = {}
    for t in rows:
        key = t.category or "Diğer"
        signed = float(t.amount) if t.type == TransactionType.income else -float(t.amount)
        by_cat[key] = round(by_cat.get(key, 0.0) + signed, 2)

    return TransactionSummary(
        total_income=round(total_income, 2),
        total_expense=round(total_expense, 2),
        net=round(total_income - total_expense, 2),
        by_category=[
            CategoryBreakdown(category=k, total=v) for k, v in by_cat.items()
        ],
    )


@router.get("/forecast", response_model=list[ForecastPoint])
async def forecast(current_user: CurrentUser, db: DbSession) -> list[ForecastPoint]:
    """30-day daily net cash-flow forecast (Prophet)."""
    cutoff = date.today() - timedelta(days=90)
    rows = list(
        await db.scalars(
            select(Transaction)
            .where(Transaction.user_id == current_user.id)
            .where(Transaction.date >= cutoff)
            .order_by(Transaction.date.asc())
        )
    )

    # Aggregate into daily net totals.
    daily: dict[date, float] = {}
    for t in rows:
        signed = float(t.amount) if t.type == TransactionType.income else -float(t.amount)
        daily[t.date] = round(daily.get(t.date, 0.0) + signed, 2)

    history = sorted(daily.items())
    return forecast_cashflow(history)
