from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    sku: str | None = None
    quantity: int = Field(default=0, ge=0)
    unit_cost: float = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=10, ge=0)


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    quantity: int | None = Field(default=None, ge=0)
    unit_cost: float | None = Field(default=None, ge=0)
    low_stock_threshold: int | None = Field(default=None, ge=0)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    sku: str | None
    quantity: int
    unit_cost: float
    low_stock_threshold: int
    is_low_stock: bool
    created_at: datetime


# ── Movements & predictions (Module 7) ─────────────────────────────────
class MovementCreate(BaseModel):
    product_id: str
    type: str = Field(pattern="^(purchase|sale|adjustment)$")
    quantity: float = Field(gt=0)
    invoice_id: str | None = None
    notes: str | None = None


class MovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    type: str
    quantity: float
    invoice_id: str | None
    date: date
    notes: str | None


class StockPredictionOut(BaseModel):
    item_id: str
    name: str
    current_stock: float
    avg_daily_consumption: float
    days_remaining: float | None
    stockout_date: str | None
    reorder_recommended: bool
    reorder_quantity: float
