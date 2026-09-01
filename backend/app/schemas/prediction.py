"""Schemas for the prediction engine (Module 11)."""
from pydantic import BaseModel


class PredictionSummaryOut(BaseModel):
    months_of_history: int
    predicted_revenue: float
    predicted_expense: float
    predicted_profit: float
    revenue_trend: str  # up | down | flat
    liquidity_runway_days: float
    liquidity_level: str  # red | yellow | green
    estimated_tax_next_month: float
