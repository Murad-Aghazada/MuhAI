"""The block schema — the one contract three renderers agree on.

An agent answer is prose *plus* structure. The structure is a list of blocks,
and the same list is rendered three ways: by React in the message stream, by
React again in the split-view report pane, and by ``report_pdf`` into a PDF.
Encoding a chart into markdown and having each end parse it back out would
give three subtly different charts; a list of typed dicts gives one.

Seven block types, no more. Each is a shape a financial report actually needs,
and every one of them is something the existing console already draws:

    heading   a section title
    text      a paragraph; **bold** is the only inline markup
    kpi       a row of figures, each with an optional delta and tone
    chart     bar | line | area | donut over shared categories
    table     columns, rows, per-column alignment, optional totals row
    callout   one boxed sentence with a severity
    list      bullets or numbers

The model reaches these by *calling a tool* (``show_chart``, ``show_table``, …)
rather than by writing JSON into its reply, for one reason: a function call is
schema-checked by the model's own tooling before it arrives, while JSON in
prose is a string that is wrong about 5% of the time and unrecoverable when it
is. Everything below is still defensive — ``normalise`` is what stands between
a malformed call and a crashed render.
"""
from __future__ import annotations

from typing import Any

BLOCK_TYPES = ("heading", "text", "kpi", "chart", "table", "callout", "list")
CHART_KINDS = ("bar", "line", "area", "donut")
TONES = ("neutral", "ok", "warn", "stop", "info")

MAX_SERIES = 4
MAX_POINTS = 60
MAX_ROWS = 200
MAX_COLUMNS = 8


def _text(value: Any, limit: int = 4000) -> str:
    if value is None:
        return ""
    return str(value)[:limit]


def _tone(value: Any) -> str:
    tone = str(value or "neutral").lower()
    return tone if tone in TONES else "neutral"


def _number(value: Any) -> float:
    if isinstance(value, bool):
        return 0.0
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return 0.0


def _heading(block: dict) -> dict:
    level = block.get("level")
    return {
        "type": "heading",
        "text": _text(block.get("text"), 200),
        "level": 3 if str(level) == "3" else 2,
    }


def _paragraph(block: dict) -> dict:
    return {"type": "text", "text": _text(block.get("text"))}


def _kpi(block: dict) -> dict:
    items = []
    for item in (block.get("items") or [])[:6]:
        if not isinstance(item, dict):
            continue
        items.append(
            {
                "label": _text(item.get("label"), 80),
                # A value stays a *string*: the model has already formatted it
                # with the right unit and grouping, and re-formatting a number
                # here would mean guessing whether 18 is a percent or a count.
                "value": _text(item.get("value"), 40),
                "delta": _text(item.get("delta"), 24),
                "tone": _tone(item.get("tone")),
                "hint": _text(item.get("hint"), 120),
            }
        )
    return {"type": "kpi", "items": items}


def _chart(block: dict) -> dict:
    kind = str(block.get("chart") or "bar").lower()
    if kind not in CHART_KINDS:
        kind = "bar"

    categories = [_text(c, 40) for c in (block.get("categories") or [])][:MAX_POINTS]

    series = []
    for raw in (block.get("series") or [])[:MAX_SERIES]:
        if not isinstance(raw, dict):
            continue
        values = [_number(v) for v in (raw.get("values") or [])][: len(categories) or MAX_POINTS]
        # Pad rather than drop: a series one short of its categories is a model
        # slip, and a chart with a hole in it is more honest than one silently
        # shifted left by a category.
        values += [0.0] * (len(categories) - len(values))
        series.append({"name": _text(raw.get("name"), 60), "values": values})

    return {
        "type": "chart",
        "chart": kind,
        "title": _text(block.get("title"), 120),
        "unit": _text(block.get("unit"), 16) or "TRY",
        "categories": categories,
        "series": series,
    }


def _table(block: dict) -> dict:
    columns = [_text(c, 60) for c in (block.get("columns") or [])][:MAX_COLUMNS]
    width = len(columns)

    rows = []
    for raw in (block.get("rows") or [])[:MAX_ROWS]:
        if not isinstance(raw, (list, tuple)):
            continue
        cells = [_text(c, 160) for c in raw][:width]
        cells += [""] * (width - len(cells))
        rows.append(cells)

    align = [
        "right" if str(a).lower() == "right" else "left"
        for a in (block.get("align") or [])
    ][:width]
    align += ["left"] * (width - len(align))

    total = block.get("total")
    total_row = None
    if isinstance(total, (list, tuple)):
        total_row = [_text(c, 160) for c in total][:width]
        total_row += [""] * (width - len(total_row))

    return {
        "type": "table",
        "title": _text(block.get("title"), 120),
        "columns": columns,
        "rows": rows,
        "align": align,
        "total": total_row,
    }


def _callout(block: dict) -> dict:
    return {
        "type": "callout",
        "tone": _tone(block.get("tone")),
        "title": _text(block.get("title"), 120),
        "text": _text(block.get("text"), 1200),
    }


def _list(block: dict) -> dict:
    return {
        "type": "list",
        "ordered": bool(block.get("ordered")),
        "items": [_text(i, 400) for i in (block.get("items") or [])][:20],
    }


_BUILDERS = {
    "heading": _heading,
    "text": _paragraph,
    "kpi": _kpi,
    "chart": _chart,
    "table": _table,
    "callout": _callout,
    "list": _list,
}


def normalise(block: Any) -> dict | None:
    """Coerce one incoming block into the schema, or drop it.

    Returns None for anything unrecognised. A dropped block costs a chart; an
    un-dropped malformed one costs the whole answer, because the renderer that
    receives it is a React component with no error boundary of its own.
    """
    if not isinstance(block, dict):
        return None
    kind = str(block.get("type") or "").lower()
    builder = _BUILDERS.get(kind)
    if builder is None:
        return None
    return builder(block)


def normalise_all(blocks: Any, limit: int = 24) -> list[dict]:
    if not isinstance(blocks, (list, tuple)):
        return []
    out = []
    for block in blocks[:limit]:
        made = normalise(block)
        if made is not None:
            out.append(made)
    return out


def plain_text(blocks: list[dict]) -> str:
    """A flat reading of a block list — what a report says with nothing drawn.

    Used for the conversation title and anywhere an artifact has to appear as
    one line of prose.
    """
    parts: list[str] = []
    for block in blocks:
        kind = block.get("type")
        if kind in {"heading", "text"}:
            parts.append(block.get("text", ""))
        elif kind == "callout":
            parts.append(" ".join(filter(None, [block.get("title"), block.get("text")])))
        elif kind == "kpi":
            parts.extend(f"{i['label']}: {i['value']}" for i in block.get("items", []))
        elif kind == "list":
            parts.extend(block.get("items", []))
        elif kind in {"chart", "table"} and block.get("title"):
            parts.append(block["title"])
    return "\n".join(p for p in parts if p)
