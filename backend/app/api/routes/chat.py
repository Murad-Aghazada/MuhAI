"""AI Business Advisor chatbot endpoints (Module 9)."""
from datetime import date, timedelta

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.api.routes.muhai_score import recompute_and_store
from app.db.models.invoice import Invoice, InvoiceStatus
from app.db.models.product import Product
from app.db.models.transaction import Transaction, TransactionType
from app.schemas.chat import ChatRequest, ChatResponse, QuickQuestionsResponse
from app.services.chat_service import (
    QUICK_QUESTIONS,
    BusinessContext,
    get_chat_reply,
)
from app.services.tax_calendar import upcoming_deadlines
from app.services.tax_service import calc_kdv

router = APIRouter(prefix="/chat", tags=["chat"])


async def _build_context(db: DbSession, user_id: str) -> BusinessContext:
    today = date.today()
    month_start = today.replace(day=1)

    txs = list(await db.scalars(select(Transaction).where(Transaction.user_id == user_id)))
    monthly_revenue = monthly_expenses = 0.0
    cash = 0.0
    for t in txs:
        amount = float(t.amount)
        signed = amount if t.type == TransactionType.income else -amount
        cash += signed
        if t.date >= month_start:
            if t.type == TransactionType.income:
                monthly_revenue += amount
            else:
                monthly_expenses += amount

    invoices = list(await db.scalars(select(Invoice).where(Invoice.user_id == user_id)))
    unpaid = [i for i in invoices if i.status == InvoiceStatus.pending]
    unpaid_amount = round(sum(float(i.amount or 0) for i in unpaid), 2)

    products = list(await db.scalars(select(Product).where(Product.user_id == user_id)))
    low_stock = [p.name for p in products if p.is_low_stock]

    deadlines = upcoming_deadlines(today, count=1)
    next_tax = deadlines[0] if deadlines else None
    kdv_estimate = (
        calc_kdv(monthly_revenue, 0.20, inclusive=True).kdv if monthly_revenue else 0.0
    )

    score = await recompute_and_store(db, user_id)

    return BusinessContext(
        monthly_revenue=round(monthly_revenue, 2),
        monthly_expenses=round(monthly_expenses, 2),
        cash_balance=round(cash, 2),
        unpaid_invoices=len(unpaid),
        unpaid_amount=unpaid_amount,
        next_tax_type=("KDV" if next_tax and next_tax.type == "kdv" else (next_tax.name if next_tax else None)),
        next_tax_amount=round(kdv_estimate, 2),
        next_tax_date=next_tax.due_date.isoformat() if next_tax else None,
        low_stock_items=low_stock,
        muhai_score=score.total_score,
    )


@router.get("/quick-questions", response_model=QuickQuestionsResponse)
async def quick_questions(current_user: CurrentUser) -> QuickQuestionsResponse:
    return QuickQuestionsResponse(questions=QUICK_QUESTIONS)


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest, current_user: CurrentUser, db: DbSession
) -> ChatResponse:
    ctx = await _build_context(db, current_user.id)
    return get_chat_reply(payload.message, ctx)
