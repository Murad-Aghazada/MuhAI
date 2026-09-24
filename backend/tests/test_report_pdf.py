"""Blocks → HTML → PDF.

The HTML half is tested here properly; the PDF half gets one test that is
skipped when WeasyPrint's system libraries are absent. That split is
deliberate — the layout bugs live in the HTML and the renderer only has to be
proved to run, and a suite that cannot be run without Pango installed is a
suite people stop running.
"""
from __future__ import annotations

import pytest

from app.services import report_pdf as pdf

COMPANY = {"name": "Atlas Ticaret Ltd. Şti.", "taxId": "1234567890"}


def _artifact(*blocks) -> dict:
    return {
        "title": "Çeyrek Raporu",
        "subtitle": "2026 üçüncü çeyrek",
        "period": "2026 Q3",
        "blocks": list(blocks),
    }


def test_the_masthead_carries_the_company_the_title_and_the_period():
    html = pdf.render_html(_artifact({"type": "text", "text": "gövde"}), COMPANY)
    assert "Atlas Ticaret Ltd. Şti." in html
    assert "Çeyrek Raporu" in html
    assert "2026 Q3" in html
    assert "1234567890" in html


def test_block_text_is_escaped_rather_than_injected():
    """A vendor name is user data and reaches this renderer unfiltered."""
    html = pdf.render_html(
        _artifact({"type": "text", "text": "<script>alert(1)</script>"}), COMPANY
    )
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_a_company_name_with_a_quote_cannot_break_out_of_the_attribute():
    html = pdf.render_html(_artifact(), {"name": 'A" onload="x', "taxId": ""})
    assert 'data-company="A&quot; onload=&quot;x"' in html


def test_bold_survives_escaping():
    html = pdf.render_html(_artifact({"type": "text", "text": "net **12.350 ₺**"}), COMPANY)
    assert "<strong>12.350 ₺</strong>" in html


def test_a_table_renders_its_alignment_and_its_totals_row():
    html = pdf.render_html(
        _artifact(
            {
                "type": "table",
                "columns": ["Kategori", "Tutar"],
                "rows": [["Kira", "53.578 ₺"]],
                "align": ["left", "right"],
                "total": ["Toplam", "53.578 ₺"],
            }
        ),
        COMPANY,
    )
    assert '<td class="right">53.578 ₺</td>' in html
    assert "<tfoot>" in html


@pytest.mark.parametrize("kind", ["bar", "line", "area", "donut"])
def test_every_chart_kind_draws_something(kind):
    svg = pdf.chart_svg(
        {
            "type": "chart",
            "chart": kind,
            "title": "",
            "unit": "TRY",
            "categories": ["Oca", "Şub", "Mar"],
            "series": [{"name": "Gelir", "values": [10.0, 20.0, 15.0]}],
        }
    )
    assert svg.startswith("<svg")
    assert "<path" in svg or "<rect" in svg


def test_a_chart_svg_uses_only_what_weasyprint_can_render():
    """No filters, no foreignObject, no CSS inside the SVG. A chart that
    renders in a browser preview and vanishes in the PDF is the worst
    possible failure for a document someone is about to send their
    accountant."""
    svg = pdf.chart_svg(
        {
            "chart": "line",
            "categories": ["a", "b"],
            "series": [{"name": "s", "values": [1.0, 2.0]}],
            "title": "",
        }
    )
    for forbidden in ("<foreignObject", "<filter", "<style", "class="):
        assert forbidden not in svg


def test_a_chart_with_no_data_says_so_instead_of_drawing_an_empty_box():
    out = pdf.chart_svg({"chart": "bar", "categories": [], "series": []})
    assert "veri yok" in out


def test_an_unknown_block_type_renders_nothing_rather_than_raising():
    html = pdf.render_html(_artifact({"type": "hologram"}), COMPANY)
    assert "hologram" not in html


def test_the_pdf_renders():
    try:
        data = pdf.render_pdf(
            _artifact(
                {"type": "heading", "text": "Özet", "level": 2},
                {"type": "kpi", "items": [{"label": "Nakit", "value": "1.021.175 ₺", "tone": "ok", "delta": "", "hint": ""}]},
                {
                    "type": "chart",
                    "chart": "bar",
                    "title": "Aylık",
                    "unit": "TRY",
                    "categories": ["Tem", "Ağu", "Eyl"],
                    "series": [{"name": "Gelir", "values": [1.0, 2.0, 3.0]}],
                },
            ),
            COMPANY,
        )
    except pdf.PdfUnavailable as exc:  # pragma: no cover - host without Pango
        pytest.skip(f"WeasyPrint unavailable here: {exc}")

    assert data.startswith(b"%PDF-")
    assert len(data) > 1000
