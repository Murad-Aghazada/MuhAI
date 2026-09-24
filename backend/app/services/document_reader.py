"""Attached documents: a photo, a scan, or a PDF.

Two jobs. ``for_model`` prepares the file itself for the language model,
which reads photos and PDFs directly — that is how the agent sees an
attachment. ``read_document`` extracts the text and the invoice fields, which
the Invoices screen uses to pre-fill a form and the agent keeps as a backup:
for an offline answer, and for a model that refuses files.

Three sources of text, most exact first:

1. **A PDF's own text layer.** e-Fatura and e-Arşiv PDFs are generated, not
   scanned, so every letter — ş, ğ, ı and İ included — is already in the file.
   Reading it is exact: no recognition happens, so none of OCR's errors can.
   Most invoices a Turkish SME receives today arrive this way.
2. **OCR of a PDF page with no text layer** — a paper invoice that someone
   scanned to PDF. Rendered at 300 dpi and handed to the same Tesseract path
   as a photo.
3. **OCR of an image.**

A page counts as having a text layer when it carries at least
``MIN_PAGE_CHARS`` visible characters. A scanner that adds an invisible OCR
layer of its own produces text too; that is taken as-is, since it is usually
at least as good as a second pass would be.

Used by the agent's attachments and by ``/api/compute/ocr``, so an invoice
PDF reads the same wherever it is uploaded.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

from app.schemas.ocr import OcrExtractResult
from app.services import ocr_service

# Pages read from a PDF's text layer. Cheap — milliseconds a page.
MAX_PDF_PAGES = 20
# Scanned pages sent through OCR. Each costs 1–3 s with the best model at
# 300 dpi, and an invoice's figures are on its first pages.
MAX_OCR_PAGES = 5
MIN_PAGE_CHARS = 20
RENDER_DPI = 300

_HEIF_BRANDS = (b"heic", b"heix", b"hevc", b"heim", b"heis", b"mif1", b"msf1", b"avif")


class DocumentError(ValueError):
    """A file that cannot be read, with a message its sender can act on."""


class UnusableDocument(DocumentError):
    """Not merely unreadable by OCR but unusable by anyone: the wrong type, a
    corrupt or password-locked PDF. Refused even where a failed text
    extraction is tolerated, because the model could not open it either."""


# The long side a photo is sent to the model at. Both vendors downscale on
# their side anyway (OpenAI fits "high" detail into 2048 px, then 768 px on
# the short side), so anything bigger is bytes in the request and nothing in
# the reading.
MODEL_IMAGE_MAX_SIDE = 2048


@dataclass
class DocumentRead:
    kind: str  # "pdf" | "image"
    content_type: str
    method: str  # "text" | "ocr" | "mixed" | "none" (nothing extracted)
    pages: int
    pages_read: int
    text: str
    # Mean word confidence of whatever OCR read, in [0, 1]. 1.0 for a pure
    # text layer — nothing was guessed. None when the engine reports none.
    confidence: float | None
    invoice: OcrExtractResult
    notes: list[str] = field(default_factory=list)

    def fields(self) -> dict:
        """The invoice fields worth showing and handing to the agent."""
        inv = self.invoice
        parsed = inv.parsed
        return {
            "vendor": inv.vendor_name.value,
            "invoiceNumber": inv.invoice_number.value,
            "date": inv.date.value,
            "total": inv.total_amount.value,
            "vat": inv.vat_amount.value,
            "taxId": (parsed.vkn or parsed.tckn) if parsed else None,
            "invoiceType": inv.invoice_type,
            "needsReview": inv.needs_review,
        }


def sniff(content: bytes) -> tuple[str, str]:
    """(kind, content type) from the bytes themselves, never the filename."""
    if b"%PDF-" in content[:1024]:
        return "pdf", "application/pdf"
    if content.startswith(b"\xff\xd8\xff"):
        return "image", "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image", "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image", "image/webp"
    if content[4:8] == b"ftyp" and content[8:12] in _HEIF_BRANDS:
        raise UnusableDocument(
            "HEIC/HEIF fotoğraflar okunamıyor. Telefonda JPG olarak kaydedin "
            "ya da ekran görüntüsü gönderin."
        )
    raise UnusableDocument("Desteklenen dosyalar: PDF, JPG, PNG ve WEBP.")


def is_pdf(content: bytes) -> bool:
    return b"%PDF-" in content[:1024]


_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f\ufffe\uffff]")
_SPACES = re.compile(r"[ \t\u00a0]+")


def _clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL.sub("", text)
    lines = (_SPACES.sub(" ", line).strip() for line in text.split("\n"))
    return "\n".join(line for line in lines if line)


def for_model(content: bytes, content_type: str) -> tuple[str, bytes]:
    """The bytes to put in front of the model: (content type, data).

    A PDF goes as it is — both vendors read PDFs natively. A photo goes
    upright (phones store portrait shots sideways plus a rotation tag) and no
    larger than the model will look at: an 8 MB phone JPEG becomes a few
    hundred KB, which matters because it travels base64 inside the request
    and is sent again on every tool round of the turn.
    """
    if content_type == "application/pdf":
        return content_type, content
    try:
        from PIL import Image, ImageOps

        image = ImageOps.exif_transpose(Image.open(io.BytesIO(content)))
        if image.mode in ("RGBA", "LA", "P"):
            # A transparent screenshot on black would hide black text.
            image = image.convert("RGBA")
            flat = Image.new("RGB", image.size, "white")
            flat.paste(image, mask=image.split()[-1])
            image = flat
        elif image.mode != "RGB":
            image = image.convert("RGB")
        image.thumbnail((MODEL_IMAGE_MAX_SIDE, MODEL_IMAGE_MAX_SIDE), Image.LANCZOS)
        out = io.BytesIO()
        image.save(out, "JPEG", quality=90, optimize=True)
        return "image/jpeg", out.getvalue()
    except Exception:
        # The vendor can still take the original; a failed resize is not a
        # reason to withhold the file.
        return content_type, content


def read_document(content: bytes, *, strict: bool = True) -> DocumentRead:
    """Extract the text and the invoice fields.

    ``strict=False`` is for files that go to the model: there the text is a
    backup (offline answers, a model that refuses files), so a failed
    extraction — no Tesseract on the host, a photo with no printed text —
    returns an unread document rather than refusing the upload. A file
    nobody could open (``UnusableDocument``) is refused either way.
    """
    kind, content_type = sniff(content)
    try:
        if kind == "pdf":
            return _read_pdf(content)
        return _read_image(content, content_type)
    except UnusableDocument:
        raise
    except Exception as exc:
        if strict:
            raise
        return _unread(content, kind, content_type, exc)


def _unread(content: bytes, kind: str, content_type: str, exc: Exception) -> DocumentRead:
    if type(exc).__name__ == "TesseractNotFoundError":
        note = "Sunucuda OCR motoru kurulu olmadığı için metin çıkarılamadı."
    elif isinstance(exc, DocumentError):
        note = str(exc)
    else:
        note = "Sunucu bu dosyadan metin çıkaramadı."
    pages = 1
    if kind == "pdf":
        try:
            import pypdfium2 as pdfium

            doc = pdfium.PdfDocument(content)
            pages = len(doc)
            doc.close()
        except Exception:
            pass
    return DocumentRead(
        kind=kind,
        content_type=content_type,
        method="none",
        pages=pages,
        pages_read=0,
        text="",
        confidence=None,
        invoice=ocr_service.extract_invoice(""),
        notes=[note],
    )


def _read_image(content: bytes, content_type: str) -> DocumentRead:
    text, line_conf, confidence = ocr_service.read_image(content)
    text = _clean(text)
    if not text:
        raise DocumentError("Görselde okunabilir bir metin bulunamadı.")
    return DocumentRead(
        kind="image",
        content_type=content_type,
        method="ocr",
        pages=1,
        pages_read=1,
        text=text,
        confidence=confidence,
        invoice=ocr_service.extract_invoice(text, line_conf, confidence),
    )


def _read_pdf(content: bytes) -> DocumentRead:
    import pypdfium2 as pdfium

    try:
        doc = pdfium.PdfDocument(content)
    except pdfium.PdfiumError as exc:
        if "password" in str(exc).lower():
            raise UnusableDocument(
                "PDF parola korumalı. Parolasız bir kopyasını gönderin."
            ) from exc
        raise UnusableDocument("PDF açılamadı; dosya bozuk olabilir.") from exc

    pages = len(doc)
    parts: list[str] = []
    line_conf: dict[str, float] = {}
    text_pages = ocr_pages = skipped_scans = 0
    # (words, confidence) per page read, so the document's figure is a mean
    # over words exactly like a single page's, with a text page counting as
    # read perfectly.
    weighted: list[tuple[int, float]] = []

    try:
        for index in range(min(pages, MAX_PDF_PAGES)):
            page = doc[index]
            try:
                textpage = page.get_textpage()
                text = _clean(textpage.get_text_range())
                textpage.close()

                if len(re.sub(r"\s", "", text)) >= MIN_PAGE_CHARS:
                    text_pages += 1
                    weighted.append((len(text.split()), 1.0))
                elif ocr_pages < MAX_OCR_PAGES:
                    buffer = io.BytesIO()
                    page.render(scale=RENDER_DPI / 72).to_pil().save(buffer, "PNG")
                    text, conf_by_line, confidence = ocr_service.read_image(buffer.getvalue())
                    text = _clean(text)
                    ocr_pages += 1
                    line_conf.update(conf_by_line)
                    if confidence is not None:
                        weighted.append((max(len(text.split()), 1), confidence))
                else:
                    skipped_scans += 1
                    continue

                if text:
                    # Not on page 1: the vendor is read from the top lines,
                    # and "[Sayfa 1]" would be the first candidate it saw.
                    header = f"[Sayfa {index + 1}]\n" if index else ""
                    parts.append(header + text)
            finally:
                page.close()
    finally:
        doc.close()

    notes: list[str] = []
    if pages > MAX_PDF_PAGES:
        notes.append(f"Belge {pages} sayfa; ilk {MAX_PDF_PAGES} sayfası okundu.")
    if skipped_scans:
        notes.append(
            f"Taranmış {skipped_scans} sayfa okunmadı (en fazla {MAX_OCR_PAGES} "
            "taranmış sayfa okunur)."
        )

    full_text = "\n\n".join(parts)
    if not full_text.strip():
        raise DocumentError("Bu PDF'te okunabilir bir metin bulunamadı.")

    words = sum(n for n, _ in weighted)
    confidence = (
        round(sum(n * c for n, c in weighted) / words, 4) if words else None
    )
    method = "mixed" if text_pages and ocr_pages else "ocr" if ocr_pages else "text"

    return DocumentRead(
        kind="pdf",
        content_type="application/pdf",
        method=method,
        pages=pages,
        pages_read=text_pages + ocr_pages,
        text=full_text,
        confidence=confidence,
        invoice=ocr_service.extract_invoice(full_text, line_conf, confidence),
        notes=notes,
    )
