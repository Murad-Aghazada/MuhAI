import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber.jsx'
import Sparkline from '../charts/Sparkline.jsx'

/**
 * A headline figure with its trend.
 *
 * Two independent signals, deliberately not conflated:
 *   - the arrow follows the *sign* of the change (did it go up or down?)
 *   - the colour follows `deltaPositive` (is that good or bad?)
 * Expenses falling is a green down-arrow; tax accruing is a red up-arrow.
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  format,
  delta,
  deltaValue,
  deltaPositive = true,
  spark,
  sparkColor,
  index = 0,
}) {
  // Fall back to parsing the label when no numeric delta is supplied.
  const numeric = deltaValue ?? parseFloat(String(delta ?? '').replace(/[^\d.-]/g, ''))
  const rising = Number.isFinite(numeric) ? numeric >= 0 : deltaPositive
  const Arrow = rising ? TrendingUp : TrendingDown

  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.06 * index }}
    >
      <div className="stat-card__top">
        <span className="stat-card__icon">{Icon && <Icon size={19} strokeWidth={2.2} />}</span>
        {spark && <Sparkline data={spark} color={sparkColor || 'var(--c-emerald)'} width={96} height={34} />}
      </div>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value tnum">
        <AnimatedNumber value={value} format={format} />
      </div>
      {delta != null && (
        <div className="stat-card__foot">
          <span className={`delta ${deltaPositive ? 'delta--pos' : 'delta--neg'}`}>
            <Arrow size={13} strokeWidth={2.6} />
            {delta}
          </span>
        </div>
      )}
    </motion.div>
  )
}
