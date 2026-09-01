"""Response model for the single-call dashboard aggregator (Module 13)."""
from datetime import date

from pydantic import BaseModel


class RevenueSection(BaseModel):
    today: float
    this_week: float
    this_month: float
    this_year: float
    month_change_pct: float | None  # vs last month; None when no baseline


class CategoryBreakdown(BaseModel):
    category: str
    total: float


class ExpenseSection(BaseModel):
    this_month: float
    this_year: float
    by_category: list[CategoryBreakdown]


class ProfitSection(BaseModel):
    this_month: float
    this_year: float
    net_margin_pct: float | None


class TaxSection(BaseModel):
    kdv_paid_ytd: float
    estimated_kdv_next_month: float
    estimated_corporate_tax: float


class PayrollSection(BaseModel):
    monthly_cost: float
    headcount: int


class InventorySection(BaseModel):
    total_skus: int
    low_stock_count: int


class CashSection(BaseModel):
    balance: float
    runway_days: float


class ScoreSection(BaseModel):
    total_score: int
    rating: str


class AlertItem(BaseModel):
    type: str
    severity: str  # "high" | "medium" | "low"
    message: str


class DeadlineItem(BaseModel):
    type: str
    name: str
    due_date: date
    days_remaining: int
    due_soon: bool


class DashboardOut(BaseModel):
    revenue: RevenueSection
    expenses: ExpenseSection
    profit: ProfitSection
    taxes: TaxSection
    payroll: PayrollSection
    inventory: InventorySection
    cash: CashSection
    muhai_score: ScoreSection
    alerts: list[AlertItem]
    upcoming_deadlines: list[DeadlineItem]
