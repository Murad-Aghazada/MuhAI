"""Schemas for the compliance API (Module 8)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ComplianceAlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    severity: str
    description: str
    ref_id: str | None
    detected_at: datetime
    resolved: bool
    resolved_at: datetime | None


class ComplianceAlertsResponse(BaseModel):
    alerts: list[ComplianceAlertOut]
    total: int
    high: int
    medium: int
    low: int
