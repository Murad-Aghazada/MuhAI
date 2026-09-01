"""AI Prediction Engine (Module 11).

Pure forecasting helpers built on a tiny ordinary-least-squares linear
regression (no numpy dependency) over monthly aggregates. Used for next-month
profit/revenue/expense projections and a liquidity-risk score from cash runway.
"""
from __future__ import annotations

from dataclasses import dataclass


def linear_regression(values: list[float]) -> tuple[float, float]:
    """OLS fit of y = a + b·x over x = 0..n-1. Returns (intercept, slope)."""
    n = len(values)
    if n == 0:
        return 0.0, 0.0
    if n == 1:
        return values[0], 0.0
    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    denom = sum((x - mean_x) ** 2 for x in xs)
    if denom == 0:
        return mean_y, 0.0
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values)) / denom
    intercept = mean_y - slope * mean_x
    return intercept, slope


def project_next(values: list[float]) -> float:
    """Predict the next point in the series via linear trend (floored at 0)."""
    if not values:
        return 0.0
    intercept, slope = linear_regression(values)
    nxt = intercept + slope * len(values)
    return round(max(nxt, 0.0), 2)


@dataclass
class LiquidityRisk:
    runway_days: float
    level: str  # "red" | "yellow" | "green"


def liquidity_risk(cash_balance: float, monthly_operating_expense: float) -> LiquidityRisk:
    daily = monthly_operating_expense / 30.0
    if daily <= 0:
        runway = 9999.0 if cash_balance > 0 else 0.0
    else:
        runway = round(max(cash_balance, 0.0) / daily, 1)
    if runway < 30:
        level = "red"
    elif runway <= 90:
        level = "yellow"
    else:
        level = "green"
    return LiquidityRisk(runway_days=min(runway, 9999.0), level=level)


@dataclass
class PredictionSummary:
    months_of_history: int
    predicted_revenue: float
    predicted_expense: float
    predicted_profit: float
    revenue_trend: str  # "up" | "down" | "flat"
    liquidity_runway_days: float
    liquidity_level: str


def _trend(values: list[float]) -> str:
    if len(values) < 2:
        return "flat"
    _, slope = linear_regression(values)
    if slope > 0.01 * (abs(sum(values) / len(values)) + 1):
        return "up"
    if slope < -0.01 * (abs(sum(values) / len(values)) + 1):
        return "down"
    return "flat"


def build_prediction_summary(
    monthly_revenue: list[float],
    monthly_expense: list[float],
    cash_balance: float,
) -> PredictionSummary:
    pred_rev = project_next(monthly_revenue)
    pred_exp = project_next(monthly_expense)
    last_exp = monthly_expense[-1] if monthly_expense else 0.0
    risk = liquidity_risk(cash_balance, last_exp)
    return PredictionSummary(
        months_of_history=max(len(monthly_revenue), len(monthly_expense)),
        predicted_revenue=pred_rev,
        predicted_expense=pred_exp,
        predicted_profit=round(pred_rev - pred_exp, 2),
        revenue_trend=_trend(monthly_revenue),
        liquidity_runway_days=risk.runway_days,
        liquidity_level=risk.level,
    )
