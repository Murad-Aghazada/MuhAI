"""The agent's memory — conversations, messages and the reports it produces.

Three tables, all hanging off ``company_id`` exactly like the workspace does,
so the authorisation rule is unchanged: the signed-in token resolves to one
company and every query here is filtered by it.

Why this is stored at all, when ``/api/compute/chat`` was stateless: a one-shot
question box has no memory, so "and the month before?" cannot be asked. A
thread is the unit people work in, and the agent's answers regularly cost
several tool calls and a Gemini round trip — throwing them away on a page
reload means paying for them again.

``AgentMessage.blocks`` is the structured half of an answer: the charts,
tables and KPI rows the model asked for by calling a render tool. Prose lives
in ``content`` and the blocks beside it, never encoded into the prose, so the
same answer renders in React and in the PDF without either parsing the other's
markup.

``AgentArtifact`` is a report the agent wrote: a titled sequence of the same
blocks, addressable on its own so the split view can open one without the
conversation it came from, and so ``/api/agent/artifacts/{id}/pdf`` has
something to render.
"""
import datetime as dt
from typing import Any, List

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, uuid_pk


def _json_list() -> Mapped[list[Any]]:
    return mapped_column(JSONB, default=list, nullable=False)


class AgentConversation(Base, TimestampMixin):
    """One thread. Titled from its first question until someone renames it."""

    __tablename__ = "agent_conversations"

    id: Mapped[str] = uuid_pk()
    company_id: Mapped[str] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Who started it. Kept for attribution only — the company is the scope, so
    # a colleague on the same account sees the same threads.
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)

    title: Mapped[str] = mapped_column(default="Yeni sohbet", nullable=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Bumped on every message so the rail can sort by "last used" rather than
    # by creation, which is what a chat list is actually ordered by.
    last_message_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    extra: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    messages: Mapped[List["AgentMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AgentMessage.created_at",
    )
    artifacts: Mapped[List["AgentArtifact"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class AgentMessage(Base, TimestampMixin):
    """One turn. ``role`` is "user" or "assistant" — there is no system turn
    in here, because the system prompt is built per request from live data and
    storing a stale copy of it would be a lie about what the model was told."""

    __tablename__ = "agent_messages"

    id: Mapped[str] = uuid_pk()
    company_id: Mapped[str] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("agent_conversations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    role: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # "ai" when Gemini answered, "offline" when the local BM25 path did. The UI
    # badges the second, because an offline answer is real but not reasoned.
    source: Mapped[str] = mapped_column(String(16), default="ai", nullable=False)

    # Charts / tables / KPI rows the model asked to render, in order.
    blocks: Mapped[list[Any]] = _json_list()
    # What the agent read to answer: [{name, args, summary, ms}]. Shown as a
    # collapsed trace — an answer about money has to be able to show its work.
    tool_calls: Mapped[list[Any]] = _json_list()
    # Ids of any report written during this turn.
    artifact_ids: Mapped[list[Any]] = _json_list()

    conversation: Mapped["AgentConversation"] = relationship(back_populates="messages")


class AgentArtifact(Base, TimestampMixin):
    """A report: title, subtitle and an ordered list of blocks.

    Immutable once written. Regenerating gives a new artifact rather than
    editing this one, so a PDF someone downloaded still matches the thing they
    can open on screen.
    """

    __tablename__ = "agent_artifacts"

    id: Mapped[str] = uuid_pk()
    company_id: Mapped[str] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("agent_conversations.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    message_id: Mapped[str | None] = mapped_column(String, nullable=True)

    kind: Mapped[str] = mapped_column(String(32), default="report", nullable=False)
    title: Mapped[str] = mapped_column(default="Rapor", nullable=False)
    subtitle: Mapped[str] = mapped_column(default="", nullable=False)
    period: Mapped[str] = mapped_column(default="", nullable=False)
    blocks: Mapped[list[Any]] = _json_list()
    extra: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    conversation: Mapped["AgentConversation"] = relationship(back_populates="artifacts")
