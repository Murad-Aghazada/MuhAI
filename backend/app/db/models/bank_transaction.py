import datetime as dt

from sqlalchemy import Date, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class BankTransaction(Base, TimestampMixin):
    """An imported bank-statement line (Module 6).

    Auto-classified on import and optionally matched to an invoice during
    reconciliation (``matched_invoice_id`` + ``status``).
    """

    __tablename__ = "bank_transactions"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    date: Mapped[dt.date | None] = mapped_column(Date, nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    category: Mapped[str | None] = mapped_column(nullable=True)
    matched_invoice_id: Mapped[str | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(default="unmatched", nullable=False)
    bank_account: Mapped[str | None] = mapped_column(nullable=True)

    user: Mapped["User"] = relationship(back_populates="bank_transactions")  # noqa: F821
