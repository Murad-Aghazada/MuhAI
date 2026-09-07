"""Stateless compute endpoints — the API the web client actually calls.

Firestore is the system of record. The browser posts the company's data here
and gets back everything that is genuinely *computed*: the 2026 Turkish tax
engine, the Muhai Score, Prophet cash-flow forecasting, payroll, expense
classification, Tesseract OCR and the grounded assistant.

Nothing in this module reads or writes the database, so the whole surface is a
pure function of the request body plus today's date.
"""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.firebase_deps import CurrentFirebaseUser
from app.schemas.compute import (
    BusinessSnapshot,
    ClassifyBatchRequest,
    ClassifyBatchResponse,
    ClassifiedItem,
    ComputeChatRequest,
    ComputeChatResponse,
    DashboardOut,
    DeadlineOut,
    ForecastOut,
    MuhaiScoreOut,
    PayrollRunOut,
    PayslipOut,
    TaxSummaryOut,
)
from app.schemas.invoice import OcrExtractResult
from app.services import compute_service as agg
from app.services.chat_service import BusinessContext, get_chat_reply
from app.services.expense_classifier import CATEGORIES, classify_expense
from app.services.forecast_service import MIN_POINTS_FOR_PROPHET, forecast_cashflow
from app.services.muhai_score_service import compute_muhai_score
from app.services.ocr_service import scan_invoice
from app.services.payroll_service import calc_detailed_payslip
from app.services.tax_calendar import upcoming_deadlines
from app.services.tax_service import (
    CORPORATE_TAX_RATE,
    VAT_STANDARD,
    calc_corporate_tax,
    calc_kdv,
    calc_stopaj,
)

router = APIRouter(prefix="/compute", tags=["compute"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _as_of(snapshot: BusinessSnapshot) -> dt.date:
    return snapshot.as_of or dt.date.today()


def _deadlines(today: dt.date, count: int = 4) -> list[DeadlineOut]:
    return [
        DeadlineOut(
            type=d.type,
            name=d.name,
            due_date=d.due_date,
            days_remaining=d.days_remaining,
            is_due_soon=d.is_due_soon,
        )
        for d in upcoming_deadlines(today, count=count)
    ]


def _kdv_for(income: float, expense: float) -> float:
    """Net KDV position for a month: collected on sales less paid on purchases."""
    collected = calc_kdv(income, VAT_STANDARD, inclusive=True).kdv
    paid = calc_kdv(expense, VAT_STANDARD, inclusive=True).kdv
    return round(max(collected - paid, 0.0), 2)


def _insight(series: list[dict], rollup: dict, runway_days: float) -> str:
    """One concrete, data-derived sentence for the dashboard card."""
    if not series:
        return "Henüz analiz edilecek hareket yok. İlk faturanızı yükleyerek başlayın."

    current, previous = series[-1], (series[-2] if len(series) > 1 else series[-1])

    if rollup["overdue_count"] > 0:
        return (
            f"{rollup['overdue_count']} fatura vadesini geçti; toplam "
            f"{rollup['receivables']:,.0f} ₺ tahsilat bekliyor. Tahsilat "
            "hatırlatması göndermek nakit akışınızı doğrudan iyileştirir."
        )
    if current["expense"] > previous["expense"] * 1.15 and previous["expense"] > 0:
        jump = (current["expense"] / previous["expense"] - 1) * 100
        return (
            f"Giderleriniz geçen aya göre %{jump:.0f} arttı. En büyük gider "
            "kalemini inceleyip tekrar eden abonelikleri gözden geçirin."
        )
    if runway_days < 60:
        return (
            f"Nakit rezerviniz mevcut gider hızıyla yaklaşık {runway_days:.0f} gün "
            "yetiyor. 90 günün altındaki pist riskli kabul edilir."
        )
    if current["profit"] > previous["profit"]:
        growth = current["profit"] - previous["profit"]
        return (
            f"Net kârınız geçen aya göre {growth:,.0f} ₺ arttı. Bu trend sürerse "
            "geçici vergi matrahınız da yükselecek — nakit ayırmayı planlayın."
        )
    return (
        f"Bu ay {current['income']:,.0f} ₺ gelir, {current['expense']:,.0f} ₺ gider "
        f"kaydedildi. Net kâr {current['profit']:,.0f} ₺."
    )


# ── Dashboard ──────────────────────────────────────────────────────────
@router.post("/dashboard", response_model=DashboardOut)
async def dashboard(
    snapshot: BusinessSnapshot, current_user: CurrentFirebaseUser
) -> DashboardOut:
    today = _as_of(snapshot)
    series = agg.monthly_series(snapshot.transactions, today)
    rollup = agg.invoice_rollup(snapshot.invoices, today)

    current = series[-1]
    previous = series[-2] if len(series) > 1 else current
    kpis = agg.kpi_block(
        series,
        _kdv_for(current["income"], current["expense"]),
        _kdv_for(previous["income"], previous["expense"]),
    )

    balance = agg.cash_balance(snapshot)
    runway = (balance / current["expense"] * 30) if current["expense"] > 0 else 999.0

    return DashboardOut(
        kpis=kpis,
        monthly=series,
        expense_breakdown=agg.expense_breakdown(snapshot.transactions, today),
        cash_balance=balance,
        receivables=rollup["receivables"],
        payables=rollup["payables"],
        overdue_count=rollup["overdue_count"],
        deadlines=_deadlines(today),
        insight=_insight(series, rollup, runway),
    )


# ── Muhai Score ────────────────────────────────────────────────────────
@router.post("/muhai-score", response_model=MuhaiScoreOut)
async def muhai_score(
    snapshot: BusinessSnapshot, current_user: CurrentFirebaseUser
) -> MuhaiScoreOut:
    result = compute_muhai_score(agg.score_inputs(snapshot, _as_of(snapshot)))
    return MuhaiScoreOut(
        total_score=result.total_score,
        rating=result.rating,
        cash_runway_days=result.cash_runway_days,
        categories=[c.__dict__ for c in result.categories],
        strengths=result.strengths,
        risks=result.risks,
        recommendations=result.recommendations,
    )


# ── Cash-flow forecast ─────────────────────────────────────────────────
@router.post("/forecast", response_model=ForecastOut)
async def forecast(
    snapshot: BusinessSnapshot, current_user: CurrentFirebaseUser, horizon: int = 30
) -> ForecastOut:
    horizon = max(1, min(horizon, 180))
    today = _as_of(snapshot)
    history = agg.daily_net_history(snapshot.transactions, today)
    points = forecast_cashflow(history, horizon=horizon)

    projected_net = round(sum(p.yhat for p in points), 2)
    return ForecastOut(
        points=[p.model_dump() for p in points],
        engine="prophet" if len(history) >= MIN_POINTS_FOR_PROPHET else "moving_average",
        horizon_days=horizon,
        history_points=len(history),
        projected_net=projected_net,
        projected_balance=round(agg.cash_balance(snapshot) + projected_net, 2),
    )


# ── Tax summary ────────────────────────────────────────────────────────
@router.post("/tax-summary", response_model=TaxSummaryOut)
async def tax_summary(
    snapshot: BusinessSnapshot, current_user: CurrentFirebaseUser
) -> TaxSummaryOut:
    today = _as_of(snapshot)
    series = agg.monthly_series(snapshot.transactions, today)
    current = series[-1]

    kdv_collected = calc_kdv(current["income"], VAT_STANDARD, inclusive=True).kdv
    kdv_paid = calc_kdv(current["expense"], VAT_STANDARD, inclusive=True).kdv

    # Corporate tax is annual: assess it on the trailing 12 months so the
    # quarterly advance payment is a real number, not a monthly extrapolation.
    year_revenue = round(sum(m["income"] for m in series), 2)
    year_expense = round(sum(m["expense"] for m in series), 2)
    corporate = calc_corporate_tax(year_revenue, year_expense, CORPORATE_TAX_RATE)

    # Rent withholding, if the company records rent as a categorised expense.
    rent = sum(
        float(t.amount)
        for t in snapshot.transactions
        if t.type == "expense"
        and t.category == "rent"
        and agg.month_key(t.date) == current["month"]
    )
    stopaj = calc_stopaj(rent, "rent").stopaj if rent else 0.0

    kdv_payable = round(max(kdv_collected - kdv_paid, 0.0), 2)
    return TaxSummaryOut(
        period=current["month"],
        kdv_collected=round(kdv_collected, 2),
        kdv_paid=round(kdv_paid, 2),
        kdv_payable=kdv_payable,
        revenue=year_revenue,
        expenses=year_expense,
        profit=corporate.profit,
        corporate_tax=corporate.tax,
        corporate_quarterly=corporate.quarterly_payment,
        stopaj_rent=round(stopaj, 2),
        total_due=round(kdv_payable + stopaj + corporate.quarterly_payment, 2),
        deadlines=_deadlines(today, count=6),
    )


# ── Payroll ────────────────────────────────────────────────────────────
@router.post("/payroll", response_model=PayrollRunOut)
async def payroll(
    snapshot: BusinessSnapshot, current_user: CurrentFirebaseUser
) -> PayrollRunOut:
    today = _as_of(snapshot)
    payslips: list[PayslipOut] = []

    for emp in snapshot.employees:
        slip = calc_detailed_payslip(
            float(emp.gross_salary), start_date=emp.start_date, as_of=today
        )
        payslips.append(
            PayslipOut(
                name=emp.name,
                gross_salary=slip.gross_salary,
                sgk_employee=slip.sgk_employee,
                unemployment_employee=slip.unemployment_employee,
                income_tax=slip.income_tax,
                stamp_tax=slip.stamp_tax,
                total_deductions=slip.total_deductions,
                net_salary=slip.net_salary,
                sgk_employer=slip.sgk_employer,
                unemployment_employer=slip.unemployment_employer,
                total_employer_cost=slip.total_employer_cost,
                tenure_years=slip.tenure_years,
                severance_estimate=slip.severance_estimate,
                annual_leave_days=slip.annual_leave_days,
            )
        )

    return PayrollRunOut(
        payslips=payslips,
        total_gross=round(sum(p.gross_salary for p in payslips), 2),
        total_net=round(sum(p.net_salary for p in payslips), 2),
        total_deductions=round(sum(p.total_deductions for p in payslips), 2),
        total_employer_cost=round(sum(p.total_employer_cost for p in payslips), 2),
        headcount=len(payslips),
    )


# ── Expense classification ─────────────────────────────────────────────
@router.post("/classify", response_model=ClassifyBatchResponse)
async def classify(
    payload: ClassifyBatchRequest, current_user: CurrentFirebaseUser
) -> ClassifyBatchResponse:
    return ClassifyBatchResponse(
        items=[
            ClassifiedItem(
                id=item.id, category=classify_expense(item.description, item.vendor)
            )
            for item in payload.items
        ],
        categories=list(CATEGORIES),
    )


# ── OCR ────────────────────────────────────────────────────────────────
@router.post("/ocr", response_model=OcrExtractResult)
async def ocr(
    current_user: CurrentFirebaseUser, file: UploadFile = File(...)
) -> OcrExtractResult:
    """Server-side Tesseract 5 (tur+eng) with per-field confidence."""
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Boş dosya."
        )
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Dosya 10 MB sınırını aşıyor.",
        )
    try:
        return scan_invoice(content)
    except Exception as exc:  # Tesseract/Pillow failure on a bad image
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Görsel okunamadı: {exc}",
        ) from exc


# ── Assistant ──────────────────────────────────────────────────────────
@router.post("/chat", response_model=ComputeChatResponse)
async def chat(
    payload: ComputeChatRequest, current_user: CurrentFirebaseUser
) -> ComputeChatResponse:
    """Grounded assistant. The Gemini key stays server-side (F3)."""
    ctx = BusinessContext()

    if payload.snapshot is not None:
        snap = payload.snapshot
        today = _as_of(snap)
        series = agg.monthly_series(snap.transactions, today)
        current = series[-1]
        rollup = agg.invoice_rollup(snap.invoices, today)
        deadlines = upcoming_deadlines(today, count=1)
        next_deadline = deadlines[0] if deadlines else None
        score = compute_muhai_score(agg.score_inputs(snap, today))

        ctx = BusinessContext(
            monthly_revenue=current["income"],
            monthly_expenses=current["expense"],
            cash_balance=agg.cash_balance(snap),
            unpaid_invoices=rollup["overdue_count"],
            unpaid_amount=rollup["receivables"],
            next_tax_type=next_deadline.name if next_deadline else None,
            next_tax_amount=_kdv_for(current["income"], current["expense"]),
            next_tax_date=next_deadline.due_date.isoformat() if next_deadline else None,
            low_stock_items=[
                p.name for p in snap.products if p.stock <= p.min_stock
            ],
            muhai_score=score.total_score,
        )

    reply = get_chat_reply(payload.message, ctx)
    return ComputeChatResponse(reply=reply.reply, source=reply.source)
