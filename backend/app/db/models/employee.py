import datetime as dt

from sqlalchemy import Date, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class Employee(Base, TimestampMixin):
    __tablename__ = "employees"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    tckn: Mapped[str | None] = mapped_column(nullable=True)
    position: Mapped[str | None] = mapped_column(nullable=True)
    base_salary: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    # SGK employee contribution rate (defaults to Turkey's 14%).
    sgk_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.14)
    # Employment start date — drives severance & annual-leave accrual.
    start_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(default="active", nullable=False)

    user: Mapped["User"] = relationship(back_populates="employees")  # noqa: F821
