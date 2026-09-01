"""Rule-based Turkish expense categorisation."""
import pytest

from app.services.expense_classifier import CATEGORIES, classify_expense


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Opet akaryakit alimi", "fuel"),
        ("Lokanta yemek gideri", "restaurant"),
        ("Ofis kira odemesi", "rent"),
        ("Elektrik faturasi", "utilities"),
        ("Personel maas odemesi", "payroll"),
        ("KDV vergi odemesi", "tax_payments"),
        ("Microsoft yazilim lisansi", "software"),
        ("Sosyal medya reklam ilani", "marketing"),
        ("Aras kargo gonderi", "shipping"),
        ("THY ucak bileti", "travel"),
        ("Banka havale komisyonu", "bank_fees"),
        ("Kirtasiye toner alimi", "office_supplies"),
        ("Hammadde tedarik", "raw_materials"),
        ("Bilgisayar ekipman alimi", "equipment"),
        ("Klima bakım ve onarım", "maintenance"),
        ("Kasko sigorta policesi", "insurance"),
    ],
)
def test_known_keywords_map_to_category(text, expected):
    assert classify_expense(text) == expected


def test_unknown_text_falls_back_to_other():
    assert classify_expense("zzz belirsiz aciklama") == "other"


def test_vendor_is_considered_alongside_description():
    assert classify_expense(None, vendor="Shell Petrol") == "fuel"


def test_none_inputs_do_not_raise():
    assert classify_expense(None, None) == "other"


def test_result_is_always_a_known_category():
    assert classify_expense("rastgele metin") in CATEGORIES


# ── Documented behaviour discovered by these tests ─────────────────────
def test_rule_order_means_vendor_brand_can_win_over_intent():
    """Known behaviour: _RULES is first-match-wins and `software` is checked
    before `marketing`, so a Google *ad* spend classifies as software because
    "google" is a software keyword. Recorded so a future reorder is deliberate.
    """
    assert classify_expense("Google reklam harcamasi") == "software"


def test_classifier_is_diacritic_sensitive():
    """Known limitation: keywords carry Turkish diacritics, so OCR text that has
    lost them ("bakim" for "bakım") falls through to `other`. Relevant because
    OCR output frequently drops diacritics.
    """
    assert classify_expense("Klima bakım ve onarım") == "maintenance"
    assert classify_expense("Klima bakim ve onarim") == "other"
