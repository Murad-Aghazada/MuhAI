"""Smart reminders endpoints (Module 10).

GET  /api/reminders                 — seed from the tax calendar + list upcoming
POST /api/reminders/{id}/mark-paid  — mark an obligation paid/filed
"""
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.tax_obligation import TaxObligation
from app.schemas.reminder import ReminderOut, RemindersResponse
from app.services.tax_calendar import upcoming_deadlines

router = APIRouter(prefix="/reminders", tags=["reminders"])


async def _seed_obligations(db: DbSession, user_id: str, today: date) -> None:
    """Ensure upcoming calendar deadlines exist as obligations (deduped)."""
    existing = set(
        await db.scalars(
            select(TaxObligation.period).where(TaxObligation.user_id == user_id)
        )
    )
    # period key = "{type}:{due_date}" keeps each occurrence unique.
    for d in upcoming_deadlines(today, count=12):
        period = f"{d.type}:{d.due_date.isoformat()}"
        if period in existing:
            continue
        db.add(
            TaxObligation(
                user_id=user_id,
                type=d.type,
                name=d.name,
                period=period,
                due_date=d.due_date,
                estimated_amount=0,
                paid_amount=0,
                status="pending",
            )
        )
        existing.add(period)
    await db.flush()


@router.get("", response_model=RemindersResponse)
async def get_reminders(
    current_user: CurrentUser,
    db: DbSession,
    days: int = Query(60, ge=1, le=365),
) -> RemindersResponse:
    today = date.today()
    await _seed_obligations(db, current_user.id, today)

    horizon = today + timedelta(days=days)
    rows = list(
        await db.scalars(
            select(TaxObligation)
            .where(TaxObligation.user_id == current_user.id)
            .where(TaxObligation.status == "pending")
            .where(TaxObligation.due_date <= horizon)
            .order_by(TaxObligation.due_date.asc())
        )
    )
    due_soon = sum(1 for r in rows if (r.due_date - today).days <= 7)
    return RemindersResponse(
        reminders=[ReminderOut.model_validate(r) for r in rows],
        due_soon_count=due_soon,
    )


@router.post("/{obligation_id}/mark-paid", response_model=ReminderOut)
async def mark_paid(
    obligation_id: str, current_user: CurrentUser, db: DbSession
) -> ReminderOut:
    ob = await db.get(TaxObligation, obligation_id)
    if ob is None or ob.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Yükümlülük bulunamadı."
        )
    ob.status = "paid"
    ob.paid_date = date.today()
    await db.flush()
    await db.refresh(ob)
    return ReminderOut.model_validate(ob)
