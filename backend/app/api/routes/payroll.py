import calendar
from datetime import date

from fastapi import APIRouter, HTTPException, Path, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.employee import Employee
from app.schemas.employee import (
    DetailedPayslipOut,
    EmployeeCreate,
    EmployeeOut,
    PayrollRunResult,
    PayslipCalcRequest,
    Payslip,
    SgkDeclaration,
    SgkDeclarationLine,
)
from app.services.payroll_service import calc_detailed_payslip
from app.services.tax_service import calc_payslip, calc_sgk

router = APIRouter(tags=["payroll"])


def _build_payslip(emp: Employee) -> Payslip:
    result = calc_payslip(float(emp.base_salary), float(emp.sgk_rate))
    return Payslip(
        employee_id=emp.id,
        name=emp.name,
        gross_salary=result.gross_salary,
        sgk_deduction=result.sgk_deduction,
        income_tax=result.income_tax,
        net_salary=result.net_salary,
    )


@router.get("/employees", response_model=list[EmployeeOut])
async def list_employees(
    current_user: CurrentUser, db: DbSession
) -> list[EmployeeOut]:
    rows = await db.scalars(
        select(Employee)
        .where(Employee.user_id == current_user.id)
        .order_by(Employee.created_at.desc())
    )
    return [EmployeeOut.model_validate(r) for r in rows]


@router.post("/employees", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate, current_user: CurrentUser, db: DbSession
) -> EmployeeOut:
    emp = Employee(user_id=current_user.id, **payload.model_dump())
    db.add(emp)
    await db.flush()
    await db.refresh(emp)
    return EmployeeOut.model_validate(emp)


@router.get("/employees/{employee_id}/payslip", response_model=Payslip)
async def get_payslip(
    employee_id: str, current_user: CurrentUser, db: DbSession
) -> Payslip:
    emp = await db.get(Employee, employee_id)
    if emp is None or emp.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Çalışan bulunamadı."
        )
    return _build_payslip(emp)


@router.post("/payroll/calculate", response_model=DetailedPayslipOut)
async def calculate_payslip(
    payload: PayslipCalcRequest, current_user: CurrentUser
) -> DetailedPayslipOut:
    """Full payslip from ad-hoc inputs (overtime, allowances, bonus, tenure)."""
    slip = calc_detailed_payslip(
        payload.gross_salary,
        overtime_weekday_hours=payload.overtime_weekday_hours,
        overtime_weekend_hours=payload.overtime_weekend_hours,
        bonus=payload.bonus,
        meal_allowance=payload.meal_allowance,
        transport_allowance=payload.transport_allowance,
        worked_days=payload.worked_days,
        start_date=payload.start_date,
    )
    return DetailedPayslipOut(**slip.__dict__)


@router.get(
    "/payroll/sgk-declaration/{year}/{month}", response_model=SgkDeclaration
)
async def sgk_declaration(
    current_user: CurrentUser,
    db: DbSession,
    year: int = Path(ge=2020, le=2100),
    month: int = Path(ge=1, le=12),
) -> SgkDeclaration:
    """e-SGK style monthly premium declaration for all active employees."""
    rows = list(
        await db.scalars(
            select(Employee).where(Employee.user_id == current_user.id)
        )
    )
    lines: list[SgkDeclarationLine] = []
    for emp in rows:
        if emp.status not in (None, "active"):
            continue
        s = calc_sgk(float(emp.base_salary))
        lines.append(
            SgkDeclarationLine(
                employee_id=emp.id,
                name=emp.name,
                tckn=emp.tckn,
                gross=s.gross_salary,
                sgk_employee=s.sgk_employee,
                sgk_employer=s.sgk_employer,
                unemployment_employee=s.unemployment_employee,
                unemployment_employer=s.unemployment_employer,
                income_tax=s.income_tax,
                stamp_tax=s.stamp_tax,
            )
        )

    total_premium = round(
        sum(
            ln.sgk_employee
            + ln.sgk_employer
            + ln.unemployment_employee
            + ln.unemployment_employer
            for ln in lines
        ),
        2,
    )
    # SGK premiums are paid on the 23rd of the month following the period.
    decl_month = month + 1
    decl_year = year + (decl_month - 1) // 12
    decl_month = (decl_month - 1) % 12 + 1
    due_day = min(23, calendar.monthrange(decl_year, decl_month)[1])

    return SgkDeclaration(
        month=month,
        year=year,
        lines=lines,
        headcount=len(lines),
        total_gross=round(sum(ln.gross for ln in lines), 2),
        total_sgk_employee=round(sum(ln.sgk_employee for ln in lines), 2),
        total_sgk_employer=round(sum(ln.sgk_employer for ln in lines), 2),
        total_premium=total_premium,
        due_date=date(decl_year, decl_month, due_day),
    )


@router.post("/payroll/run", response_model=PayrollRunResult)
async def run_payroll(current_user: CurrentUser, db: DbSession) -> PayrollRunResult:
    """Bulk payslip generation for all employees of the current user."""
    rows = list(
        await db.scalars(
            select(Employee).where(Employee.user_id == current_user.id)
        )
    )
    payslips = [_build_payslip(emp) for emp in rows]
    return PayrollRunResult(
        payslips=payslips,
        total_gross=round(sum(p.gross_salary for p in payslips), 2),
        total_net=round(sum(p.net_salary for p in payslips), 2),
        total_deductions=round(
            sum(p.sgk_deduction + p.income_tax for p in payslips), 2
        ),
    )
