"""Tax engine endpoints (Module 2 — Smart Turkish Tax Engine).

Stateless calculators: no DB access, no ownership checks. Auth is still
required so the engine is only available to logged-in businesses and usage can
be attributed later.
"""
from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas.tax import (
    CorporateTaxRequest,
    CorporateTaxResponse,
    IncomeTaxRequest,
    IncomeTaxResponse,
    KdvRequest,
    KdvResponse,
    SgkRequest,
    SgkResponse,
    StopajRequest,
    StopajResponse,
)
from app.services.tax_service import (
    calc_corporate_tax,
    calc_income_tax,
    calc_kdv,
    calc_sgk,
    calc_stopaj,
)

router = APIRouter(prefix="/tax", tags=["tax"])


@router.post("/kdv", response_model=KdvResponse)
async def kdv(payload: KdvRequest, current_user: CurrentUser) -> KdvResponse:
    result = calc_kdv(payload.amount, payload.rate, payload.inclusive)
    return KdvResponse(net=result.net, kdv=result.kdv, total=result.total, rate=result.rate)


@router.post("/stopaj", response_model=StopajResponse)
async def stopaj(payload: StopajRequest, current_user: CurrentUser) -> StopajResponse:
    result = calc_stopaj(payload.gross, payload.type)
    return StopajResponse(
        gross=result.gross,
        stopaj=result.stopaj,
        stamp=result.stamp,
        net=result.net,
        rate=result.rate,
    )


@router.post("/corporate", response_model=CorporateTaxResponse)
async def corporate(
    payload: CorporateTaxRequest, current_user: CurrentUser
) -> CorporateTaxResponse:
    result = calc_corporate_tax(payload.revenue, payload.expenses, payload.rate)
    return CorporateTaxResponse(
        revenue=result.revenue,
        expenses=result.expenses,
        profit=result.profit,
        rate=result.rate,
        tax=result.tax,
        quarterly_payment=result.quarterly_payment,
    )


@router.post("/income", response_model=IncomeTaxResponse)
async def income(payload: IncomeTaxRequest, current_user: CurrentUser) -> IncomeTaxResponse:
    tax = calc_income_tax(payload.annual_income)
    effective = round(tax / payload.annual_income, 4) if payload.annual_income else 0.0
    return IncomeTaxResponse(
        annual_income=round(payload.annual_income, 2),
        income_tax=tax,
        effective_rate=effective,
    )


@router.post("/sgk", response_model=SgkResponse)
async def sgk(payload: SgkRequest, current_user: CurrentUser) -> SgkResponse:
    result = calc_sgk(payload.gross_salary)
    return SgkResponse(
        gross_salary=result.gross_salary,
        sgk_employee=result.sgk_employee,
        sgk_employer=result.sgk_employer,
        unemployment_employee=result.unemployment_employee,
        unemployment_employer=result.unemployment_employer,
        stamp_tax=result.stamp_tax,
        income_tax=result.income_tax,
        net_salary=result.net_salary,
        total_employer_cost=result.total_employer_cost,
    )
