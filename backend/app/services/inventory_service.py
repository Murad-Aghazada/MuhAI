"""Inventory Intelligence (Module 7).

Pure prediction helpers: average daily consumption from recent movements,
stockout-date projection, and a reorder-quantity recommendation based on lead
time + safety stock. The route layer feeds in current stock and the movement
history; this module does the maths.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

DEFAULT_LOOKBACK_DAYS = 30
DEFAULT_LEAD_TIME_DAYS = 7
DEFAULT_SAFETY_DAYS = 7
DEFAULT_ALERT_DAYS = 7


@dataclass
class StockPrediction:
    item_id: str
    name: str
    current_stock: float
    avg_daily_consumption: float
    days_remaining: float | None  # None = no consumption observed
    stockout_date: str | None
    reorder_recommended: bool
    reorder_quantity: float


def avg_daily_consumption(total_consumed: float, lookback_days: int = DEFAULT_LOOKBACK_DAYS) -> float:
    if lookback_days <= 0:
        return 0.0
    return round(max(total_consumed, 0.0) / lookback_days, 4)


def predict_stock(
    item_id: str,
    name: str,
    current_stock: float,
    total_consumed: float,
    *,
    today: date | None = None,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    lead_time_days: int = DEFAULT_LEAD_TIME_DAYS,
    safety_days: int = DEFAULT_SAFETY_DAYS,
    alert_days: int = DEFAULT_ALERT_DAYS,
) -> StockPrediction:
    today = today or date.today()
    burn = avg_daily_consumption(total_consumed, lookback_days)

    if burn <= 0:
        return StockPrediction(
            item_id=item_id,
            name=name,
            current_stock=round(current_stock, 2),
            avg_daily_consumption=0.0,
            days_remaining=None,
            stockout_date=None,
            reorder_recommended=False,
            reorder_quantity=0.0,
        )

    days_remaining = round(current_stock / burn, 1)
    stockout = (today + timedelta(days=int(days_remaining))).isoformat()
    reorder = days_remaining < alert_days
    # Order enough to cover lead time + safety stock, minus what's left.
    target = burn * (lead_time_days + safety_days)
    reorder_qty = round(max(target - current_stock, 0.0), 2) if reorder else 0.0

    return StockPrediction(
        item_id=item_id,
        name=name,
        current_stock=round(current_stock, 2),
        avg_daily_consumption=burn,
        days_remaining=days_remaining,
        stockout_date=stockout,
        reorder_recommended=reorder,
        reorder_quantity=reorder_qty,
    )


def apply_recipe_deduction(
    recipe: dict[str, float], units_sold: float
) -> dict[str, float]:
    """Given a recipe {ingredient_id: qty_per_unit}, return total deductions."""
    return {item: round(qty * units_sold, 4) for item, qty in recipe.items()}
