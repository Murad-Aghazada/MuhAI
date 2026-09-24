/* ============================================================
   The agent's chart.

   One component for all four kinds, because the agent decides which
   one it wants at answer time and a switch over four bespoke chart
   components would make three of them dead weight in every bundle.

   The geometry is the same arithmetic `report_pdf.py` does on the
   server — same viewBox, same padding, same tick rule. That is not
   duplication for its own sake: the report pane and the PDF have to
   be the same drawing, and the only way two renderers agree is if
   they compute the same numbers from the same blocks. If you change
   a constant here, change it there in the same commit.

   Colours come from `console.css`'s categorical ramp (`--d1`…`--d8`),
   which is the landing page's own. A chart the agent draws must not
   be recognisable as "the AI one".
   ============================================================ */
import { useState } from 'react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { formatNumber } from '../../lib/format.js'

const W = 720
const H = 260
const PAD = { l: 62, r: 14, t: 14, b: 34 }

const RAMP = ['--d1', '--d2', '--d3', '--d4', '--d5', '--d6', '--d7', '--d8']
const colourOf = (index) => `var(${RAMP[index % RAMP.length]})`

/* A "nice" axis step: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(span, count) {
  if (span <= 0) return 1
  const raw = span / count
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1))
  const scaled = raw / magnitude
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10
  return step * magnitude
}

function ticksFor(low, high) {
  const step = niceStep(high - low, 4)
  const out = []
  for (let v = Math.ceil(low / step) * step; v <= high + step * 0.001 && out.length < 9; v += step) {
    out.push(v)
  }
  return out.length ? out : [low, high]
}

/* Axis labels only. A nine-digit figure has no room on a 62px gutter and
   nobody reads the last three digits of it anyway. */
function axisLabel(value) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1000) return `${Math.round(value / 1000)}B`
  return String(Math.round(value))
}

function bounds(series) {
  const values = series.flatMap((s) => s.values || [])
  if (!values.length) return [0, 1]
  const low = Math.min(0, ...values)
  let high = Math.max(...values)
  if (high === low) high = low + 1
  return [low, high + (high - low) * 0.08]
}

/* ---------------------------------------------------- cartesian -- */

function Grid({ ticks, yOf }) {
  return (
    <g>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.l}
            y1={yOf(tick)}
            x2={W - PAD.r}
            y2={yOf(tick)}
            stroke="var(--ck-grid)"
            strokeWidth="1"
            shapeRendering="crispEdges"
          />
          <text x={PAD.l - 8} y={yOf(tick) + 3.5} textAnchor="end" className="ck-axis-text">
            {axisLabel(tick)}
          </text>
        </g>
      ))}
    </g>
  )
}

function CategoryAxis({ categories }) {
  const inner = W - PAD.l - PAD.r
  // Thin rather than overlap: twelve months fit across 720 units, ninety
  // days do not, and rotated axis type is unreadable at this size.
  const stride = Math.max(1, Math.ceil(categories.length / 12))
  return (
    <g>
      {categories.map((label, index) =>
        index % stride ? null : (
          <text
            key={`${label}-${index}`}
            x={PAD.l + (inner / categories.length) * (index + 0.5)}
            y={H - 12}
            textAnchor="middle"
            className="ck-axis-text"
          >
            {label}
          </text>
        ),
      )}
    </g>
  )
}

function Bars({ categories, series, yOf }) {
  const inner = W - PAD.l - PAD.r
  const slot = inner / categories.length
  const group = slot * 0.66
  const width = group / Math.max(series.length, 1)
  const zero = yOf(0)

  return (
    <g>
      {series.map((s, si) =>
        (s.values || []).map((value, ci) => {
          const x = PAD.l + slot * ci + (slot - group) / 2 + width * si
          const y = yOf(value)
          const top = value >= 0 ? y : zero
          const height = Math.max(Math.abs(zero - y), 1)
          return (
            <rect
              key={`${si}-${ci}`}
              x={x}
              y={top}
              width={Math.max(width - 2, 1)}
              height={height}
              rx="2"
              fill={colourOf(si)}
            />
          )
        }),
      )}
    </g>
  )
}

function Lines({ categories, series, yOf, low, filled }) {
  const inner = W - PAD.l - PAD.r
  const step = inner / Math.max(categories.length - 1, 1)
  const base = yOf(Math.max(low, 0))

  return (
    <g>
      {series.map((s, si) => {
        const values = s.values || []
        if (!values.length) return null
        const points = values.map((v, i) => [PAD.l + step * i, yOf(v)])
        const path = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
        return (
          <g key={si}>
            {filled && (
              <path
                d={`${path} L${points[points.length - 1][0]} ${base} L${points[0][0]} ${base} Z`}
                fill={colourOf(si)}
                fillOpacity="0.16"
              />
            )}
            <path
              d={path}
              fill="none"
              stroke={colourOf(si)}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.length <= 20 &&
              points.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="3" fill="var(--card)" stroke={colourOf(si)} strokeWidth="2" />
              ))}
          </g>
        )
      })}
    </g>
  )
}

/* -------------------------------------------------------- donut -- */

function Donut({ categories, series }) {
  const values = series[0]?.values || []
  const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0)
  if (total <= 0) return null

  const cx = 150
  const cy = 130
  const outer = 96
  const inner = 58
  let angle = -Math.PI / 2

  const slices = values.map((value, index) => {
    if (value <= 0) return null
    const sweep = (value / total) * Math.PI * 2
    const end = angle + sweep
    const large = sweep > Math.PI ? 1 : 0
    const p = (radius, a) => [cx + radius * Math.cos(a), cy + radius * Math.sin(a)]
    const [x1, y1] = p(outer, angle)
    const [x2, y2] = p(outer, end)
    const [x3, y3] = p(inner, end)
    const [x4, y4] = p(inner, angle)
    angle = end
    return (
      <path
        key={index}
        d={`M${x1} ${y1} A${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`}
        fill={colourOf(index)}
      />
    )
  })

  // No figure in the hole. The model passes shares as often as amounts, and a
  // ring of percentages with "100" in the middle says nothing — it is the one
  // number on the chart that is guaranteed to be uninformative. The PDF draws
  // no centre label either, and the two must match.
  return (
    <g>
      {slices}
      {values.map((value, index) => {
        if (value <= 0) return null
        const y = 40 + index * 22
        return (
          <g key={`lg-${index}`}>
            <rect x="320" y={y - 9} width="10" height="10" rx="2" fill={colourOf(index)} />
            <text x="340" y={y} className="agent-donut__label">
              {categories[index] || ''}
            </text>
            <text x={W - PAD.r} y={y} textAnchor="end" className="agent-donut__share">
              %{((value / total) * 100).toFixed(1)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/* ---------------------------------------------------------- top -- */

export default function AgentChart({ block }) {
  const { lang } = useLang()
  const [hover, setHover] = useState(null)

  const categories = block.categories || []
  const series = (block.series || []).filter((s) => (s.values || []).length)
  const kind = block.chart || 'bar'

  if (!categories.length || !series.length) {
    return <div className="agent-chart__empty">Bu grafik için veri yok.</div>
  }

  const [low, high] = bounds(series)
  const innerH = H - PAD.t - PAD.b
  const yOf = (value) => PAD.t + innerH - ((value - low) / (high - low)) * innerH
  const isDonut = kind === 'donut'

  // The readout follows the pointer by category index, not by pixel, so a
  // hover reports the bar it is over rather than the nearest edge.
  const onMove = (event) => {
    if (isDonut) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    const x = ratio * W
    if (x < PAD.l || x > W - PAD.r) return setHover(null)
    const inner = W - PAD.l - PAD.r
    const index = Math.min(
      categories.length - 1,
      Math.max(0, Math.floor(((x - PAD.l) / inner) * categories.length)),
    )
    setHover(index)
  }

  return (
    <div className="agent-chart">
      {block.title && <div className="agent-chart__title">{block.title}</div>}

      {!isDonut && series.length > 1 && (
        <div className="agent-chart__legend">
          {series.map((s, index) => (
            <span key={s.name || index}>
              <i style={{ background: colourOf(index) }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <div className="agent-chart__plot" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="ck__svg" role="img" aria-label={block.title || 'grafik'}>
          {isDonut ? (
            <Donut categories={categories} series={series} />
          ) : (
            <>
              <Grid ticks={ticksFor(low, high)} yOf={yOf} />
              {kind === 'bar' ? (
                <Bars categories={categories} series={series} yOf={yOf} />
              ) : (
                <Lines
                  categories={categories}
                  series={series}
                  yOf={yOf}
                  low={low}
                  filled={kind === 'area'}
                />
              )}
              <CategoryAxis categories={categories} />
              {hover != null && (
                <line
                  x1={PAD.l + ((W - PAD.l - PAD.r) / categories.length) * (hover + 0.5)}
                  y1={PAD.t}
                  x2={PAD.l + ((W - PAD.l - PAD.r) / categories.length) * (hover + 0.5)}
                  y2={H - PAD.b}
                  stroke="var(--ck-cross)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              )}
            </>
          )}
        </svg>

        {hover != null && !isDonut && (
          <div
            className="agent-chart__tip"
            style={{ left: `${((hover + 0.5) / categories.length) * 100}%` }}
          >
            <div className="agent-chart__tip-head">{categories[hover]}</div>
            {series.map((s, index) => (
              <div className="agent-chart__tip-row" key={s.name || index}>
                <i style={{ background: colourOf(index) }} />
                <span>{s.name}</span>
                <b className="tnum">{formatNumber(s.values[hover] ?? 0, lang)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
