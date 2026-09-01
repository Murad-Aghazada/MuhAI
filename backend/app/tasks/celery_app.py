"""Celery application and background tasks.

These tasks offload heavy/slow AI work (OCR, Prophet training, bulk payroll)
from the request cycle. They wrap the same service-layer functions used by the
synchronous endpoints, so behaviour stays consistent.
"""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "muhai",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    timezone="Europe/Istanbul",
)


@celery_app.task(name="ocr.process_invoice")
def process_invoice_task(image_bytes_hex: str) -> dict:
    """Run OCR on an invoice image (bytes passed as hex) in the background."""
    from app.services.ocr_service import scan_invoice

    image_bytes = bytes.fromhex(image_bytes_hex)
    result = scan_invoice(image_bytes)
    return result.model_dump(mode="json")


@celery_app.task(name="forecast.train")
def train_forecast_task(history: list[tuple[str, float]]) -> list[dict]:
    """Train Prophet and return a 30-day forecast for the given daily history."""
    from datetime import date

    from app.services.forecast_service import forecast_cashflow

    parsed = [(date.fromisoformat(d), float(v)) for d, v in history]
    points = forecast_cashflow(parsed)
    return [p.model_dump(mode="json") for p in points]


@celery_app.task(name="payroll.run_bulk")
def run_bulk_payroll_task(employees: list[dict]) -> list[dict]:
    """Bulk payslip calculation. Each item: {id, name, base_salary, sgk_rate}."""
    from app.services.tax_service import calc_payslip

    results = []
    for emp in employees:
        slip = calc_payslip(float(emp["base_salary"]), float(emp.get("sgk_rate", 0.14)))
        results.append(
            {
                "employee_id": emp["id"],
                "name": emp["name"],
                "gross_salary": slip.gross_salary,
                "sgk_deduction": slip.sgk_deduction,
                "income_tax": slip.income_tax,
                "net_salary": slip.net_salary,
            }
        )
    return results
