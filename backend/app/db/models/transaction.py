import datetime as dt
import enum

from sqlalchemy import Date, Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"


class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, name="transaction_type"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    category: Mapped[str | None] = mapped_column(nullable=True)
    description: Mapped[str | None] = mapped_column(nullable=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)

    user: Mapped["User"] = relationship(back_populates="transactions")  # noqa: F821
