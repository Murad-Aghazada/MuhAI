import { useId, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

/**
 * Dual-series animated area chart (income vs expense).
 * The lines draw themselves in and the fill fades up. Hovering
 * snaps a guideline + dots to the nearest month with a tooltip.
 */
export default function AreaChart({
  data,
  labels = [],
  height = 240,
  colors = ['var(--c-emerald)', 'var(--c-coral)'],
  keys = ['income', 'expense'],
  formatValue = (v) => v,
  seriesNames = [],
}) {
  const gid = useId().replace(/:/g, '')
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [hover, setHover] = useState(null)

  const W = 720
  const H = height
  const padX = 8
  const padTop = 16
  const padBottom = 28

  const all = data.flatMap((d) => keys.map((k) => d[k]))
  const max = Math.max(...all) * 1.12
  const min = 0
  const plotH = H - padTop - padBottom
  const plotW = W - padX * 2

  const x = (i) => padX + (i / (data.length - 1)) * plotW
  const y = (v) => padTop + plotH - ((v - min) / (max - min)) * plotH

  const linePath = (key) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ')

  const areaPath = (key) =>
    `${linePath(key)} L ${x(data.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${x(0).toFixed(1)} ${(
      padTop + plotH
    ).toFixed(1)} Z`

  const gridLines = 4

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((px - padX) / plotW) * (data.length - 1))
    const clamped = Math.max(0, Math.min(data.length - 1, idx))
    setHover(clamped)
  }

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {keys.map((k, ki) => (
            <linearGradient key={k} id={`${gid}-fill-${ki}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[ki]} stopOpacity="0.22" />
              <stop offset="100%" stopColor={colors[ki]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* gridlines */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = padTop + (plotH / gridLines) * i
          return (
            <line
              key={i}
              x1={padX}
              x2={W - padX}
              y1={gy}
              y2={gy}
              stroke="var(--line)"
              strokeWidth="1"
              strokeDasharray={i === gridLines ? '0' : '2 5'}
            />
          )
        })}

        {/* areas + lines */}
        {keys.map((k, ki) => (
          <g key={k}>
            <motion.path
              d={areaPath(k)}
              fill={`url(#${gid}-fill-${ki})`}
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.5 + ki * 0.1 }}
            />
            <motion.path
              d={linePath(k)}
              fill="none"
              stroke={colors[ki]}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: ki * 0.15 }}
            />
          </g>
        ))}

        {/* hover guideline + dots */}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + plotH} stroke="var(--ink-4)" strokeWidth="1" strokeDasharray="3 3" />
            {keys.map((k, ki) => (
              <circle key={k} cx={x(hover)} cy={y(data[hover][k])} r="4.5" fill="var(--surface)" stroke={colors[ki]} strokeWidth="2.5" />
            ))}
          </g>
        )}

        {/* labels */}
        {labels.map((lab, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill={hover === i ? 'var(--ink)' : 'var(--ink-4)'}
          >
            {lab}
          </text>
        ))}
      </svg>

      {/* tooltip */}
      {hover != null && (
        <div
          style={{
            position: 'relative',
            marginTop: -8,
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            fontSize: 12,
          }}
        >
          {keys.map((k, ki) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[ki] }} />
              {seriesNames[ki] || k}:{' '}
              <strong className="tnum" style={{ color: 'var(--ink)' }}>
                {formatValue(data[hover][k])}
              </strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
