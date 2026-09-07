import { useId, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useReveal } from '../../lib/useReveal.js'

/**
 * Prophet cash-flow forecast: the predicted daily net as a line, with the
 * 80% confidence interval drawn as a band around it.
 *
 * The band is the point of the chart — a forecast without its uncertainty is
 * a guess presented as a fact — so it renders even when it is wide.
 */
export default function ForecastChart({
  points = [],
  height = 240,
  color = 'var(--c-sky)',
  formatValue = (v) => v,
  formatAxis,
  formatDate = (d) => d,
  emptyLabel = '—',
}) {
  const gid = useId().replace(/:/g, '')
  const [ref, inView] = useReveal({ once: true, margin: '-60px' })
  const [hover, setHover] = useState(null)

  const W = 760
  const H = height
  const padLeft = 62
  const padRight = 14
  const padTop = 16
  const padBottom = 28
  const plotH = H - padTop - padBottom
  const plotW = W - padLeft - padRight

  const scale = useMemo(() => {
    if (!points.length) return null
    const lows = points.map((p) => p.yhat_lower)
    const highs = points.map((p) => p.yhat_upper)
    let min = Math.min(...lows, 0)
    let max = Math.max(...highs, 0)
    if (max === min) {
      max += 1
      min -= 1
    }
    const pad = (max - min) * 0.08
    return { min: min - pad, max: max + pad }
  }, [points])

  if (!points.length || !scale) {
    return (
      <div className="chart-empty" style={{ height }}>
        {emptyLabel}
      </div>
    )
  }

  const x = (i) => (points.length === 1 ? padLeft + plotW / 2 : padLeft + (i / (points.length - 1)) * plotW)
  const y = (v) => padTop + plotH - ((v - scale.min) / (scale.max - scale.min)) * plotH

  const TICKS = 4
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => scale.min + ((scale.max - scale.min) / TICKS) * i)
  const axisFormat = formatAxis || formatValue

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.yhat).toFixed(1)}`).join(' ')
  const band = [
    ...points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.yhat_upper).toFixed(1)}`),
    ...points
      .slice()
      .reverse()
      .map((p, i) => `L ${x(points.length - 1 - i).toFixed(1)} ${y(p.yhat_lower).toFixed(1)}`),
    'Z',
  ].join(' ')

  const zeroY = y(0)
  const showZero = scale.min < 0 && scale.max > 0

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((px - padLeft) / plotW) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, idx)))
  }

  const tipLeft = hover != null ? (x(hover) / W) * 100 : 0

  // Label roughly every week so the axis stays readable at 30+ days.
  const labelStep = Math.max(1, Math.round(points.length / 5))

  return (
    <div ref={ref} className="chart-wrap" style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block', overflow: 'visible' }}
        role="img"
      >
        <defs>
          <linearGradient id={`${gid}-band`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={color} stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {ticks.map((tick, i) => (
          <g key={i}>
            <line x1={padLeft} x2={W - padRight} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 6" />
            <text x={padLeft - 10} y={y(tick) + 3.5} textAnchor="end" fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--ink-4)">
              {axisFormat(tick)}
            </text>
          </g>
        ))}

        {showZero && (
          <line x1={padLeft} x2={W - padRight} y1={zeroY} y2={zeroY} stroke="var(--ink-4)" strokeWidth="1.2" />
        )}

        <motion.path
          d={band}
          fill={`url(#${gid}-band)`}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.9, delay: 0.3 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : {}}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />

        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + plotH} stroke="var(--ink-4)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(points[hover].yhat)} r="4.5" fill="var(--surface)" stroke={color} strokeWidth="2.5" />
          </g>
        )}

        {points.map((p, i) =>
          i % labelStep === 0 || i === points.length - 1 ? (
            <text
              key={p.ds}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fontFamily="var(--font-mono)"
              fill={hover === i ? 'var(--ink)' : 'var(--ink-4)'}
            >
              {formatDate(p.ds)}
            </text>
          ) : null,
        )}
      </svg>

      {hover != null && (
        <div className="chart-tip" style={{ left: `${tipLeft}%`, transform: tipLeft > 62 ? 'translate(-108%, 0)' : 'translate(8%, 0)' }}>
          <div className="chart-tip__head">{formatDate(points[hover].ds)}</div>
          <div className="chart-tip__row">
            <span className="chart-tip__swatch" style={{ background: color }} />
            <span className="chart-tip__name">yhat</span>
            <span className="chart-tip__val tnum">{formatValue(points[hover].yhat)}</span>
          </div>
          <div className="chart-tip__range tnum">
            {formatValue(points[hover].yhat_lower)} … {formatValue(points[hover].yhat_upper)}
          </div>
        </div>
      )}
    </div>
  )
}
