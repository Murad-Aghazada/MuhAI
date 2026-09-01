"""Expense classification endpoints (Module 3).

POST /api/expenses/classify  — categorise an expense (cache → rules/AI)
POST /api/expenses/correct   — store a user correction to improve future runs
"""
from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.vendor_category import VendorCategory
from app.schemas.expense import (
    ClassifyRequest,
    ClassifyResponse,
    CorrectionRequest,
)
from app.services.expense_classifier import CATEGORIES, classify_expense

router = APIRouter(prefix="/expenses", tags=["expenses"])


def _vendor_key(vendor: str | None) -> str | None:
    if not vendor:
        return None
    return vendor.strip().lower()


@router.post("/classify", response_model=ClassifyResponse)
async def classify(
    payload: ClassifyRequest, current_user: CurrentUser, db: DbSession
) -> ClassifyResponse:
    key = _vendor_key(payload.vendor)

    # 1) Per-vendor cache (learned / corrected) wins.
    if key:
        cached = await db.scalar(
            select(VendorCategory)
            .where(VendorCategory.user_id == current_user.id)
            .where(VendorCategory.vendor_key == key)
        )
        if cached is not None:
            return ClassifyResponse(category=cached.category, source="cache")

    # 2) Rule-based classification (AI hook lives in the service for live keys).
    category = classify_expense(payload.description, payload.vendor)

    # 3) Cache the result for this vendor to reduce future work.
    if key:
        db.add(
            VendorCategory(
                user_id=current_user.id,
                vendor_key=key,
                category=category,
                corrected=False,
            )
        )
        await db.flush()

    return ClassifyResponse(category=category, source="rules")


@router.post("/correct", response_model=ClassifyResponse)
async def correct(
    payload: CorrectionRequest, current_user: CurrentUser, db: DbSession
) -> ClassifyResponse:
    """Record a correction; future classifications for this vendor use it."""
    category = payload.category if payload.category in CATEGORIES else "other"
    key = payload.vendor.strip().lower()

    existing = await db.scalar(
        select(VendorCategory)
        .where(VendorCategory.user_id == current_user.id)
        .where(VendorCategory.vendor_key == key)
    )
    if existing is not None:
        existing.category = category
        existing.corrected = True
    else:
        db.add(
            VendorCategory(
                user_id=current_user.id,
                vendor_key=key,
                category=category,
                corrected=True,
            )
        )
    await db.flush()
    return ClassifyResponse(category=category, source="cache")
