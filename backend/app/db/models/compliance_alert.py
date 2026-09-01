import datetime as dt

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class ComplianceAlert(Base, TimestampMixin):
    """A detected compliance issue (Module 8).

    Persisted so alerts survive across checks and the user can mark them
    resolved. Re-running the checks upserts by (user, type, description, ref_id)
    so the same open issue is not duplicated.
    """

    __tablename__ = "compliance_alerts"

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(nullable=False)
    severity: Mapped[str] = mapped_column(nullable=False)  # high | medium | low
    description: Mapped[str] = mapped_column(Text, nullable=False)
    ref_id: Mapped[str | None] = mapped_column(nullable=True)
    detected_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="compliance_alerts")  # noqa: F821
