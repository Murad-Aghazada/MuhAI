"""Invoice OCR service.

Uses Tesseract 5 (via pytesseract) with the Turkish language pack to read an
uploaded invoice image, then applies regex heuristics to pull out structured
fields with per-field confidence scores.

The public surface is the abstract ``OcrEngine`` interface so a cloud OCR /
LLM-vision provider can be dropped in later without changing the route.
"""
from __future__ import annotations

import io
import re
from abc import ABC, abstractmethod
from datetime import datetime

from dataclasses import asdict

from app.core.config import settings
from app.schemas.invoice import OcrExtractField, OcrExtractResult, ParsedInvoiceOut
from app.services.ocr_parser import parse_invoice_text

CONFIDENCE_THRESHOLD = 0.7

# ── Regex heuristics ───────────────────────────────────────────────────
_INVOICE_NO_RE = re.compile(
    r"(?:fatura\s*(?:no|numaras[ıi])|invoice\s*(?:no|number))\s*[:#]?\s*([A-Z0-9\-/]+)",
    re.IGNORECASE,
)
_DATE_RE = re.compile(r"(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})")
_AMOUNT_RE = re.compile(r"(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))")
_VAT_LINE_RE = re.compile(r"(?:kdv|vat)", re.IGNORECASE)
_TOTAL_LINE_RE = re.compile(r"(?:genel\s*toplam|toplam|total|tutar)", re.IGNORECASE)


def _parse_amount(raw: str) -> float | None:
    """Parse a Turkish-formatted number string like '1.234,56' -> 1234.56."""
    s = raw.strip()
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return round(float(s), 2)
    except ValueError:
        return None


class OcrEngine(ABC):
    """Swappable OCR backend interface."""

    @abstractmethod
    def image_to_text(self, image_bytes: bytes) -> str:  # pragma: no cover
        ...


class TesseractEngine(OcrEngine):
    def image_to_text(self, image_bytes: bytes) -> str:
        # Imported lazily so the module imports even when system Tesseract or
        # Pillow is missing (e.g. during unit tests of the parsing helpers).
        import pytesseract
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(image, lang=settings.OCR_LANG)


def _extract_fields(text: str) -> OcrExtractResult:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # Vendor name: first non-empty, mostly-alphabetic line is a decent guess.
    vendor = next(
        (ln for ln in lines if len(ln) > 3 and sum(c.isalpha() for c in ln) > len(ln) // 2),
        None,
    )
    vendor_field = OcrExtractField(
        value=vendor, confidence=0.6 if vendor else 0.0
    )

    inv_match = _INVOICE_NO_RE.search(text)
    invoice_field = OcrExtractField(
        value=inv_match.group(1) if inv_match else None,
        confidence=0.85 if inv_match else 0.0,
    )

    date_match = _DATE_RE.search(text)
    date_value: str | None = None
    if date_match:
        d, m, y = date_match.groups()
        if len(y) == 2:
            y = "20" + y
        try:
            date_value = datetime(int(y), int(m), int(d)).date().isoformat()
        except ValueError:
            date_value = None
    date_field = OcrExtractField(
        value=date_value, confidence=0.8 if date_value else 0.0
    )

    # Total amount: pick the largest amount appearing on a "total" line,
    # otherwise the largest amount anywhere.
    total_candidates: list[float] = []
    vat_candidates: list[float] = []
    for ln in lines:
        amounts = [a for a in (_parse_amount(m) for m in _AMOUNT_RE.findall(ln)) if a]
        if not amounts:
            continue
        if _VAT_LINE_RE.search(ln):
            vat_candidates.extend(amounts)
        if _TOTAL_LINE_RE.search(ln):
            total_candidates.extend(amounts)

    all_amounts = [
        a for ln in lines for a in (_parse_amount(m) for m in _AMOUNT_RE.findall(ln)) if a
    ]
    total = max(total_candidates) if total_candidates else (max(all_amounts) if all_amounts else None)
    total_field = OcrExtractField(
        value=total,
        confidence=0.8 if total_candidates else (0.5 if total else 0.0),
    )

    vat = max(vat_candidates) if vat_candidates else None
    vat_field = OcrExtractField(
        value=vat, confidence=0.75 if vat_candidates else 0.0
    )

    fields = [vendor_field, invoice_field, date_field, total_field, vat_field]
    avg_conf = sum(f.confidence for f in fields) / len(fields)
    needs_review = avg_conf < CONFIDENCE_THRESHOLD

    # Rich post-processing (Module 1): identity, tax details, invoice type.
    parsed = parse_invoice_text(text)
    parsed_out = ParsedInvoiceOut(**asdict(parsed))

    # Prefer the parser's total/VAT when the line-based heuristics found nothing.
    if total_field.value is None and parsed.total_amount is not None:
        total_field = OcrExtractField(value=parsed.total_amount, confidence=0.7)
    if vat_field.value is None and parsed.kdv_amount is not None:
        vat_field = OcrExtractField(value=parsed.kdv_amount, confidence=0.7)

    return OcrExtractResult(
        vendor_name=vendor_field,
        invoice_number=invoice_field,
        date=date_field,
        total_amount=total_field,
        vat_amount=vat_field,
        raw_text=text,
        needs_review=needs_review,
        invoice_type=parsed.invoice_type,
        parsed=parsed_out,
    )


# Default engine instance (Tesseract). Swap here for a cloud provider.
_engine: OcrEngine = TesseractEngine()


def scan_invoice(image_bytes: bytes) -> OcrExtractResult:
    """OCR an invoice image and return structured, confidence-scored fields."""
    text = _engine.image_to_text(image_bytes)
    return _extract_fields(text)
