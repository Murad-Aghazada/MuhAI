import datetime as dt

from sqlalchemy import Date, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class MuhaiScore(Base, TimestampMixin):
    """Historical snapshot of a business's Muhai Score (Module 12).

    One row per (user, date); the route upserts the day's snapshot so history
    accumulates one point per day and the trend chart can read it back.
    Sub-scores are stored as 0..1 fractions; ``total_score`` is 0..100.
    """

    __tablename__ = "muhai_scores"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False)

    tax_compliance: Mapped[float] = mapped_column(Numeric(5, 4), default=0)
    sgk_compliance: Mapped[float] = mapped_column(Numeric(5, 4), default=0)
    cash_flow: Mapped[float] = mapped_column(Numeric(5, 4), default=0)
    debt: Mapped[float] = mapped_column(Numeric(5, 4), default=0)
    invoice_collection: Mapped[float] = mapped_column(Numeric(5, 4), default=0)
    inventory: Mapped[float] = mapped_column(Numeric(5, 4), default=0)
    payroll_sustainability: Mapped[float] = mapped_column(Numeric(5, 4), default=0)
    profitability: Mapped[float] = mapped_column(Numeric(5, 4), default=0)

    user: Mapped["User"] = relationship(back_populates="muhai_scores")  # noqa: F821
