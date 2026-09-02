import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber.jsx'
import Sparkline from '../charts/Sparkline.jsx'

export default function StatCard({ icon: Icon, label, value, format, delta, deltaPositive = true, spark, sparkColor, index = 0 }) {
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
            {deltaPositive ? <TrendingUp size={13} strokeWidth={2.6} /> : <TrendingDown size={13} strokeWidth={2.6} />}
            {delta}
          </span>
        </div>
      )}
    </motion.div>
  )
}
