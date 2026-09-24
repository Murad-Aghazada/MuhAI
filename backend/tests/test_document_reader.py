"""Reading attached documents: a PDF's text layer first, OCR only when needed.

No Tesseract here. PDFs are built in the test (PDFium writes a real text
layer with an embedded TrueType font), and wherever OCR would run a fake
engine stands in, so these run on any machine with the Python dependencies.
"""
import ctypes
import io
from pathlib import Path

import pytest

from app.services import document_reader, ocr_service
from app.services.document_reader import DocumentError, read_document, sniff
from app.services.ocr_service import OcrEngine

pdfium = pytest.importorskip("pypdfium2")
raw = pytest.importorskip("pypdfium2.raw")

INVOICE = [
    "ŞAHİN GIDA SANAYİ VE TİCARET A.Ş.",
    "Kadıköy Vergi Dairesi VKN: 8120045673",
    "Fatura No: SGT2026000001482",
    "Fatura Tarihi: 14.09.2026",
    "Çiğ Köfte Baharatı 1.060,00",
    "Hesaplanan KDV (%20) 1.547,20",
    "Ödenecek Tutar 9.283,20",
]

_FONTS = [
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),  # the Docker image
    Path("C:/Windows/Fonts/DejaVuSans.ttf"),
    Path("C:/Windows/Fonts/arial.ttf"),
    Path("/Library/Fonts/Arial Unicode.ttf"),
]


def _font() -> Path:
    for path in _FONTS:
        if path.is_file():
            return path
    pytest.skip("no TrueType font with Turkish glyphs on this machine")


def text_pdf(pages: list[list[str]]) -> bytes:
    """A generated PDF, like an e-Arşiv one: real text, embedded font."""
    data = _font().read_bytes()
    pdf = pdfium.PdfDocument.new()
    font_buf = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
    font = raw.FPDFText_LoadFont(pdf, font_buf, len(data), raw.FPDF_FONT_TRUETYPE, True)
    for lines in pages:
        page = pdf.new_page(595, 842)
        for i, line in enumerate(lines):
            obj = raw.FPDFPageObj_CreateTextObj(pdf, font, 12.0)
            wide = (line + "\x00").encode("utf-16-le")
            buf = ctypes.create_string_buffer(wide, len(wide))
            raw.FPDFText_SetText(obj, ctypes.cast(buf, ctypes.POINTER(raw.FPDF_WCHAR)))
            raw.FPDFPageObj_Transform(obj, 1, 0, 0, 1, 50, 780 - 18 * i)
            raw.FPDFPage_InsertObject(page, obj)
        raw.FPDFPage_GenerateContent(page)
    out = io.BytesIO()
    pdf.save(out)
    return out.getvalue()


def scanned_pdf(pages: int = 1) -> bytes:
    """A scan saved as PDF: images only, no text layer."""
    from PIL import Image

    images = [Image.new("RGB", (400, 560), "white") for _ in range(pages)]
    out = io.BytesIO()
    images[0].save(out, "PDF", save_all=True, append_images=images[1:])
    return out.getvalue()


def png() -> bytes:
    from PIL import Image

    out = io.BytesIO()
    Image.new("RGB", (40, 40), "white").save(out, "PNG")
    return out.getvalue()


class FakeEngine(OcrEngine):
    """Returns the same page for every image, and counts the calls."""

    def __init__(self, lines):
        self.lines = lines
        self.calls = 0

    def image_to_text(self, image_bytes):
        return "\n".join(t for t, _ in self.lines)

    def image_to_lines(self, image_bytes):
        self.calls += 1
        return self.lines


class RefusingEngine(OcrEngine):
    def image_to_text(self, image_bytes):
        raise AssertionError("OCR must not run on a PDF that has a text layer")

    image_to_lines = image_to_text


# ── The text layer ────────────────────────────────────────────────────
def test_a_generated_pdf_is_read_from_its_text_layer_exactly(monkeypatch):
    """The whole point: e-Fatura / e-Arşiv PDFs carry their text, so every
    Turkish letter comes back exactly and OCR never runs."""
    monkeypatch.setattr(ocr_service, "_engine", RefusingEngine())
    read = read_document(text_pdf([INVOICE]))

    assert read.kind == "pdf"
    assert read.method == "text"
    assert read.confidence == 1.0
    assert read.text.split("\n") == INVOICE

    fields = read.fields()
    assert fields["vendor"] == "ŞAHİN GIDA SANAYİ VE TİCARET A.Ş."
    assert fields["invoiceNumber"] == "SGT2026000001482"
    assert fields["date"] == "2026-09-14"
    assert fields["total"] == 9283.20
    assert fields["vat"] == 1547.20
    assert fields["taxId"] == "8120045673"


def test_later_pages_are_marked_but_the_first_is_not(monkeypatch):
    """The vendor is looked for in the top lines; a "[Sayfa 1]" header would
    be the first thing it saw."""
    monkeypatch.setattr(ocr_service, "_engine", RefusingEngine())
    read = read_document(text_pdf([INVOICE, ["Sayfa iki içeriği burada yer alıyor"]]))

    assert read.pages == 2 and read.pages_read == 2
    assert read.text.startswith("ŞAHİN GIDA")
    assert "[Sayfa 2]\nSayfa iki içeriği" in read.text
    assert read.fields()["vendor"] == "ŞAHİN GIDA SANAYİ VE TİCARET A.Ş."


# ── Scans ─────────────────────────────────────────────────────────────
def test_a_scanned_pdf_goes_through_ocr(monkeypatch):
    engine = FakeEngine([("ANADOLU TEDARIK A.S.", 0.9), ("GENEL TOPLAM: 14.820,00", 0.8)])
    monkeypatch.setattr(ocr_service, "_engine", engine)
    read = read_document(scanned_pdf())

    assert read.method == "ocr"
    assert engine.calls == 1
    assert read.fields()["total"] == 14820.0
    # Word-weighted: three words at 0.9, three at 0.8.
    assert read.confidence == pytest.approx(0.85)


def test_only_the_first_scanned_pages_are_ocrd(monkeypatch):
    engine = FakeEngine([("GENEL TOPLAM: 100,00", 0.9)])
    monkeypatch.setattr(ocr_service, "_engine", engine)
    read = read_document(scanned_pdf(pages=document_reader.MAX_OCR_PAGES + 2))

    assert engine.calls == document_reader.MAX_OCR_PAGES
    assert read.pages_read == document_reader.MAX_OCR_PAGES
    assert any("okunmadı" in note for note in read.notes)


def test_a_pdf_with_nothing_readable_says_so(monkeypatch):
    monkeypatch.setattr(ocr_service, "_engine", FakeEngine([]))
    with pytest.raises(DocumentError, match="okunabilir"):
        read_document(scanned_pdf())


def test_a_corrupt_pdf_is_a_readable_error():
    with pytest.raises(DocumentError, match="PDF"):
        read_document(b"%PDF-1.7\nthis is not a pdf at all")


# ── Images and file types ─────────────────────────────────────────────
def test_an_image_is_ocrd(monkeypatch):
    monkeypatch.setattr(
        ocr_service, "_engine", FakeEngine([("Fatura No: AND-2026-8842", 0.95)])
    )
    read = read_document(png())
    assert (read.kind, read.method, read.content_type) == ("image", "ocr", "image/png")
    assert read.fields()["invoiceNumber"] == "AND-2026-8842"


def test_the_type_comes_from_the_bytes_not_the_name():
    assert sniff(png()) == ("image", "image/png")
    assert sniff(b"\xff\xd8\xff\xe0" + b"\x00" * 20) == ("image", "image/jpeg")
    assert sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == ("image", "image/webp")
    assert sniff(b"%PDF-1.4\n") == ("pdf", "application/pdf")


def test_an_iphone_photo_gets_an_instruction_not_a_shrug():
    heic = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 16
    with pytest.raises(DocumentError, match="JPG"):
        sniff(heic)


def test_anything_else_is_refused():
    with pytest.raises(DocumentError, match="PDF, JPG, PNG"):
        sniff(b"PK\x03\x04 a zip file")


# ── For the model ─────────────────────────────────────────────────────
def test_a_phone_photo_goes_to_the_model_upright_and_smaller():
    from PIL import Image

    exif = Image.Exif()
    exif[0x0112] = 6  # stored sideways, as phones store portrait shots
    raw_photo = io.BytesIO()
    Image.new("RGB", (4000, 3000), "white").save(raw_photo, "JPEG", exif=exif.tobytes())

    mime, data = document_reader.for_model(raw_photo.getvalue(), "image/jpeg")
    image = Image.open(io.BytesIO(data))
    assert mime == "image/jpeg"
    assert image.size == (1536, 2048)  # upright, long side capped


def test_a_transparent_screenshot_is_flattened_onto_white():
    from PIL import Image

    shot = io.BytesIO()
    Image.new("RGBA", (300, 200), (0, 0, 0, 0)).save(shot, "PNG")
    mime, data = document_reader.for_model(shot.getvalue(), "image/png")
    assert mime == "image/jpeg"
    assert Image.open(io.BytesIO(data)).getpixel((10, 10))[0] > 240


def test_a_pdf_goes_to_the_model_as_it_is():
    pdf = scanned_pdf()
    assert document_reader.for_model(pdf, "application/pdf") == ("application/pdf", pdf)


# ── Tolerant reading, for attachments ─────────────────────────────────
class TesseractNotFoundError(OSError):
    """Same name as pytesseract's, which is what the reader looks for."""


class MissingTesseract(OcrEngine):
    def image_to_text(self, image_bytes):
        raise TesseractNotFoundError("tesseract is not installed")

    image_to_lines = image_to_text


def test_no_ocr_engine_still_accepts_the_file_for_the_model(monkeypatch):
    """The model reads the file itself; a host without Tesseract only loses
    the backup text, not the attachment."""
    monkeypatch.setattr(ocr_service, "_engine", MissingTesseract())
    read = read_document(png(), strict=False)
    assert (read.method, read.text, read.pages_read) == ("none", "", 0)
    assert "OCR motoru" in read.notes[0]


def test_strict_reading_still_raises(monkeypatch):
    monkeypatch.setattr(ocr_service, "_engine", MissingTesseract())
    with pytest.raises(OSError):
        read_document(png())


def test_a_file_nobody_could_open_is_refused_either_way():
    with pytest.raises(DocumentError):
        read_document(b"%PDF-1.7\nnot a pdf", strict=False)
    with pytest.raises(DocumentError):
        read_document(b"PK\x03\x04", strict=False)
