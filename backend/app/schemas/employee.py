from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1)
    tckn: str | None = None
    position: str | None = None
    base_salary: float = Field(gt=0)
    sgk_rate: float = Field(default=0.14, ge=0, le=1)
    start_date: date | None = None
    status: str = "active"


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    tckn: str | None = None
    position: str | None
    base_salary: float
    sgk_rate: float
    start_date: date | None = None
    status: str = "active"
    created_at: datetime


class Payslip(BaseModel):
    employee_id: str
    name: str
    gross_salary: float
    sgk_deduction: float
    income_tax: float
    net_salary: float


class PayrollRunResult(BaseModel):
    payslips: list[Payslip]
    total_gross: float
    total_net: float
    total_deductions: float


# ── Detailed payslip (Module 4) ────────────────────────────────────────
class PayslipCalcRequest(BaseModel):
    gross_salary: float = Field(gt=0)
    overtime_weekday_hours: float = Field(default=0, ge=0)
    overtime_weekend_hours: float = Field(default=0, ge=0)
    bonus: float = Field(default=0, ge=0)
    meal_allowance: float = Field(default=0, ge=0)
    transport_allowance: float = Field(default=0, ge=0)
    worked_days: int = Field(default=30, ge=1, le=31)
    start_date: date | None = None


class DetailedPayslipOut(BaseModel):
    gross_salary: float
    overtime_pay: float
    bonus: float
    meal_allowance: float
    transport_allowance: float
    total_earnings: float
    meal_exempt: float
    transport_exempt: float
    taxable_base: float
    sgk_employee: float
    unemployment_employee: float
    income_tax: float
    stamp_tax: float
    total_deductions: float
    net_salary: float
    sgk_employer: float
    unemployment_employer: float
    total_employer_cost: float
    tenure_years: float
    severance_estimate: float
    annual_leave_days: int


# ── Monthly SGK declaration (Module 4) ─────────────────────────────────
class SgkDeclarationLine(BaseModel):
    employee_id: str
    name: str
    tckn: str | None
    gross: float
    sgk_employee: float
    sgk_employer: float
    unemployment_employee: float
    unemployment_employer: float
    income_tax: float
    stamp_tax: float


class SgkDeclaration(BaseModel):
    month: int
    year: int
    lines: list[SgkDeclarationLine]
    headcount: int
    total_gross: float
    total_sgk_employee: float
    total_sgk_employer: float
    total_premium: float  # combined SGK + unemployment, employer + employee
    due_date: date
