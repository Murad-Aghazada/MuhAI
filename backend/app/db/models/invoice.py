import datetime as dt
import enum

from sqlalchemy import Date, Enum, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class InvoiceStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    invoice_number: Mapped[str | None] = mapped_column(nullable=True)
    vendor_name: Mapped[str | None] = mapped_column(nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    vat_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoice_status"),
        default=InvoiceStatus.pending,
        nullable=False,
    )
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url: Mapped[str | None] = mapped_column(nullable=True)

    user: Mapped["User"] = relationship(back_populates="invoices")  # noqa: F821
