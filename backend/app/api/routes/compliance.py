"""Compliance endpoints (Module 8).

GET  /api/compliance/alerts            → run checks, upsert new, return unresolved
POST /api/compliance/alerts/{id}/resolve → mark an alert resolved
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.compliance_alert import ComplianceAlert
from app.db.models.invoice import Invoice
from app.schemas.compliance import ComplianceAlertOut, ComplianceAlertsResponse
from app.services.compliance_service import InvoiceRecord, run_all_checks

router = APIRouter(prefix="/compliance", tags=["compliance"])


async def _detect_and_store(db: DbSession, user_id: str) -> list[ComplianceAlert]:
    """Run the rule engine and persist newly-detected alerts (deduped)."""
    invoices = list(
        await db.scalars(select(Invoice).where(Invoice.user_id == user_id))
    )
    records = [
        InvoiceRecord(
            id=inv.id,
            invoice_number=inv.invoice_number,
            vendor_name=inv.vendor_name,
            amount=float(inv.amount or 0),
            vat_amount=float(inv.vat_amount or 0),
            date=inv.date,
        )
        for inv in invoices
    ]
    detected = run_all_checks(records)

    existing = list(
        await db.scalars(
            select(ComplianceAlert)
            .where(ComplianceAlert.user_id == user_id)
            .where(ComplianceAlert.resolved.is_(False))
        )
    )
    existing_keys = {(a.type, a.description, a.ref_id) for a in existing}

    for alert in detected:
        if alert.key in existing_keys:
            continue
        db.add(
            ComplianceAlert(
                user_id=user_id,
                type=alert.type,
                severity=alert.severity,
                description=alert.description,
                ref_id=alert.ref_id,
            )
        )
        existing_keys.add(alert.key)
    await db.flush()

    rows = list(
        await db.scalars(
            select(ComplianceAlert)
            .where(ComplianceAlert.user_id == user_id)
            .where(ComplianceAlert.resolved.is_(False))
            .order_by(ComplianceAlert.detected_at.desc())
        )
    )
    return rows


@router.get("/alerts", response_model=ComplianceAlertsResponse)
async def get_alerts(
    current_user: CurrentUser, db: DbSession
) -> ComplianceAlertsResponse:
    rows = await _detect_and_store(db, current_user.id)
    counts = {"high": 0, "medium": 0, "low": 0}
    for r in rows:
        counts[r.severity] = counts.get(r.severity, 0) + 1
    return ComplianceAlertsResponse(
        alerts=[ComplianceAlertOut.model_validate(r) for r in rows],
        total=len(rows),
        high=counts["high"],
        medium=counts["medium"],
        low=counts["low"],
    )


@router.post("/alerts/{alert_id}/resolve", response_model=ComplianceAlertOut)
async def resolve_alert(
    alert_id: str, current_user: CurrentUser, db: DbSession
) -> ComplianceAlertOut:
    alert = await db.get(ComplianceAlert, alert_id)
    if alert is None or alert.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Uyarı bulunamadı."
        )
    alert.resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(alert)
    return ComplianceAlertOut.model_validate(alert)
