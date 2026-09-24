"""Schemas for ``/api/agent``.

Field names are camelCase on purpose. Every other document the browser handles
— the workspace collections, the company profile — already arrives that way,
and a surface that alone spoke snake_case would need a translation layer in the
client for no benefit.
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel, Field


class ConversationOut(BaseModel):
    id: str
    title: str
    pinned: bool = False
    messageCount: int = 0
    lastMessageAt: dt.datetime | None = None
    createdAt: dt.datetime | None = None


class ArtifactSummary(BaseModel):
    """Enough to render the card in the message stream without loading the
    report itself — a thread with six reports in it would otherwise carry six
    full block lists on every open."""

    id: str
    title: str
    subtitle: str = ""
    period: str = ""
    blockCount: int = 0
    createdAt: dt.datetime | None = None


class ArtifactOut(ArtifactSummary):
    conversationId: str | None = None
    blocks: list[dict[str, Any]] = Field(default_factory=list)


class ToolCallOut(BaseModel):
    name: str
    args: dict[str, Any] = Field(default_factory=dict)
    summary: str = ""
    ms: int = 0
    ok: bool = True


class MessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    source: str = "ai"
    blocks: list[dict[str, Any]] = Field(default_factory=list)
    toolCalls: list[ToolCallOut] = Field(default_factory=list)
    artifacts: list[ArtifactSummary] = Field(default_factory=list)
    createdAt: dt.datetime | None = None


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = Field(default_factory=list)


class AskRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class AskResponse(BaseModel):
    conversation: ConversationOut
    # Both turns come back so the client can replace its optimistic user bubble
    # with the stored one and keep a single source of ids.
    userMessage: MessageOut
    message: MessageOut


class ConversationPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    pinned: bool | None = None


class ToolInfo(BaseModel):
    name: str
    description: str


class CapabilitiesOut(BaseModel):
    """What the agent can do, for the empty-state panel.

    ``online`` is whether a model key is configured, not whether the last call
    succeeded — the UI uses it to set expectations before the first question,
    and every individual answer carries its own ``source``.
    """

    online: bool
    # "openai", "gemini", or "" when nothing is configured. Diagnostic: which
    # vendor a deployment is actually talking to is otherwise invisible.
    provider: str = ""
    model: str
    readOnly: bool = True
    tools: list[ToolInfo] = Field(default_factory=list)
    pdf: bool = True
