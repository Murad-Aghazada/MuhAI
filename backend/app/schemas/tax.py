"""Request/response models for the tax engine API (Module 2)."""
from typing import Literal

from pydantic import BaseModel, Field

# ── KDV ────────────────────────────────────────────────────────────────
class KdvRequest(BaseModel):
    amount: float = Field(gt=0, description="Net tutar veya KDV dahil toplam.")
    rate: float = Field(
        default=0.20, ge=0, le=1, description="KDV oranı (0.20, 0.10, 0.01, 0)."
    )
    inclusive: bool = Field(
        default=False, description="amount KDV dahil mi? (KDV Dahil / KDV Hariç)"
    )


class KdvResponse(BaseModel):
    net: float
    kdv: float
    total: float
    rate: float


# ── Stopaj ─────────────────────────────────────────────────────────────
class StopajRequest(BaseModel):
    gross: float = Field(gt=0, description="Brüt ödeme tutarı.")
    type: Literal["rent", "freelancer", "professional"] = "rent"


class StopajResponse(BaseModel):
    gross: float
    stopaj: float
    stamp: float
    net: float
    rate: float


# ── Corporate tax ──────────────────────────────────────────────────────
class CorporateTaxRequest(BaseModel):
    revenue: float = Field(ge=0)
    expenses: float = Field(ge=0)
    rate: float = Field(default=0.25, ge=0, le=1)


class CorporateTaxResponse(BaseModel):
    revenue: float
    expenses: float
    profit: float
    rate: float
    tax: float
    quarterly_payment: float


# ── Income tax ─────────────────────────────────────────────────────────
class IncomeTaxRequest(BaseModel):
    annual_income: float = Field(ge=0, description="Yıllık vergiye tabi gelir.")


class IncomeTaxResponse(BaseModel):
    annual_income: float
    income_tax: float
    effective_rate: float


# ── SGK / payroll ──────────────────────────────────────────────────────
class SgkRequest(BaseModel):
    gross_salary: float = Field(gt=0, description="Aylık brüt maaş.")


class SgkResponse(BaseModel):
    gross_salary: float
    sgk_employee: float
    sgk_employer: float
    unemployment_employee: float
    unemployment_employer: float
    stamp_tax: float
    income_tax: float
    net_salary: float
    total_employer_cost: float
