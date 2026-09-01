import datetime as dt
import enum

from sqlalchemy import Date, Enum, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class MovementType(str, enum.Enum):
    purchase = "purchase"  # stock in
    sale = "sale"  # stock out
    adjustment = "adjustment"


class InventoryMovement(Base, TimestampMixin):
    """A stock-level change for a product (Module 7).

    Purchases increase stock, sales decrease it. Used to derive average daily
    consumption and predict stockout dates.
    """

    __tablename__ = "inventory_movements"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    product_id: Mapped[str] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[MovementType] = mapped_column(
        Enum(MovementType, name="movement_type"), nullable=False
    )
    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    invoice_id: Mapped[str | None] = mapped_column(nullable=True)
    date: Mapped[dt.date] = mapped_column(
        Date, nullable=False, server_default=func.now(), index=True
    )
    notes: Mapped[str | None] = mapped_column(nullable=True)

    product: Mapped["Product"] = relationship(back_populates="movements")  # noqa: F821
