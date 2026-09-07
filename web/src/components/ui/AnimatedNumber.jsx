import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

/**
 * Counts up to `value`, ideally when scrolled into view.
 *
 * The count-up is decoration; the number is the point. IntersectionObserver
 * is unreliable in embedded/iframed contexts (it can simply never fire), and
 * a KPI frozen at zero is far worse than one that animates a beat early — so
 * a fallback timer starts the animation regardless, and the value is always
 * settled exactly rather than left at the last interpolated frame.
 *
 * `prefers-reduced-motion` skips the animation entirely.
 */
const START_FALLBACK_MS = 400

export default function AnimatedNumber({ value, format = (n) => Math.round(n).toString(), duration = 1.2, className }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [started, setStarted] = useState(false)
  const [display, setDisplay] = useState(0)
  const rafRef = useRef()

  useEffect(() => {
    if (inView) {
      setStarted(true)
      return undefined
    }
    const timer = setTimeout(() => setStarted(true), START_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [inView])

  useEffect(() => {
    if (!started) return undefined

    const target = Number.isFinite(value) ? value : 0

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || duration <= 0) {
      setDisplay(target)
      return undefined
    }

    const start = performance.now()
    const from = 0
    const ease = (t) => 1 - Math.pow(1 - t, 3) // easeOutCubic

    const tick = (now) => {
      const p = Math.min((now - start) / 1000 / duration, 1)
      // Land on the exact target rather than the eased approximation.
      setDisplay(p >= 1 ? target : from + (target - from) * ease(p))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafRef.current)
  }, [started, value, duration])

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  )
}
