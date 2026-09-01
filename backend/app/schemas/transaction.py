import datetime as dt

from pydantic import BaseModel, ConfigDict

from app.db.models.transaction import TransactionType


class TransactionCreate(BaseModel):
    type: TransactionType
    amount: float
    category: str | None = None
    description: str | None = None
    date: dt.date


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: TransactionType
    amount: float
    category: str | None
    description: str | None
    date: dt.date
    created_at: dt.datetime


class CategoryBreakdown(BaseModel):
    category: str
    total: float


class TransactionSummary(BaseModel):
    total_income: float
    total_expense: float
    net: float
    by_category: list[CategoryBreakdown]


class ForecastPoint(BaseModel):
    ds: dt.date
    yhat: float
    yhat_lower: float
    yhat_upper: float


# ── Cash-flow projection (Module 5) ────────────────────────────────────
class ProjectionPointOut(BaseModel):
    date: dt.date
    inflow: float
    outflow: float
    balance: float
    below_threshold: bool


class CashFlowForecastOut(BaseModel):
    starting_balance: float
    threshold: float
    horizon_days: int
    points: list[ProjectionPointOut]
    min_balance: float
    min_balance_date: dt.date | None
    runs_out: bool
    runs_out_date: dt.date | None
    warnings: list[str]
    actions: list[str]
