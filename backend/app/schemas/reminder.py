"""Schemas for the reminders API (Module 10)."""
from datetime import date

from pydantic import BaseModel, ConfigDict


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    name: str
    period: str
    due_date: date
    estimated_amount: float
    paid_amount: float
    status: str
    paid_date: date | None


class RemindersResponse(BaseModel):
    reminders: list[ReminderOut]
    due_soon_count: int
