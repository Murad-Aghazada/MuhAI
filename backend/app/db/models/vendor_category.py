from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class VendorCategory(Base, TimestampMixin):
    """Learned vendor → category mapping (Module 3).

    Populated from classifications and user corrections so the same vendor is
    categorised consistently without repeated AI calls. Unique per (user, vendor).
    """

    __tablename__ = "vendor_categories"
    __table_args__ = (
        UniqueConstraint("user_id", "vendor_key", name="uq_vendor_category"),
    )

    id: Mapped[str] = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    vendor_key: Mapped[str] = mapped_column(nullable=False)  # normalised vendor name
    category: Mapped[str] = mapped_column(nullable=False)
    corrected: Mapped[bool] = mapped_column(default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="vendor_categories")  # noqa: F821
