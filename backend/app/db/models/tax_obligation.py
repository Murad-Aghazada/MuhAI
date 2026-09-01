import datetime as dt

from sqlalchemy import Date, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class TaxObligation(Base, TimestampMixin):
    """A tax/SGK obligation on the calendar (Module 10).

    Seeded from ``tax_calendar`` and persisted so the user can mark each one
    paid/filed. Unique per (user, type, period) to avoid re-seeding duplicates.
    """

    __tablename__ = "tax_obligations"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    period: Mapped[str] = mapped_column(nullable=False)  # e.g. "2026-06"
    due_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    estimated_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    paid_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(default="pending", nullable=False)  # pending | paid
    paid_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)

    user: Mapped["User"] = relationship(back_populates="tax_obligations")  # noqa: F821
