"""The block schema is a contract between three renderers.

React draws these in the message stream, React draws them again in the report
pane, and ``report_pdf`` draws them into a PDF. None of the three has an error
boundary worth the name, so ``normalise`` is the only thing standing between a
model's malformed function call and a blank answer. These tests are about that
boundary, not about the happy path.
"""
from app.services import agent_blocks as blocks


def test_an_unknown_block_type_is_dropped_not_raised():
    assert blocks.normalise({"type": "hologram", "text": "x"}) is None
    assert blocks.normalise("not a dict") is None
    assert blocks.normalise(None) is None


def test_normalise_all_keeps_the_good_blocks_and_drops_the_rest():
    out = blocks.normalise_all(
        [
            {"type": "text", "text": "bir"},
            {"type": "nonsense"},
            {"type": "heading", "text": "iki"},
        ]
    )
    assert [b["type"] for b in out] == ["text", "heading"]


def test_a_short_series_is_padded_rather_than_shifted():
    """A hole in the chart is honest; a series silently slid left is not."""
    block = blocks.normalise(
        {
            "type": "chart",
            "chart": "bar",
            "categories": ["Oca", "Şub", "Mar"],
            "series": [{"name": "Gelir", "values": [10, 20]}],
        }
    )
    assert block["series"][0]["values"] == [10.0, 20.0, 0.0]


def test_a_long_series_is_trimmed_to_its_categories():
    block = blocks.normalise(
        {
            "type": "chart",
            "chart": "line",
            "categories": ["Oca", "Şub"],
            "series": [{"name": "Gider", "values": [1, 2, 3, 4]}],
        }
    )
    assert block["series"][0]["values"] == [1.0, 2.0]


def test_an_unusable_chart_kind_falls_back_to_bar():
    block = blocks.normalise(
        {"type": "chart", "chart": "sankey", "categories": ["a"], "series": []}
    )
    assert block["chart"] == "bar"


def test_a_non_numeric_chart_value_becomes_zero_not_an_exception():
    block = blocks.normalise(
        {
            "type": "chart",
            "chart": "bar",
            "categories": ["a", "b"],
            "series": [{"name": "s", "values": ["12,5", None]}],
        }
    )
    assert block["series"][0]["values"] == [0.0, 0.0]


def test_table_rows_are_squared_off_against_the_columns():
    """A ragged row would misalign every cell after it."""
    block = blocks.normalise(
        {
            "type": "table",
            "columns": ["Kategori", "Tutar"],
            "rows": [["Kira"], ["Bordro", "1.000 ₺", "fazla"]],
            "align": ["left"],
        }
    )
    assert block["rows"] == [["Kira", ""], ["Bordro", "1.000 ₺"]]
    # A missing alignment defaults to left rather than dropping the column.
    assert block["align"] == ["left", "left"]


def test_a_table_row_that_is_not_a_list_is_dropped():
    block = blocks.normalise(
        {"type": "table", "columns": ["a"], "rows": [["ok"], "oops", 7]}
    )
    assert block["rows"] == [["ok"]]


def test_a_kpi_value_stays_a_string():
    """The model formats the unit and the grouping; re-parsing it here would
    mean guessing whether 18 is a percentage, a count or eighteen lira."""
    block = blocks.normalise(
        {"type": "kpi", "items": [{"label": "KDV", "value": 1234, "tone": "purple"}]}
    )
    item = block["items"][0]
    assert item["value"] == "1234"
    # An invented tone is neutralised rather than passed through to a CSS class
    # that does not exist.
    assert item["tone"] == "neutral"


def test_a_kpi_row_is_capped_at_six():
    block = blocks.normalise(
        {"type": "kpi", "items": [{"label": str(i), "value": "1"} for i in range(12)]}
    )
    assert len(block["items"]) == 6


def test_plain_text_reads_a_block_list_without_drawing_it():
    text = blocks.plain_text(
        [
            {"type": "heading", "text": "Özet"},
            {"type": "kpi", "items": [{"label": "Nakit", "value": "10 ₺"}]},
            {"type": "chart", "title": "Aylık", "categories": [], "series": []},
        ]
    )
    assert "Özet" in text
    assert "Nakit: 10 ₺" in text
    assert "Aylık" in text
