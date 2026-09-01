import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

/**
 * Counts up to `value` when scrolled into view.
 * `format` receives the current numeric value and returns a string.
 */
export default function AnimatedNumber({ value, format = (n) => Math.round(n).toString(), duration = 1.2, className }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [display, setDisplay] = useState(0)
  const rafRef = useRef()

  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    const from = 0
    const to = value
    const ease = (t) => 1 - Math.pow(1 - t, 3) // easeOutCubic

    const tick = (now) => {
      const elapsed = (now - start) / 1000
      const p = Math.min(elapsed / duration, 1)
      setDisplay(from + (to - from) * ease(p))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [inView, value, duration])

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  )
}
