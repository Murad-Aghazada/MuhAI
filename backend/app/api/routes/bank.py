"""Bank transaction endpoints (Module 6).

GET  /api/bank-transactions            — list imported transactions
POST /api/bank-transactions/import     — upload a CSV/XLSX statement
POST /api/bank-transactions/reconcile  — match transactions to invoices
"""
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.db.models.bank_transaction import BankTransaction
from app.db.models.invoice import Invoice
from app.schemas.bank import BankTransactionOut, ImportResult, ReconcileResult
from app.services.bank_service import (
    InvoiceRef,
    parse_bank_csv,
    reconcile,
    reconciliation_summary,
)

router = APIRouter(prefix="/bank-transactions", tags=["bank"])


@router.get("", response_model=list[BankTransactionOut])
async def list_bank_transactions(
    current_user: CurrentUser, db: DbSession
) -> list[BankTransactionOut]:
    rows = await db.scalars(
        select(BankTransaction)
        .where(BankTransaction.user_id == current_user.id)
        .order_by(BankTransaction.date.desc().nullslast())
    )
    return [BankTransactionOut.model_validate(r) for r in rows]


@router.post("/import", response_model=ImportResult)
async def import_statement(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> ImportResult:
    raw = await file.read()
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            content = raw.decode("iso-8859-9")  # Turkish (Latin-5)
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dosya kodlaması okunamadı.",
            )

    rows = parse_bank_csv(content)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Dosyada geçerli işlem bulunamadı. Sütun başlıklarını kontrol edin.",
        )

    by_category: dict[str, int] = {}
    for r in rows:
        db.add(
            BankTransaction(
                user_id=current_user.id,
                date=r.date,
                description=r.description,
                amount=r.amount,
                category=r.category,
                status="unmatched",
            )
        )
        by_category[r.category] = by_category.get(r.category, 0) + 1
    await db.flush()
    return ImportResult(imported=len(rows), skipped=0, by_category=by_category)


@router.post("/reconcile", response_model=ReconcileResult)
async def reconcile_transactions(
    current_user: CurrentUser, db: DbSession
) -> ReconcileResult:
    bank_rows = list(
        await db.scalars(
            select(BankTransaction)
            .where(BankTransaction.user_id == current_user.id)
            .where(BankTransaction.status != "matched")
        )
    )
    invoices = list(
        await db.scalars(select(Invoice).where(Invoice.user_id == current_user.id))
    )

    from app.services.bank_service import BankRow

    rows_for_match = [
        BankRow(
            date=b.date,
            description=b.description or "",
            amount=float(b.amount),
            category=b.category or "other",
        )
        for b in bank_rows
    ]
    invoice_refs = [
        InvoiceRef(
            id=inv.id,
            vendor_name=inv.vendor_name,
            amount=float(inv.amount or 0),
            date=inv.date,
        )
        for inv in invoices
    ]

    results = reconcile(rows_for_match, invoice_refs)
    for res in results:
        bank_tx = bank_rows[res.bank_index]
        if res.status == "matched":
            bank_tx.status = "matched"
            bank_tx.matched_invoice_id = res.invoice_id
    await db.flush()

    summary = reconciliation_summary(results)
    return ReconcileResult(
        total=int(summary["total"]),
        matched=int(summary["matched"]),
        unmatched=int(summary["unmatched"]),
        match_rate=summary["match_rate"],
    )
