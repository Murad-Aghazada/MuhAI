from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.inventory_movement import InventoryMovement, MovementType
from app.db.models.product import Product
from app.schemas.product import (
    MovementCreate,
    MovementOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    StockPredictionOut,
)
from app.services.inventory_service import DEFAULT_LOOKBACK_DAYS, predict_stock

router = APIRouter(prefix="/products", tags=["inventory"])


async def _get_owned_product(db: DbSession, user_id: str, product_id: str) -> Product:
    product = await db.get(Product, product_id)
    if product is None or product.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ürün bulunamadı."
        )
    return product


@router.get("", response_model=list[ProductOut])
async def list_products(
    current_user: CurrentUser, db: DbSession
) -> list[ProductOut]:
    rows = await db.scalars(
        select(Product)
        .where(Product.user_id == current_user.id)
        .order_by(Product.name.asc())
    )
    return [ProductOut.model_validate(r) for r in rows]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate, current_user: CurrentUser, db: DbSession
) -> ProductOut:
    product = Product(user_id=current_user.id, **payload.model_dump())
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return ProductOut.model_validate(product)


@router.get("/alerts", response_model=list[ProductOut])
async def low_stock_alerts(
    current_user: CurrentUser, db: DbSession
) -> list[ProductOut]:
    rows = await db.scalars(
        select(Product)
        .where(Product.user_id == current_user.id)
        .where(Product.quantity < Product.low_stock_threshold)
        .order_by(Product.quantity.asc())
    )
    return [ProductOut.model_validate(r) for r in rows]


@router.get("/predictions", response_model=list[StockPredictionOut])
async def stock_predictions(
    current_user: CurrentUser, db: DbSession
) -> list[StockPredictionOut]:
    """Per-item burn rate, stockout date and reorder recommendation."""
    cutoff = date.today() - timedelta(days=DEFAULT_LOOKBACK_DAYS)
    products = list(
        await db.scalars(
            select(Product).where(Product.user_id == current_user.id)
        )
    )
    movements = list(
        await db.scalars(
            select(InventoryMovement)
            .where(InventoryMovement.user_id == current_user.id)
            .where(InventoryMovement.type == MovementType.sale)
            .where(InventoryMovement.date >= cutoff)
        )
    )
    consumed: dict[str, float] = {}
    for m in movements:
        consumed[m.product_id] = consumed.get(m.product_id, 0.0) + float(m.quantity)

    return [
        StockPredictionOut(
            **predict_stock(
                p.id,
                p.name,
                float(p.quantity),
                consumed.get(p.id, 0.0),
            ).__dict__
        )
        for p in products
    ]


@router.post("/movement", response_model=MovementOut, status_code=status.HTTP_201_CREATED)
async def record_movement(
    payload: MovementCreate, current_user: CurrentUser, db: DbSession
) -> MovementOut:
    """Record a stock movement and adjust the product quantity accordingly."""
    product = await _get_owned_product(db, current_user.id, payload.product_id)
    mtype = MovementType(payload.type)

    delta = payload.quantity if mtype == MovementType.purchase else -payload.quantity
    if mtype == MovementType.adjustment:
        delta = payload.quantity  # adjustments are signed via quantity sign upstream
    new_qty = max(int(product.quantity + delta), 0)
    product.quantity = new_qty

    movement = InventoryMovement(
        user_id=current_user.id,
        product_id=product.id,
        type=mtype,
        quantity=payload.quantity,
        invoice_id=payload.invoice_id,
        date=date.today(),
        notes=payload.notes,
    )
    db.add(movement)
    await db.flush()
    await db.refresh(movement)
    return MovementOut.model_validate(movement)


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ProductOut:
    product = await _get_owned_product(db, current_user.id, product_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.flush()
    await db.refresh(product)
    return ProductOut.model_validate(product)
