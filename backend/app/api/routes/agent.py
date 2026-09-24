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
    POST   /api/agent/attachments
    GET    /api/agent/attachments/{id}/file
    DELETE /api/agent/attachments/{id}
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
import logging
import re
import urllib.parse
import uuid
from typing import Any

from fastapi import (
    APIRouter,
    Body,
    File,
    HTTPException,
    Path,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import delete, select
from sqlalchemy.orm import defer, selectinload

from app.api.deps import CurrentCompany, CurrentUser, DbSession
from app.db.models.agent import (
    AgentArtifact,
    AgentAttachment,
    AgentConversation,
    AgentMessage,
)
from app.schemas.agent import (
    ArtifactOut,
    AttachmentOut,
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
from app.services import agent_service, agent_tools, document_reader, llm, report_pdf
from app.services.agent_context import load_workspace

router = APIRouter(prefix="/agent", tags=["agent"])

MAX_CONVERSATIONS = 200

logger = logging.getLogger(__name__)

# Attachments. Same ceiling as the OCR upload on /api/compute.
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
# What is kept of a file's text. A 20-page PDF is well under this; the prompt
# takes a slice of it (agent_service.ATTACHMENT_CHARS), the rest is for the
# preview and for anything that reads the row later.
MAX_STORED_TEXT = 200_000
PREVIEW_CHARS = 280
# An upload that never made it into a sent message is swept after this long,
# on the company's next upload. A day covers someone who attaches a file,
# goes to find the right question and comes back.
ORPHAN_TTL = dt.timedelta(days=1)


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


def _attachment_out(row: AgentAttachment) -> AttachmentOut:
    return AttachmentOut(
        id=row.id,
        filename=row.filename,
        contentType=row.content_type,
        size=row.size,
        kind="pdf" if row.kind == "pdf" else "image",
        method=row.method if row.method in ("text", "ocr", "mixed", "none") else "none",
        pages=row.pages,
        pagesRead=row.pages_read,
        confidence=row.confidence,
        fields=row.fields or {},
        notes=row.notes or [],
        preview=(row.text or "")[:PREVIEW_CHARS],
        createdAt=row.created_at,
    )


def _attachment_doc(row: AgentAttachment) -> dict:
    """What agent_service reads. The file itself is added by ``_attach_files``
    for the ones that fit the request — see ``ask``."""
    return {
        "id": row.id,
        "filename": row.filename,
        "kind": row.kind,
        "method": row.method,
        "pages": row.pages,
        "pagesRead": row.pages_read,
        "confidence": row.confidence,
        "fields": row.fields or {},
        "notes": row.notes or [],
        "text": row.text or "",
        "contentType": row.content_type,
    }


def _message_out(
    row: AgentMessage,
    artifacts: dict[str, AgentArtifact],
    attachments: dict[str, AgentAttachment] | None = None,
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
        attachments=[
            _attachment_out(attachments[aid])
            for aid in (row.attachment_ids or [])
            if attachments and aid in attachments
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


def _valid_ids(ids: list[str]) -> list[str]:
    """Distinct, well-formed ids, in the order given.

    A malformed id would reach Postgres as a UUID cast and come back a 500;
    it is simply not an attachment this company has.
    """
    out: list[str] = []
    for value in ids:
        try:
            canonical = str(uuid.UUID(str(value)))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Ek bulunamadı."
            ) from None
        if canonical not in out:
            out.append(canonical)
    return out


async def _attachments_by_id(
    db: DbSession, company_id: str, ids: list[str], *, with_data: bool = False
) -> dict[str, AgentAttachment]:
    """This company's attachments — without the file bytes unless asked."""
    if not ids:
        return {}
    query = select(AgentAttachment).where(
        AgentAttachment.id.in_(ids), AgentAttachment.company_id == company_id
    )
    if not with_data:
        query = query.options(defer(AgentAttachment.data))
    return {row.id: row for row in await db.scalars(query)}


async def _attachment_bytes(
    db: DbSession, company_id: str, ids: list[str]
) -> dict[str, bytes]:
    if not ids:
        return {}
    rows = await db.execute(
        select(AgentAttachment.id, AgentAttachment.data).where(
            AgentAttachment.id.in_(ids), AgentAttachment.company_id == company_id
        )
    )
    return {row.id: row.data for row in rows}


async def _attachment(
    db: DbSession, company_id: str, attachment_id: str
) -> AgentAttachment:
    [canonical] = _valid_ids([attachment_id])
    row = await db.scalar(
        select(AgentAttachment).where(
            AgentAttachment.id == canonical, AgentAttachment.company_id == company_id
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ek bulunamadı."
        )
    return row


def _attach_files(docs: list[dict], data: dict[str, bytes]) -> None:
    """Give each doc whose bytes are in ``data`` the file itself, ready for
    the model. Runs in a worker thread: resizing a 12 MP photo is CPU."""
    for doc in docs:
        content = data.get(doc["id"])
        if content is None:
            continue
        mime, payload = document_reader.for_model(content, doc["contentType"])
        doc["file"] = llm.FilePart(name=doc["filename"], mime=mime, data=payload)


def _safe_filename(name: str | None) -> str:
    """The last path segment, trimmed. Browsers on Windows have sent the
    whole C:\\ path in the past."""
    base = re.split(r"[\\/]", (name or "").strip())[-1].strip()
    return (base or "belge")[:255]


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

    attachments = {
        a.id: a
        for a in await db.scalars(
            select(AgentAttachment)
            .where(
                AgentAttachment.conversation_id == row.id,
                AgentAttachment.company_id == company.id,
            )
            .options(defer(AgentAttachment.data))
        )
    }

    return ConversationDetail(
        **_conversation_out(row).model_dump(),
        messages=[_message_out(m, artifacts, attachments) for m in row.messages],
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

    # Files for this turn: this company's, and not already sent with an
    # earlier message — an id is a one-way ticket into one question.
    wanted = _valid_ids(body.attachmentIds)
    found = await _attachments_by_id(db, company.id, wanted, with_data=True)
    if len(found) != len(wanted):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ek bulunamadı."
        )
    attachments = [found[aid] for aid in wanted]
    if any(a.message_id is not None for a in attachments):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Bu ek zaten gönderildi."
        )
    if not question and not attachments:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Boş mesaj gönderilemez.",
        )

    earlier = list(
        await db.scalars(
            select(AgentMessage)
            .where(AgentMessage.conversation_id == conversation.id)
            .order_by(AgentMessage.created_at)
        )
    )
    # The files go to the model as files, within one request budget: this
    # question's first, then earlier questions' newest first, so a follow-up
    # ("and the VAT on that one?") still has the document in front of it.
    # Whatever does not fit goes as its extracted text.
    budget = agent_service.MODEL_FILES_BYTES
    carried: dict[str, bytes] = {}
    for attachment in attachments:
        if attachment.size <= budget:
            budget -= attachment.size
            carried[attachment.id] = attachment.data

    window = earlier[-agent_service.MAX_HISTORY_TURNS * 2 :]
    replay = await _attachments_by_id(
        db, company.id, [aid for m in window for aid in (m.attachment_ids or [])]
    )
    replay_ids = []
    for m in reversed(window):
        for aid in m.attachment_ids or []:
            row = replay.get(aid)
            if row is not None and row.size <= budget:
                budget -= row.size
                replay_ids.append(aid)
    carried.update(await _attachment_bytes(db, company.id, replay_ids))

    current_docs = [_attachment_doc(a) for a in attachments]
    history = []
    for m in window:
        entry = {"role": m.role, "content": m.content}
        sent = [replay[aid] for aid in (m.attachment_ids or []) if aid in replay]
        if m.role == "user" and sent:
            entry["attachments"] = [_attachment_doc(a) for a in sent]
        history.append(entry)
    await asyncio.to_thread(
        _attach_files,
        current_docs + [d for e in history for d in e.get("attachments", [])],
        carried,
    )

    user_message = AgentMessage(
        company_id=company.id,
        conversation_id=conversation.id,
        role="user",
        content=question,
        attachment_ids=[a.id for a in attachments],
    )
    db.add(user_message)
    await db.flush()

    for attachment in attachments:
        attachment.conversation_id = conversation.id
        attachment.message_id = user_message.id
        db.add(attachment)

    workspace = await load_workspace(db, company)

    # Blocking: urllib plus, on a tool-using turn, Prophet. Off the event loop
    # or every other request waits behind this one.
    turn = await asyncio.to_thread(
        agent_service.run_turn, question, history, workspace, current_docs
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
        conversation.title = agent_service.title_for(
            question or (attachments[0].filename if attachments else "")
        )
    conversation.message_count += 2
    conversation.last_message_at = dt.datetime.now(dt.timezone.utc)
    db.add(conversation)
    await db.flush()

    return AskResponse(
        conversation=_conversation_out(conversation),
        userMessage=_message_out(user_message, {}, {a.id: a for a in attachments}),
        message=_message_out(assistant_message, stored_artifacts),
    )


# ── Attachments ───────────────────────────────────────────────────────


@router.post(
    "/attachments", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED
)
async def upload_attachment(
    db: DbSession, company: CurrentCompany, file: UploadFile = File(...)
) -> AttachmentOut:
    """Store a photo or PDF for the next question.

    The file itself is what the model reads when the question is asked. Its
    text and invoice fields are extracted here too, while the user is still
    typing, as the backup for an offline answer or a model that refuses
    files.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Boş dosya.")
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Dosya 10 MB sınırını aşıyor.",
        )

    # The model reads the file itself; the text extracted here is the backup
    # (an offline answer, a model that refuses files). So a failed extraction
    # stores the file anyway, and only a file nobody could open is refused.
    try:
        read = await asyncio.to_thread(
            document_reader.read_document, content, strict=False
        )
    except document_reader.DocumentError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    # Sweep this company's uploads that were never sent.
    await db.execute(
        delete(AgentAttachment).where(
            AgentAttachment.company_id == company.id,
            AgentAttachment.message_id.is_(None),
            AgentAttachment.created_at < dt.datetime.now(dt.timezone.utc) - ORPHAN_TTL,
        )
    )

    row = AgentAttachment(
        company_id=company.id,
        filename=_safe_filename(file.filename),
        content_type=read.content_type,
        size=len(content),
        kind=read.kind,
        method=read.method,
        pages=read.pages,
        pages_read=read.pages_read,
        confidence=read.confidence,
        text=read.text[:MAX_STORED_TEXT],
        fields=read.fields(),
        notes=read.notes,
        data=content,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row, attribute_names=["created_at"])
    return _attachment_out(row)


@router.get("/attachments/{attachment_id}/file")
async def attachment_file(
    db: DbSession, company: CurrentCompany, attachment_id: str = Path(...)
) -> Response:
    """The file itself, for the preview. Fetched with the auth header and
    turned into a blob by the page, like the report PDF — never a URL with
    the token in it."""
    row = await _attachment(db, company.id, attachment_id)
    return Response(
        content=row.data,
        # Sniffed from the bytes on upload, never taken from the client.
        media_type=row.content_type,
        headers={
            "Content-Disposition": (
                f"inline; filename*=UTF-8''{urllib.parse.quote(row.filename)}"
            ),
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete(
    "/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_attachment(
    db: DbSession, company: CurrentCompany, attachment_id: str = Path(...)
) -> Response:
    """Take a file back out of the composer before sending. Once it has gone
    with a message it is part of the thread and leaves with the thread."""
    row = await _attachment(db, company.id, attachment_id)
    if row.message_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Gönderilmiş bir mesajın eki silinemez.",
        )
    await db.delete(row)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
