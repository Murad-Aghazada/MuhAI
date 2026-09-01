"""Schemas for expense classification (Module 3)."""
from pydantic import BaseModel, Field


class ClassifyRequest(BaseModel):
    description: str | None = None
    vendor: str | None = None
    amount: float = 0.0


class ClassifyResponse(BaseModel):
    category: str
    source: str  # "cache" | "rules" | "ai"


class CorrectionRequest(BaseModel):
    vendor: str = Field(min_length=1)
    category: str = Field(min_length=1)
