from typing import List

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = uuid_pk()
    email: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(nullable=False)
    business_name: Mapped[str] = mapped_column(nullable=False)

    invoices: Mapped[List["Invoice"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    transactions: Mapped[List["Transaction"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    employees: Mapped[List["Employee"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    products: Mapped[List["Product"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    muhai_scores: Mapped[List["MuhaiScore"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    compliance_alerts: Mapped[List["ComplianceAlert"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    bank_transactions: Mapped[List["BankTransaction"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    tax_obligations: Mapped[List["TaxObligation"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    vendor_categories: Mapped[List["VendorCategory"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
