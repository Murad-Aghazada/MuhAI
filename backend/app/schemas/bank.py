"""Schemas for bank import & reconciliation (Module 6)."""
from datetime import date

from pydantic import BaseModel, ConfigDict


class BankTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    date: date | None
    description: str | None
    amount: float
    category: str | None
    matched_invoice_id: str | None
    status: str
    bank_account: str | None


class ImportResult(BaseModel):
    imported: int
    skipped: int
    by_category: dict[str, int]


class ReconcileResult(BaseModel):
    total: int
    matched: int
    unmatched: int
    match_rate: float
