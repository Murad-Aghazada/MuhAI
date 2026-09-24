"""Report blocks → HTML → PDF.

The split-view pane and the downloaded PDF must be the same document. They are
rendered by different engines — React on one side, WeasyPrint on the other — so
the only way to keep them honest is to have both read the *same* block list
(``agent_blocks``) and to state the design in one stylesheet per side rather
than letting either invent structure.

Charts are drawn here as plain SVG: rects, paths, text and nothing else. That
is deliberate. WeasyPrint's SVG support is real but narrow — no filters, no
foreignObject, no CSS inside the SVG — and a chart that renders in a browser
preview and silently disappears in the PDF is the worst possible failure for a
document someone is about to email to their accountant. Everything below is
inside that narrow set, and the geometry is computed in Python rather than
delegated to the renderer.

The page is A4 with a running footer carrying the company name and the page
number, because a printed financial report that cannot be reassembled after
being dropped is not a financial report.
"""
from __future__ import annotations

import datetime as dt
import html
import math
from typing import Any

# The console's categorical ramp, verbatim from `console.css`. Re-ordering it
# means re-validating it there too — the same series must not change colour
# between the screen and the paper.
SERIES_COLOURS = (
    "#8b86c9",
    "#6aa5e0",
    "#5aa9a2",
    "#9db45f",
    "#e2c24f",
    "#c9764a",
    "#b9718f",
    "#6f7b8c",
)

INK = "#242426"
INK_50 = "#8f8f92"
INK_25 = "#c7c7c9"
RULE = "#e6e7ea"
DARK = "#35363b"
LIME = "#d9ff5c"

TONE_COLOURS = {
    "ok": "#4a7c33",
    "warn": "#9a6420",
    "stop": "#a4433a",
    "info": DARK,
    "neutral": INK_50,
}

PLOT_W = 720
PLOT_H = 260
PAD_L = 62
PAD_R = 14
PAD_T = 14
PAD_B = 34


def _e(text: Any) -> str:
    return html.escape(str(text if text is not None else ""))


def _fmt(value: float) -> str:
    """Turkish grouping, compacted past a million — an axis label has no room
    for nine digits and nobody reads the last three of them anyway."""
    if abs(value) >= 1_000_000:
        return f"{value / 1_000_000:.1f}M".replace(".", ",")
    if abs(value) >= 1_000:
        return f"{value / 1_000:.0f}B"
    return f"{value:.0f}"


def _nice_step(span: float, count: int) -> float:
    if span <= 0:
        return 1.0
    raw = span / count
    magnitude = 10 ** math.floor(math.log10(raw or 1))
    scaled = raw / magnitude
    step = 1 if scaled <= 1 else 2 if scaled <= 2 else 2.5 if scaled <= 2.5 else 5 if scaled <= 5 else 10
    return step * magnitude


def _ticks(low: float, high: float) -> list[float]:
    step = _nice_step(high - low, 4)
    out: list[float] = []
    value = math.ceil(low / step) * step
    while value <= high + step * 0.001 and len(out) < 9:
        out.append(value)
        value += step
    return out or [low, high]


# ── Chart SVG ─────────────────────────────────────────────────────────


def _bounds(series: list[dict]) -> tuple[float, float]:
    values = [v for s in series for v in s.get("values", [])]
    if not values:
        return 0.0, 1.0
    low, high = min(values), max(values)
    low = min(low, 0.0)
    if high == low:
        high = low + 1.0
    # Headroom, so the tallest bar is not welded to the top rule.
    return low, high + (high - low) * 0.08


def _axis(low: float, high: float) -> tuple[str, Any]:
    """Gridlines with their labels, plus the value→y mapping they imply."""
    inner_h = PLOT_H - PAD_T - PAD_B

    def y_of(value: float) -> float:
        return PAD_T + inner_h - (value - low) / (high - low) * inner_h

    parts = []
    for tick in _ticks(low, high):
        y = y_of(tick)
        parts.append(
            f'<line x1="{PAD_L}" y1="{y:.1f}" x2="{PLOT_W - PAD_R}" y2="{y:.1f}" '
            f'stroke="{RULE}" stroke-width="1"/>'
        )
        parts.append(
            f'<text x="{PAD_L - 8}" y="{y + 3.5:.1f}" text-anchor="end" '
            f'font-size="10" fill="{INK_50}">{_e(_fmt(tick))}</text>'
        )
    return "".join(parts), y_of


def _category_labels(categories: list[str]) -> str:
    if not categories:
        return ""
    inner_w = PLOT_W - PAD_L - PAD_R
    # Thin the labels rather than overlapping them: twelve months fit, ninety
    # days do not, and rotated text in WeasyPrint is a coin toss.
    stride = max(1, math.ceil(len(categories) / 12))
    parts = []
    for index, label in enumerate(categories):
        if index % stride:
            continue
        x = PAD_L + (inner_w / max(len(categories), 1)) * (index + 0.5)
        parts.append(
            f'<text x="{x:.1f}" y="{PLOT_H - 12}" text-anchor="middle" '
            f'font-size="10" fill="{INK_50}">{_e(label)}</text>'
        )
    return "".join(parts)


def _bars(block: dict) -> str:
    categories = block["categories"]
    series = block["series"]
    if not categories or not series:
        return ""

    low, high = _bounds(series)
    grid, y_of = _axis(low, high)
    inner_w = PLOT_W - PAD_L - PAD_R
    slot = inner_w / len(categories)
    group = slot * 0.66
    width = group / max(len(series), 1)
    zero_y = y_of(0)

    bars = []
    for si, s in enumerate(series):
        colour = SERIES_COLOURS[si % len(SERIES_COLOURS)]
        for ci, value in enumerate(s.get("values", [])):
            x = PAD_L + slot * ci + (slot - group) / 2 + width * si
            y = y_of(value)
            top, height = (y, zero_y - y) if value >= 0 else (zero_y, y - zero_y)
            if height < 1:
                height = 1
            bars.append(
                f'<rect x="{x:.1f}" y="{top:.1f}" width="{max(width - 2, 1):.1f}" '
                f'height="{height:.1f}" rx="2" fill="{colour}"/>'
            )
    return grid + "".join(bars) + _category_labels(categories)


def _line(block: dict, filled: bool) -> str:
    categories = block["categories"]
    series = block["series"]
    if not categories or not series:
        return ""

    low, high = _bounds(series)
    grid, y_of = _axis(low, high)
    inner_w = PLOT_W - PAD_L - PAD_R
    step = inner_w / max(len(categories) - 1, 1)

    drawn = []
    for si, s in enumerate(series):
        colour = SERIES_COLOURS[si % len(SERIES_COLOURS)]
        values = s.get("values", [])
        if not values:
            continue
        points = [(PAD_L + step * i, y_of(v)) for i, v in enumerate(values)]
        path = " ".join(
            ("M" if i == 0 else "L") + f"{x:.1f} {y:.1f}" for i, (x, y) in enumerate(points)
        )
        if filled:
            base = y_of(max(low, 0.0))
            area = (
                path
                + f" L{points[-1][0]:.1f} {base:.1f} L{points[0][0]:.1f} {base:.1f} Z"
            )
            drawn.append(f'<path d="{area}" fill="{colour}" fill-opacity="0.16"/>')
        drawn.append(
            f'<path d="{path}" fill="none" stroke="{colour}" stroke-width="2" '
            'stroke-linejoin="round" stroke-linecap="round"/>'
        )
        # Dots only when they can be told apart; past ~20 they are a rope.
        if len(points) <= 20:
            for x, y in points:
                drawn.append(
                    f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3" fill="#fff" '
                    f'stroke="{colour}" stroke-width="2"/>'
                )
    return grid + "".join(drawn) + _category_labels(categories)


def _donut(block: dict) -> str:
    categories = block["categories"]
    series = block["series"]
    values = series[0].get("values", []) if series else []
    total = sum(v for v in values if v > 0)
    if total <= 0:
        return ""

    cx, cy, outer, inner = 150.0, 130.0, 96.0, 58.0
    angle = -math.pi / 2
    slices = []
    legend = []

    for index, value in enumerate(values):
        if value <= 0:
            continue
        colour = SERIES_COLOURS[index % len(SERIES_COLOURS)]
        sweep = value / total * math.tau
        end = angle + sweep
        large = 1 if sweep > math.pi else 0

        x1, y1 = cx + outer * math.cos(angle), cy + outer * math.sin(angle)
        x2, y2 = cx + outer * math.cos(end), cy + outer * math.sin(end)
        x3, y3 = cx + inner * math.cos(end), cy + inner * math.sin(end)
        x4, y4 = cx + inner * math.cos(angle), cy + inner * math.sin(angle)

        slices.append(
            f'<path d="M{x1:.1f} {y1:.1f} A{outer} {outer} 0 {large} 1 {x2:.1f} {y2:.1f} '
            f'L{x3:.1f} {y3:.1f} A{inner} {inner} 0 {large} 0 {x4:.1f} {y4:.1f} Z" '
            f'fill="{colour}"/>'
        )

        label = categories[index] if index < len(categories) else ""
        share = value / total * 100
        y = 40 + len(legend) * 22
        legend.append(
            f'<rect x="320" y="{y - 9}" width="10" height="10" rx="2" fill="{colour}"/>'
            f'<text x="340" y="{y}" font-size="11" fill="{INK}">{_e(label)}</text>'
            f'<text x="{PLOT_W - PAD_R}" y="{y}" text-anchor="end" font-size="11" '
            f'fill="{INK_50}">%{share:.1f}</text>'
        )
        angle = end

    return "".join(slices) + "".join(legend)


def _legend(block: dict) -> str:
    series = block.get("series", [])
    if block.get("chart") == "donut" or len(series) < 2:
        return ""
    chips = []
    for index, s in enumerate(series):
        colour = SERIES_COLOURS[index % len(SERIES_COLOURS)]
        chips.append(
            f'<span class="lg"><i style="background:{colour}"></i>{_e(s.get("name"))}</span>'
        )
    return f'<div class="legend">{"".join(chips)}</div>'


def chart_svg(block: dict) -> str:
    kind = block.get("chart", "bar")
    if kind == "donut":
        body = _donut(block)
    elif kind == "line":
        body = _line(block, filled=False)
    elif kind == "area":
        body = _line(block, filled=True)
    else:
        body = _bars(block)
    if not body:
        return '<p class="empty">Bu grafik için veri yok.</p>'
    return (
        f'<svg viewBox="0 0 {PLOT_W} {PLOT_H}" width="100%" height="{PLOT_H}" '
        f'xmlns="http://www.w3.org/2000/svg">{body}</svg>'
    )


# ── Blocks → HTML ─────────────────────────────────────────────────────


def _inline(text: str) -> str:
    """``**bold**`` and nothing else, on an escaped string."""
    escaped = _e(text)
    parts = escaped.split("**")
    out = []
    for index, part in enumerate(parts):
        out.append(f"<strong>{part}</strong>" if index % 2 else part)
    return "".join(out)


def _block_html(block: dict) -> str:
    kind = block.get("type")

    if kind == "heading":
        tag = "h3" if block.get("level") == 3 else "h2"
        return f"<{tag}>{_e(block.get('text'))}</{tag}>"

    if kind == "text":
        return f"<p>{_inline(block.get('text', ''))}</p>"

    if kind == "kpi":
        cells = "".join(
            f'<div class="kpi"><span class="kpi__l">{_e(i["label"])}</span>'
            f'<span class="kpi__v">{_e(i["value"])}</span>'
            + (
                f'<span class="kpi__d" style="color:{TONE_COLOURS.get(i["tone"], INK_50)}">'
                f'{_e(i["delta"])}</span>'
                if i.get("delta")
                else ""
            )
            + "</div>"
            for i in block.get("items", [])
        )
        return f'<div class="kpis">{cells}</div>'

    if kind == "chart":
        title = f'<h4>{_e(block["title"])}</h4>' if block.get("title") else ""
        return f'<figure class="chart">{title}{_legend(block)}{chart_svg(block)}</figure>'

    if kind == "table":
        align = block.get("align", [])
        head = "".join(
            f'<th class="{align[i] if i < len(align) else "left"}">{_e(c)}</th>'
            for i, c in enumerate(block.get("columns", []))
        )
        body = "".join(
            "<tr>"
            + "".join(
                f'<td class="{align[i] if i < len(align) else "left"}">{_e(c)}</td>'
                for i, c in enumerate(row)
            )
            + "</tr>"
            for row in block.get("rows", [])
        )
        total = block.get("total")
        foot = (
            "<tfoot><tr>"
            + "".join(
                f'<td class="{align[i] if i < len(align) else "left"}">{_e(c)}</td>'
                for i, c in enumerate(total)
            )
            + "</tr></tfoot>"
            if total
            else ""
        )
        title = f'<h4>{_e(block["title"])}</h4>' if block.get("title") else ""
        return (
            f'{title}<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody>{foot}</table>'
        )

    if kind == "callout":
        colour = TONE_COLOURS.get(block.get("tone", "neutral"), INK_50)
        title = f'<strong>{_e(block["title"])}</strong> ' if block.get("title") else ""
        return (
            f'<div class="callout" style="border-left-color:{colour}">'
            f'{title}{_inline(block.get("text", ""))}</div>'
        )

    if kind == "list":
        tag = "ol" if block.get("ordered") else "ul"
        items = "".join(f"<li>{_inline(i)}</li>" for i in block.get("items", []))
        return f"<{tag}>{items}</{tag}>"

    return ""


STYLESHEET = f"""
@page {{
  size: A4;
  margin: 18mm 16mm 20mm;
  @bottom-left {{
    content: string(company);
    font-family: 'DejaVu Sans', sans-serif;
    font-size: 8pt;
    color: {INK_50};
  }}
  @bottom-right {{
    content: counter(page) " / " counter(pages);
    font-family: 'DejaVu Sans', sans-serif;
    font-size: 8pt;
    color: {INK_50};
  }}
}}

* {{ box-sizing: border-box; }}

body {{
  font-family: 'DejaVu Sans', 'Helvetica', sans-serif;
  font-size: 9.5pt;
  line-height: 1.55;
  color: {INK};
  margin: 0;
}}

.mast {{
  string-set: company attr(data-company);
  border-bottom: 2px solid {DARK};
  padding-bottom: 10px;
  margin-bottom: 20px;
}}

.mast__brand {{
  font-size: 8pt;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: {INK_50};
}}

.mast__title {{ font-size: 19pt; margin: 4px 0 2px; letter-spacing: -0.02em; }}
.mast__sub {{ color: {INK_50}; font-size: 9pt; margin: 0; }}

/* Flexbox, not flex *gap*: WeasyPrint 61 lays flex containers out but drops
   `gap` with "unknown property", so anything relying on it comes out welded
   together. Every gap in this stylesheet is a margin for that reason — the
   meta line read "2026 3. ÇeyrekOluşturulma: 2026-09-24VKN: …" before this. */
.mast__meta {{
  margin-top: 8px;
  font-size: 8.5pt;
  color: {INK_50};
}}

.mast__meta span {{ margin-right: 18px; }}

h2 {{ font-size: 13pt; margin: 22px 0 6px; letter-spacing: -0.015em; }}
h3 {{ font-size: 11pt; margin: 16px 0 4px; }}
h4 {{ font-size: 9.5pt; margin: 14px 0 6px; color: {INK_50}; font-weight: 600; }}
p {{ margin: 0 0 8px; }}
ul, ol {{ margin: 0 0 10px; padding-left: 18px; }}
li {{ margin-bottom: 3px; }}

/* Three across, wrapping. Six equal flex children across 178mm gave each one
   28mm, which is narrower than "1.021.175,46 ₺" and broke the figure over
   three lines — the one thing on the page that must not wrap. */
.kpis {{ margin: 12px 0 14px; }}

.kpi {{
  display: inline-block;
  vertical-align: top;
  width: 31.6%;
  margin: 0 1.5% 8px 0;
  border: 1px solid {RULE};
  border-radius: 8px;
  padding: 9px 11px;
}}

.kpi__l {{ display: block; font-size: 8pt; color: {INK_50}; }}
.kpi__v {{ display: block; font-size: 13pt; letter-spacing: -0.02em; margin-top: 2px; }}
.kpi__d {{ display: block; font-size: 8pt; margin-top: 1px; }}

.chart {{ margin: 12px 0 16px; padding: 0; page-break-inside: avoid; }}
.legend {{ font-size: 8.5pt; color: {INK_50}; margin-bottom: 4px; }}
.legend .lg {{ margin-right: 14px; }}
.legend i {{
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  margin-right: 5px;
}}

table {{
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
  margin: 6px 0 16px;
}}

th, td {{ padding: 5px 7px; border-bottom: 1px solid {RULE}; }}
th {{ color: {INK_50}; font-weight: 600; border-bottom: 1px solid {INK_25}; }}
td.right, th.right {{ text-align: right; font-variant-numeric: tabular-nums; }}
tfoot td {{ font-weight: 700; border-top: 1px solid {INK_25}; border-bottom: none; }}
tr {{ page-break-inside: avoid; }}

.callout {{
  border-left: 3px solid {INK_50};
  background: #f5f7fa;
  padding: 9px 12px;
  border-radius: 0 6px 6px 0;
  margin: 10px 0 14px;
}}

.empty {{ color: {INK_50}; font-style: italic; }}

.foot {{
  margin-top: 26px;
  padding-top: 8px;
  border-top: 1px solid {RULE};
  font-size: 7.5pt;
  color: {INK_50};
}}
"""


def render_html(artifact: dict, company: dict[str, Any]) -> str:
    """The report as a standalone HTML document."""
    name = company.get("name") or "—"
    meta = [f"Oluşturulma: {dt.date.today().isoformat()}"]
    if artifact.get("period"):
        meta.insert(0, f"Dönem: {artifact['period']}")
    if company.get("taxId"):
        meta.append(f"VKN: {company['taxId']}")

    body = "".join(_block_html(b) for b in artifact.get("blocks", []))
    subtitle = (
        f'<p class="mast__sub">{_e(artifact["subtitle"])}</p>'
        if artifact.get("subtitle")
        else ""
    )

    return f"""<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<title>{_e(artifact.get('title'))}</title>
<style>{STYLESHEET}</style></head>
<body>
  <header class="mast" data-company="{_e(name)}">
    <div class="mast__brand">Muhai · {_e(name)}</div>
    <h1 class="mast__title">{_e(artifact.get('title'))}</h1>
    {subtitle}
    <div class="mast__meta">{''.join(f'<span>{_e(m)}</span>' for m in meta)}</div>
  </header>
  {body}
  <p class="foot">Bu rapor Muhai tarafından işletmenin kendi kayıtlarından
  üretilmiştir. Rakamlar kayıtlı veriye dayanır; resmi beyan yerine geçmez.</p>
</body></html>"""


class PdfUnavailable(RuntimeError):
    """WeasyPrint is not installed or cannot load its system libraries."""


def is_available() -> bool:
    """Whether this host can actually produce a PDF.

    Reported by ``/api/agent/capabilities`` so the client can say "PDF yok"
    up front rather than offering a button that 503s. Cheap after the first
    call — the import is cached by ``sys.modules`` either way.
    """
    try:
        import weasyprint  # noqa: F401, PLC0415

        return True
    except Exception:
        return False


def render_pdf(artifact: dict, company: dict[str, Any]) -> bytes:
    """The same document, as PDF bytes.

    Imported inside the function on purpose: WeasyPrint pulls Pango and Cairo
    through cffi at *import* time, so a missing system library would otherwise
    take down the whole API at startup rather than one endpoint at call time.
    """
    try:
        from weasyprint import HTML  # noqa: PLC0415
    except Exception as exc:  # ImportError, OSError from the cffi bindings
        raise PdfUnavailable(str(exc)) from exc

    return HTML(string=render_html(artifact, company)).write_pdf()
