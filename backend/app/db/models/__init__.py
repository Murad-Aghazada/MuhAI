"""Aggregates all ORM models so importing this package registers them on
``Base.metadata`` (used by Alembic autogenerate). Kept separate from
``app.db.base`` to avoid a circular import between base and the models.

Two families live here:

* ``Company`` and the ``Company*`` tables are the current system of record —
  the company workspace the web client reads and writes.
* the older user-scoped tables (``Invoice``, ``Transaction``, …) back the
  legacy ``/api/invoices``-style routes. They are deprecated; nothing in the
  web app calls them any more.
"""
from app.db.models.company import (
    Company,
    CompanyEmployee,
    CompanyInvoice,
    CompanyProduct,
    CompanyTaxObligation,
    CompanyTransaction,
    CompanyVendorCategory,
)
from app.db.models.user import User
from app.db.models.invoice import Invoice
from app.db.models.transaction import Transaction
from app.db.models.employee import Employee
from app.db.models.product import Product
from app.db.models.muhai_score import MuhaiScore
from app.db.models.compliance_alert import ComplianceAlert
from app.db.models.inventory_movement import InventoryMovement
from app.db.models.bank_transaction import BankTransaction
from app.db.models.tax_obligation import TaxObligation
from app.db.models.vendor_category import VendorCategory

__all__ = [
    "Company",
    "CompanyInvoice",
    "CompanyTransaction",
    "CompanyProduct",
    "CompanyEmployee",
    "CompanyTaxObligation",
    "CompanyVendorCategory",
    "User",
    "Invoice",
    "Transaction",
    "Employee",
    "Product",
    "MuhaiScore",
    "ComplianceAlert",
    "InventoryMovement",
    "BankTransaction",
    "TaxObligation",
    "VendorCategory",
]
