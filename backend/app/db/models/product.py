from typing import List

from sqlalchemy import ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    sku: Mapped[str | None] = mapped_column(nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10)

    user: Mapped["User"] = relationship(back_populates="products")  # noqa: F821
    movements: Mapped[List["InventoryMovement"]] = relationship(  # noqa: F821
        back_populates="product", cascade="all, delete-orphan"
    )

    @property
    def is_low_stock(self) -> bool:
        return self.quantity < self.low_stock_threshold
