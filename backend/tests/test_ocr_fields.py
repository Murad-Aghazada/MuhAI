"""Vendor extraction and measured confidence.

Both of these were constants before: the vendor was "first mostly-alphabetic
line" and every confidence was a literal, so the review badge read the same
number on a pristine scan and a bad photograph. These tests pin the two
properties that made it meaningless.

Pure functions only — no Tesseract, so they run anywhere.
"""
import io

from app.services import ocr_service
from app.services.ocr_service import (
    OcrEngine,
    TesseractEngine,
    _extract_fields,
    _extract_vendor,
    _page_confidence,
    _score,
    _score_line,
)


# ── Vendor ────────────────────────────────────────────────────────────
def test_the_legal_form_wins_over_position():
    """A photograph puts glare and the document banner above the letterhead.
    Position is the thing a camera disturbs; "A.Ş." is not."""
    vendor, certainty = _extract_vendor(
        ["E-FATURA", "~~ ..", "ANADOLU TEDARIK A.S.", "Bagdat Cad. No:142"]
    )
    assert vendor == "ANADOLU TEDARIK A.S."
    assert certainty == 0.9


def test_turkish_legal_forms_are_recognised():
    for line, expected in [
        ("Teknopark Gayrimenkul A.Ş.", "Teknopark Gayrimenkul A.Ş."),
        ("Ege Ambalaj Ltd. Şti.", "Ege Ambalaj Ltd. Şti."),
        ("Yılmaz San. ve Tic. A.Ş.", "Yılmaz San. ve Tic. A.Ş."),
    ]:
        vendor, certainty = _extract_vendor(["FATURA", line, "Vergi No: 1"])
        assert vendor == expected
        assert certainty == 0.9


def test_document_banners_are_never_the_vendor():
    for banner in ["FATURA", "E-ARŞİV FATURA", "İRSALİYE", "SAYIN", "MAKBUZ"]:
        vendor, _ = _extract_vendor([banner, "Ege Ambalaj Ltd. Şti."])
        assert vendor == "Ege Ambalaj Ltd. Şti."


def test_a_name_without_a_legal_form_is_still_offered_but_doubted():
    """A sole trader has no "A.Ş.". Returning nothing would be worse than
    guessing, so long as the guess says it is one."""
    vendor, certainty = _extract_vendor(["Mehmet Yılmaz", "Bağdat Cad"])
    assert vendor == "Mehmet Yılmaz"
    assert certainty == 0.5


def test_nothing_usable_scores_zero():
    assert _extract_vendor(["123", ".."]) == (None, 0.0)


# ── Confidence ────────────────────────────────────────────────────────
def test_confidence_falls_when_the_page_reads_badly():
    clean = _score(0.9, {"ANADOLU TEDARIK A.S.": 0.95}, "ANADOLU TEDARIK A.S.")
    poor = _score(0.9, {"ANADOLU TEDARIK A.S.": 0.45}, "ANADOLU TEDARIK A.S.")
    assert clean > poor
    assert poor < 0.5


def test_an_engine_without_confidence_falls_back_to_the_rule():
    """A cloud OCR provider need not implement image_to_lines()."""
    assert _score(0.9, {}, "X") == 0.9


def test_a_missing_field_scores_zero_however_clean_the_page():
    assert _score(0.9, {"whatever": 1.0}, None) == 0.0


def test_amounts_are_scored_from_their_own_line():
    """The parsed float (14820.0) never appears in the text ("14.820,00"), so
    the amount fields have to carry their source line or they silently keep
    the old hardcoded number."""
    line = "GENEL TOPLAM: 14.820,00"
    assert _score_line(0.8, {line: 0.5}, line, 14820.0) == 0.4
    assert _score_line(0.8, {line: 1.0}, line, 14820.0) == 0.8


def test_fields_are_measured_end_to_end():
    text = "\n".join(
        [
            "FATURA",
            "ANADOLU TEDARIK A.S.",
            "Fatura No: AND-2026-8842",
            "Fatura Tarihi: 05.09.2026",
            "Hesaplanan KDV %20: 2.470,00",
            "GENEL TOPLAM: 14.820,00",
        ]
    )
    crisp = _extract_fields(text, {ln: 0.95 for ln in text.splitlines()})
    smudged = _extract_fields(text, {ln: 0.40 for ln in text.splitlines()})

    assert crisp.vendor_name.value == "ANADOLU TEDARIK A.S."
    assert crisp.total_amount.value == 14820.0
    assert crisp.vat_amount.value == 2470.0

    # Same text, same fields — only the reading quality differs, and every
    # field has to notice.
    for field in ("vendor_name", "invoice_number", "date", "total_amount", "vat_amount"):
        assert getattr(crisp, field).confidence > getattr(smudged, field).confidence, field
    assert smudged.needs_review is True


# ── Page preparation ──────────────────────────────────────────────────
def test_a_portrait_phone_photo_is_turned_upright_before_reading():
    """Phones store a portrait shot as landscape pixels plus an Orientation
    tag. The browser engine honours the tag; this path used to read the
    pixels as stored, so every portrait photo arrived sideways."""
    from PIL import Image

    exif = Image.Exif()
    exif[0x0112] = 6  # "rotate 90° clockwise to display"
    stored = io.BytesIO()
    Image.new("RGB", (400, 300), "white").save(stored, "JPEG", exif=exif.tobytes())

    width, height = TesseractEngine._prepare(Image.open(io.BytesIO(stored.getvalue()))).size
    assert height > width


def test_an_image_without_exif_keeps_its_orientation():
    from PIL import Image

    width, height = TesseractEngine._prepare(Image.new("RGB", (2000, 1000), "white")).size
    assert (width, height) == (2000, 1000)


# ── Page confidence ───────────────────────────────────────────────────
def test_page_confidence_is_the_mean_over_words_not_lines():
    """Three words at 0.9 and one at 0.3 is a page read at 0.75. A mean of
    lines would say 0.6 and let one stray mark drag the whole page down."""
    assert _page_confidence([("ANADOLU TEDARIK A.S.", 0.9), ("~", 0.3)]) == 0.75


def test_an_empty_page_has_no_confidence():
    assert _page_confidence([]) is None


class _FakeEngine(OcrEngine):
    def __init__(self, lines):
        self.lines = lines

    def image_to_text(self, image_bytes):
        return "\n".join(text for text, _ in self.lines)

    def image_to_lines(self, image_bytes):
        return self.lines


class _BlindEngine(_FakeEngine):
    """A provider that reports text but no confidence."""

    def image_to_lines(self, image_bytes):
        return []


def test_a_clean_read_reports_the_engines_own_confidence(monkeypatch):
    """The field scores multiply in the rule's own certainty, so a flawless
    read used to top out near 0.75 on the server while the browser showed
    0.94 for the same fields. The page figure is the browser's measure."""
    lines = [
        ("ANADOLU TEDARIK A.S.", 0.95),
        ("Fatura No: AND-2026-8842", 0.94),
        ("GENEL TOPLAM: 14.820,00", 0.93),
    ]
    monkeypatch.setattr(ocr_service, "_engine", _FakeEngine(lines))
    result = ocr_service.scan_invoice(b"")

    assert result.confidence > 0.9
    assert result.confidence > min(
        result.vendor_name.confidence,
        result.invoice_number.confidence,
        result.total_amount.confidence,
    )


def test_an_engine_without_confidence_reports_none(monkeypatch):
    monkeypatch.setattr(
        ocr_service, "_engine", _BlindEngine([("GENEL TOPLAM: 14.820,00", 0.0)])
    )
    result = ocr_service.scan_invoice(b"")
    assert result.confidence is None
    assert result.total_amount.value == 14820.0


# ── Model ─────────────────────────────────────────────────────────────
def test_the_vendored_turkish_model_is_the_best_one():
    """tessdata_best, not the fast model apt installs: its network reads a
    48 px line through a 192-wide final layer (fast: 36 px, 128)."""
    model = ocr_service._VENDORED_TESSDATA / "tur.traineddata"
    assert model.is_file()
    assert b"[1,48,0,1Ct3,3,16Mp3,3Lfys64Lfx96Lrx96Lfx192O1c1]" in model.read_bytes()


def test_tesseract_is_pointed_at_the_vendored_model(monkeypatch):
    monkeypatch.setattr(ocr_service.settings, "OCR_LANG", "tur")
    monkeypatch.setattr(ocr_service.settings, "OCR_TESSDATA_DIR", "")
    config = ocr_service.tesseract_config()
    assert config.startswith("--psm 6 --tessdata-dir ")
    # Quoted, forward slashes: pytesseract shlex-splits this string, and the
    # repo can live under a folder with a space in its name.
    folder = ocr_service._VENDORED_TESSDATA.as_posix()
    assert f'"{folder}"' in config


def test_a_language_the_folder_lacks_falls_back_to_the_system(monkeypatch):
    """Tesseract takes one folder. Half a folder would fail English outright
    rather than read it with the system model."""
    monkeypatch.setattr(ocr_service.settings, "OCR_LANG", "tur+eng")
    monkeypatch.setattr(ocr_service.settings, "OCR_TESSDATA_DIR", "")
    assert ocr_service.tessdata_dir() is None
    assert ocr_service.tesseract_config() == "--psm 6"


def test_the_engine_passes_the_model_to_tesseract(monkeypatch):
    import pytesseract
    from PIL import Image

    seen = {}

    def fake_image_to_data(image, lang, config, output_type):
        seen.update(lang=lang, config=config)
        return {"text": [], "conf": [], "block_num": [], "par_num": [], "line_num": []}

    monkeypatch.setattr(ocr_service.settings, "OCR_LANG", "tur")
    monkeypatch.setattr(ocr_service.settings, "OCR_TESSDATA_DIR", "")
    monkeypatch.setattr(pytesseract, "image_to_data", fake_image_to_data)
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), "white").save(buf, "PNG")

    TesseractEngine().image_to_lines(buf.getvalue())
    assert seen["lang"] == "tur"
    assert "--tessdata-dir" in seen["config"]
