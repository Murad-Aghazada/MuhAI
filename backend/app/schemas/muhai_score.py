"""Response models for the Muhai Score API (Module 12)."""
from datetime import date

from pydantic import BaseModel


class CategoryScoreOut(BaseModel):
    key: str
    label: str
    weight: float
    score: float  # 0..1
    points: float  # contribution to the 0..100 total


class MuhaiScoreOut(BaseModel):
    total_score: int
    rating: str  # "red" | "yellow" | "green"
    cash_runway_days: float
    categories: list[CategoryScoreOut]
    strengths: list[str]
    risks: list[str]
    recommendations: list[str]


class MuhaiScoreHistoryPoint(BaseModel):
    date: date
    total_score: int


class MuhaiScoreHistoryOut(BaseModel):
    points: list[MuhaiScoreHistoryPoint]
    change: int  # total_score delta vs the earliest point in range
