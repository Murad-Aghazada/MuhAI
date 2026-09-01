import { useId, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

/** Tiny animated sparkline used inside stat cards. */
export default function Sparkline({ data, color = 'var(--c-emerald)', width = 120, height = 38 }) {
  const gid = useId().replace(/:/g, '')
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const x = (i) => (i / (data.length - 1)) * width
  const y = (v) => height - 4 - ((v - min) / range) * (height - 8)

  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L ${width} ${height} L 0 ${height} Z`

  return (
    <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${gid}-sp`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#${gid}-sp)`} initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.6, delay: 0.4 }} />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={inView ? { pathLength: 1 } : {}}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  )
}
