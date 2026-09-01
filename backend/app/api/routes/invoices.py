from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.db.models.invoice import Invoice
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceListOut,
    InvoiceOut,
    InvoiceUpdate,
    OcrExtractResult,
)
from app.services.ocr_service import scan_invoice

router = APIRouter(prefix="/invoices", tags=["invoices"])


async def _get_owned_invoice(db: DbSession, user_id: str, invoice_id: str) -> Invoice:
    invoice = await db.get(Invoice, invoice_id)
    if invoice is None or invoice.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Fatura bulunamadı."
        )
    return invoice


@router.get("", response_model=InvoiceListOut)
async def list_invoices(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> InvoiceListOut:
    base = select(Invoice).where(Invoice.user_id == current_user.id)
    total = await db.scalar(
        select(func.count()).select_from(base.subquery())
    ) or 0
    rows = await db.scalars(
        base.order_by(Invoice.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return InvoiceListOut(
        items=[InvoiceOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreate, current_user: CurrentUser, db: DbSession
) -> InvoiceOut:
    invoice = Invoice(user_id=current_user.id, **payload.model_dump())
    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)
    return InvoiceOut.model_validate(invoice)


@router.post("/scan", response_model=OcrExtractResult)
async def scan(
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> OcrExtractResult:
    """OCR an uploaded invoice image and return extracted fields.

    Does not persist — the client reviews/edits the fields and then calls
    POST /invoices to save.
    """
    if file.content_type is None or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lütfen bir görsel dosyası yükleyin.",
        )
    image_bytes = await file.read()
    try:
        return scan_invoice(image_bytes)
    except Exception as exc:  # pragma: no cover - depends on system Tesseract
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"OCR işlemi başarısız: {exc}",
        )


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: str, current_user: CurrentUser, db: DbSession
) -> InvoiceOut:
    invoice = await _get_owned_invoice(db, current_user.id, invoice_id)
    return InvoiceOut.model_validate(invoice)


@router.patch("/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: str,
    payload: InvoiceUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> InvoiceOut:
    invoice = await _get_owned_invoice(db, current_user.id, invoice_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(invoice, field, value)
    await db.flush()
    await db.refresh(invoice)
    return InvoiceOut.model_validate(invoice)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: str, current_user: CurrentUser, db: DbSession
) -> None:
    invoice = await _get_owned_invoice(db, current_user.id, invoice_id)
    await db.delete(invoice)
