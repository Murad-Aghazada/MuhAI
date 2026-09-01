from typing import Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    reply: str
    source: Literal["placeholder", "ai"] = "placeholder"


class QuickQuestionsResponse(BaseModel):
    questions: list[str]
