"""The agent surface — conversations, grounded answers and report artifacts.

The fifth router, and the second one that is company-scoped. That is the whole
reason it exists rather than living next to ``/api/compute/chat``: the agent
reads the company's tables directly, and compute is deliberately stateless. A
tool loop routed through the browser instead — server asks, client fetches,
client posts back — would have cost three round trips per answer and put the
loop's control flow in a bundle anyone can read.

    GET    /api/agent/capabilities
    GET    /api/agent/conversations
    POST   /api/agent/conversations
    GET    /api/agent/conversations/{id}
    PATCH  /api/agent/conversations/{id}
    DELETE /api/agent/conversations/{id}
    POST   /api/agent/conversations/{id}/ask
    GET    /api/agent/artifacts/{id}
    GET    /api/agent/artifacts/{id}/pdf

Every query here filters on ``company.id`` from the resolved token, exactly as
the workspace does. Reads of the business data go through ``agent_tools``,
which has no write path at all — see its module docstring.

The model call is blocking I/O inside an async handler, so it runs in a worker
thread. Without that, one agent question stalls every other request on the
event loop for as long as Gemini takes, which on a tool-using turn is seconds.
"""
from __future__ import annotations

import asyncio
import datetime as dt
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentCompany, CurrentUser, DbSession
from app.db.models.agent import AgentArtifact, AgentConversation, AgentMessage
from app.schemas.agent import (
    ArtifactOut,
    ArtifactSummary,
    AskRequest,
    AskResponse,
    CapabilitiesOut,
    ConversationDetail,
    ConversationOut,
    ConversationPatch,
    MessageOut,
    ToolInfo,
)
from app.services import agent_service, agent_tools, llm, report_pdf
from app.services.agent_context import load_workspace

router = APIRouter(prefix="/agent", tags=["agent"])

MAX_CONVERSATIONS = 200


# ── Serialisation ─────────────────────────────────────────────────────


def _conversation_out(row: AgentConversation) -> ConversationOut:
    return ConversationOut(
        id=row.id,
        title=row.title,
        pinned=row.pinned,
        messageCount=row.message_count,
        lastMessageAt=row.last_message_at,
        createdAt=row.created_at,
    )


def _artifact_summary(row: AgentArtifact) -> ArtifactSummary:
    return ArtifactSummary(
        id=row.id,
        title=row.title,
        subtitle=row.subtitle,
        period=row.period,
        blockCount=len(row.blocks or []),
        createdAt=row.created_at,
    )


def _message_out(
    row: AgentMessage, artifacts: dict[str, AgentArtifact]
) -> MessageOut:
    return MessageOut(
        id=row.id,
        role="assistant" if row.role == "assistant" else "user",
        content=row.content,
        source=row.source,
        blocks=row.blocks or [],
        toolCalls=row.tool_calls or [],
        artifacts=[
            _artifact_summary(artifacts[aid])
            for aid in (row.artifact_ids or [])
            if aid in artifacts
        ],
        createdAt=row.created_at,
    )


# ── Lookups ───────────────────────────────────────────────────────────


async def _conversation(
    db: DbSession, company_id: str, conversation_id: str
) -> AgentConversation:
    row = await db.scalar(
        select(AgentConversation).where(
            AgentConversation.id == conversation_id,
            AgentConversation.company_id == company_id,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sohbet bulunamadı."
        )
    return row


async def _artifact(db: DbSession, company_id: str, artifact_id: str) -> AgentArtifact:
    row = await db.scalar(
        select(AgentArtifact).where(
            AgentArtifact.id == artifact_id, AgentArtifact.company_id == company_id
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rapor bulunamadı."
        )
    return row


# ── Capabilities ──────────────────────────────────────────────────────


@router.get("/capabilities", response_model=CapabilitiesOut)
async def capabilities(user: CurrentUser) -> CapabilitiesOut:
    """What this deployment's agent can do — read before the first question."""
    return CapabilitiesOut(
        online=llm.is_online(),
        provider=llm.active_provider(),
        model=llm.active_model(),
        readOnly=True,
        # Measured, not assumed: WeasyPrint's system libraries can be absent on
        # a host, and offering a download button that 503s is worse than saying
        # so before it is pressed.
        pdf=report_pdf.is_available(),
        tools=[
            ToolInfo(name=tool.name, description=tool.description)
            for tool in agent_tools.READ_TOOLS
        ],
    )


# ── Conversations ─────────────────────────────────────────────────────


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    db: DbSession, company: CurrentCompany
) -> list[ConversationOut]:
    """Pinned first, then by last use. Not by creation date: a chat list is
    ordered by when you last touched a thread, which is what makes yesterday's
    long conversation still findable at the top this morning."""
    rows = await db.scalars(
        select(AgentConversation)
        .where(AgentConversation.company_id == company.id)
        .order_by(
            AgentConversation.pinned.desc(),
            AgentConversation.last_message_at.desc().nullslast(),
            AgentConversation.created_at.desc(),
        )
        .limit(MAX_CONVERSATIONS)
    )
    return [_conversation_out(row) for row in rows]


@router.post(
    "/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED
)
async def create_conversation(
    db: DbSession,
    company: CurrentCompany,
    user: CurrentUser,
    body: dict[str, Any] = Body(default_factory=dict),
) -> ConversationOut:
    row = AgentConversation(
        company_id=company.id,
        user_id=user.id,
        title=str(body.get("title") or "Yeni sohbet")[:200],
    )
    db.add(row)
    await db.flush()
    return _conversation_out(row)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def read_conversation(
    db: DbSession, company: CurrentCompany, conversation_id: str = Path(...)
) -> ConversationDetail:
    row = await db.scalar(
        select(AgentConversation)
        .where(
            AgentConversation.id == conversation_id,
            AgentConversation.company_id == company.id,
        )
        .options(selectinload(AgentConversation.messages))
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sohbet bulunamadı."
        )

    artifacts = {
        a.id: a
        for a in await db.scalars(
            select(AgentArtifact).where(
                AgentArtifact.conversation_id == row.id,
                AgentArtifact.company_id == company.id,
            )
        )
    }

    return ConversationDetail(
        **_conversation_out(row).model_dump(),
        messages=[_message_out(m, artifacts) for m in row.messages],
    )


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    db: DbSession,
    company: CurrentCompany,
    conversation_id: str = Path(...),
    patch: ConversationPatch = Body(...),
) -> ConversationOut:
    row = await _conversation(db, company.id, conversation_id)
    if patch.title is not None:
        row.title = patch.title.strip() or row.title
    if patch.pinned is not None:
        row.pinned = patch.pinned
    db.add(row)
    await db.flush()
    return _conversation_out(row)


@router.delete(
    "/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_conversation(
    db: DbSession, company: CurrentCompany, conversation_id: str = Path(...)
) -> Response:
    row = await _conversation(db, company.id, conversation_id)
    await db.delete(row)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Asking ────────────────────────────────────────────────────────────


@router.post("/conversations/{conversation_id}/ask", response_model=AskResponse)
async def ask(
    db: DbSession,
    company: CurrentCompany,
    conversation_id: str = Path(...),
    body: AskRequest = Body(...),
) -> AskResponse:
    """One turn: store the question, answer it, store the answer.

    The whole workspace is loaded once and every tool in the turn reads that
    one copy, so two tools in the same answer cannot disagree about the data —
    and the company's dataset is a few hundred rows, which is cheaper to fetch
    once than to query per tool.
    """
    conversation = await _conversation(db, company.id, conversation_id)
    question = body.message.strip()

    history = [
        {"role": m.role, "content": m.content}
        for m in await db.scalars(
            select(AgentMessage)
            .where(AgentMessage.conversation_id == conversation.id)
            .order_by(AgentMessage.created_at)
        )
    ]

    user_message = AgentMessage(
        company_id=company.id,
        conversation_id=conversation.id,
        role="user",
        content=question,
    )
    db.add(user_message)
    await db.flush()

    workspace = await load_workspace(db, company)

    # Blocking: urllib plus, on a tool-using turn, Prophet. Off the event loop
    # or every other request waits behind this one.
    turn = await asyncio.to_thread(
        agent_service.run_turn, question, history, workspace
    )

    assistant_message = AgentMessage(
        company_id=company.id,
        conversation_id=conversation.id,
        role="assistant",
        content=turn.reply,
        source=turn.source,
        blocks=turn.blocks,
        tool_calls=turn.tool_calls,
        artifact_ids=[],
    )
    db.add(assistant_message)
    await db.flush()

    stored_artifacts: dict[str, AgentArtifact] = {}
    for report in turn.reports:
        artifact = AgentArtifact(
            company_id=company.id,
            conversation_id=conversation.id,
            message_id=assistant_message.id,
            kind="report",
            title=report["title"],
            subtitle=report["subtitle"],
            period=report["period"],
            blocks=report["blocks"],
        )
        db.add(artifact)
        await db.flush()
        stored_artifacts[artifact.id] = artifact

    if stored_artifacts:
        assistant_message.artifact_ids = list(stored_artifacts)
        db.add(assistant_message)

    # An untouched thread takes its name from the first thing asked of it.
    if conversation.message_count == 0 and conversation.title in {"", "Yeni sohbet"}:
        conversation.title = agent_service.title_for(question)
    conversation.message_count += 2
    conversation.last_message_at = dt.datetime.now(dt.timezone.utc)
    db.add(conversation)
    await db.flush()

    return AskResponse(
        conversation=_conversation_out(conversation),
        userMessage=_message_out(user_message, {}),
        message=_message_out(assistant_message, stored_artifacts),
    )


# ── Artifacts ─────────────────────────────────────────────────────────


@router.get("/artifacts", response_model=list[ArtifactSummary])
async def list_artifacts(
    db: DbSession, company: CurrentCompany
) -> list[ArtifactSummary]:
    """Every report this company's agent has written, newest first."""
    rows = await db.scalars(
        select(AgentArtifact)
        .where(AgentArtifact.company_id == company.id)
        .order_by(AgentArtifact.created_at.desc())
        .limit(100)
    )
    return [_artifact_summary(row) for row in rows]


@router.get("/artifacts/{artifact_id}", response_model=ArtifactOut)
async def read_artifact(
    db: DbSession, company: CurrentCompany, artifact_id: str = Path(...)
) -> ArtifactOut:
    row = await _artifact(db, company.id, artifact_id)
    return ArtifactOut(
        **_artifact_summary(row).model_dump(),
        conversationId=row.conversation_id,
        blocks=row.blocks or [],
    )


def _filename(title: str) -> str:
    """ASCII, so the ``filename=`` parameter needs no RFC 5987 encoding.

    Turkish titles are the common case here and a raw "Ş" in a Content-
    Disposition header is decoded differently by every browser. The readable
    name is inside the PDF; this one only has to be a safe file name.
    """
    folded = (
        title.replace("ı", "i").replace("İ", "I").replace("ş", "s").replace("Ş", "S")
        .replace("ğ", "g").replace("Ğ", "G").replace("ü", "u").replace("Ü", "U")
        .replace("ö", "o").replace("Ö", "O").replace("ç", "c").replace("Ç", "C")
    )
    safe = "".join(c if c.isalnum() or c in "-_ " else "" for c in folded).strip()
    return (safe.replace(" ", "-")[:60] or "muhai-rapor") + ".pdf"


@router.get("/artifacts/{artifact_id}/pdf")
async def artifact_pdf(
    db: DbSession, company: CurrentCompany, artifact_id: str = Path(...)
) -> Response:
    """The report as a PDF, rendered from the same blocks the pane shows."""
    row = await _artifact(db, company.id, artifact_id)
    artifact = {
        "title": row.title,
        "subtitle": row.subtitle,
        "period": row.period,
        "blocks": row.blocks or [],
    }
    company_doc = {"name": company.name, "taxId": company.tax_id}

    try:
        pdf = await asyncio.to_thread(report_pdf.render_pdf, artifact, company_doc)
    except report_pdf.PdfUnavailable as exc:
        # 503, not 500: the report itself is fine and still readable on screen.
        # This is the deployment missing WeasyPrint's system libraries.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"PDF üretimi bu sunucuda kullanılamıyor: {exc}",
        ) from exc

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_filename(row.title)}"'
        },
    )
