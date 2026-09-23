import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  CircleCheck,
  Factory,
  Gauge,
  Hammer,
  Landmark,
  LayoutDashboard,
  Layers,
  LineChart,
  ListChecks,
  Menu,
  MessagesSquare,
  Percent,
  Plus,
  Recycle,
  ScanLine,
  Server,
  Share2,
  Tag,
  Tags,
  Target,
  TriangleAlert,
  Truck,
  Wheat,
  X,
} from 'lucide-react'
import { useLang } from '../i18n/LanguageContext.jsx'
/* The arrow, the chip button, the eyebrow pill and the flags live in
   `components/ui/lp.jsx` now: the auth screens render the same design
   language, and a second copy of the chip button would drift from this
   one the first time either was touched. */
import { Arrow, Btn, Eyebrow, LangFlags } from '../components/ui/lp.jsx'

/* ============================================================
   Reveal.

   One IntersectionObserver for the whole page, opening each
   element once. Framer's `whileInView` is not used anywhere here
   (N6): every revealed element starts at `opacity: 0`, so a
   trigger that never fires renders a blank section rather than an
   unanimated one. Everything opens immediately when the API is
   missing.

   The open state lives in React, not in a class the observer
   writes onto the node. It used to be `el.classList.add('is-in')`,
   and React blew it away: `Rv` renders `className`, so the next
   render of a parent — opening an FAQ answer, switching a tab —
   reset the attribute to the string in the JSX and dropped
   `is-in` with it. The element faded back out and never returned,
   because the observer had already unobserved it. Anything React
   renders has to be owned by React.
   ============================================================ */
const REVEAL_MARGIN = { rootMargin: '0px 0px -12% 0px', threshold: 0.01 }
let revealIO = null
const revealJobs = new WeakMap()

function onReveal(el, fire) {
  if (typeof IntersectionObserver === 'undefined') {
    fire()
    return undefined
  }
  if (!revealIO) {
    revealIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        const job = revealJobs.get(e.target)
        revealIO.unobserve(e.target)
        revealJobs.delete(e.target)
        job?.()
      })
    }, REVEAL_MARGIN)
  }
  revealJobs.set(el, fire)
  revealIO.observe(el)
  return () => {
    revealIO.unobserve(el)
    revealJobs.delete(el)
  }
}

/* ============================================================
   Scroll progress.

   Writes a 0 → 1 number into a CSS custom property on the element
   instead of into React state, so the scroll handler never causes
   a render and the transforms stay on the compositor. Custom
   properties inherit, so descendants can read the same `--p`.
   ============================================================ */
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)
const smooth = (n) => n * n * (3 - 2 * n)

function useScrollVar(ref, map, name = '--p') {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return

    // Honour the OS setting: with motion reduced the page renders
    // in its settled state and never moves on scroll.
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      el.style.setProperty(name, '1')
      return
    }

    let raf = 0
    const write = () => {
      raf = 0
      el.style.setProperty(name, map(el.getBoundingClientRect(), window.innerHeight).toFixed(4))
    }
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(write)
    }
    write()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref, map, name])
}

/* The hero stage settles over roughly the first two thirds of a
   viewport of scrolling — measured against the reference, which
   is fully flat by 700px at a 900px viewport. */
const heroMap = (rect, vh) => smooth(clamp01((vh * 0.8 - rect.top) / (vh * 0.95)))

/* The statement lights up while its section crosses the viewport. */
const sayMap = (rect, vh) => clamp01((vh * 0.6 - rect.top) / (vh * 0.95))

/* ============================================================
   Nav tone.

   The reference's nav pill is white over the light bands and
   #35363B over the dark ones, switching at the band edge rather
   than at a scroll offset. This reads the dark bands' live rects
   against the pill's own centre line, so inserting or resizing a
   section cannot desynchronise it. Three or four rects per frame
   is cheap; the read is rAF-throttled and never touches state
   unless the answer actually changed.
   ============================================================ */
function useNavTone(rootRef, setDark) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof window === 'undefined') return
    const bands = [...root.querySelectorAll('.lp-dark')]
    if (!bands.length) return

    let raf = 0
    let last = null
    const line = 40 // the pill's centre: 8px offset + 56/2, rounded up
    const read = () => {
      raf = 0
      const over = bands.some((b) => {
        const r = b.getBoundingClientRect()
        return r.top <= line && r.bottom >= line
      })
      if (over !== last) {
        last = over
        setDark(over)
      }
    }
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [rootRef, setDark])
}

/* ---------- small shared pieces ---------- */

function Rv({ as: As = 'div', y, delay = 0, now = false, className = '', children, ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (shown) return undefined
    if (now) {
      setShown(true)
      return undefined
    }
    const el = ref.current
    if (!el) return undefined

    /* Already on screen the moment it mounts — the hero, or a panel
       swapped in under the reader on a tab click. Open it now rather
       than waiting a frame for the observer to say what is already
       true. An element that starts translated off the top (the nav,
       at `y={-56}`) measures as off-screen and never intersects, so
       it takes `now` instead — that is what this check cannot do. */
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight && r.bottom > 0) {
      setShown(true)
      return undefined
    }
    return onReveal(el, () => setShown(true))
  }, [shown, now])

  const style = { ...(rest.style || {}) }
  if (delay) style['--rv-d'] = delay + 'ms'
  if (y != null) style['--rv-y'] = y + 'px'

  return (
    <As {...rest} ref={ref} style={style} className={'lp-rv ' + className + (shown ? ' is-in' : '')}>
      {children}
    </As>
  )
}

/* ============================================================
   Count-up.

   A figure that is already at its final value when it scrolls into
   frame is just text; the reference lets its numbers and its ring
   arrive. Both run once, on the same observer the reveal uses, and
   both respect `prefers-reduced-motion` — under it the value is
   simply there, never a frozen zero.
   ============================================================ */
const still = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useInOnce() {
  const ref = useRef(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (on) return undefined
    const el = ref.current
    if (!el) return undefined
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight && r.bottom > 0) {
      setOn(true)
      return undefined
    }
    return onReveal(el, () => setOn(true))
  }, [on])

  return [ref, on]
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3)

function useCount(to, on, ms = 1100) {
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!on) return undefined
    if (still()) {
      setN(to)
      return undefined
    }
    let raf = 0
    const t0 = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms)
      setN(to * easeOut(t))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, on, ms])

  return n
}

/* Turkish grouping in both languages: these are lira figures on a
   Turkish invoice, and ₺1,200 would be wrong on either side. */
const tl = new Intl.NumberFormat('tr-TR')

function Count({ to, on, pre = '', ms }) {
  const n = useCount(to, on, ms)
  /* tabular figures, or the digits change width as they climb and
     the card twitches all the way up */
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {pre}
      {tl.format(Math.round(n))}
    </span>
  )
}

/* ---------- the dashboard mock ----------
   Hand-drawn in CSS and SVG rather than screenshotted: a capture
   goes stale the moment the console changes, and it cannot carry
   the two languages. */

const SPARK = [34, 31, 38, 36, 42, 39, 47, 44, 52, 58, 55, 64, 71, 68, 76, 84]

function Spark() {
  const w = 100
  const h = 100
  const max = Math.max(...SPARK)
  const min = Math.min(...SPARK)
  const pts = SPARK.map((v, i) => {
    const x = (i / (SPARK.length - 1)) * w
    const y = h - ((v - min) / (max - min)) * (h - 12) - 6
    return [x, y]
  })
  const d = pts
    .map(([x, y], i) => {
      if (i === 0) return 'M' + x + ' ' + y
      const [px, py] = pts[i - 1]
      const cx = (px + x) / 2
      return 'C' + cx + ' ' + py + ' ' + cx + ' ' + y + ' ' + x + ' ' + y
    })
    .join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {SPARK.map((_, i) => (
        <line
          key={i}
          x1={(i / (SPARK.length - 1)) * w}
          y1="0"
          x2={(i / (SPARK.length - 1)) * w}
          y2="100"
          stroke="rgba(36,36,38,.1)"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={d} fill="none" stroke="#242426" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* Start poses for the four cards that assemble into the grid.
   Measured off the reference, then applied as CSS variables that
   the stylesheet interpolates against `--p`. */
const POSE = [
  { tx: -55, ty: -55, rx: -12.1, ry: 2.2, rz: -8.4, sc: 0.9 },
  { tx: -74, ty: -172, rx: -5.6, ry: 8.8, rz: -10.7, sc: 0.9 },
  { tx: 122, ty: -333, rx: -0.9, ry: -9.1, rz: 10.2, sc: 1.1 },
  { tx: 36, ty: -24, rx: 0, ry: 0, rz: 3, sc: 1.1 },
]

const poseVars = (i, live) =>
  live
    ? { '--tx': POSE[i].tx, '--ty': POSE[i].ty, '--rx': POSE[i].rx, '--ry': POSE[i].ry, '--rz': POSE[i].rz, '--sc': POSE[i].sc }
    : undefined

const BRK = ['#8b86c9', '#6aa5e0', '#5aa9a2', '#9db45f', '#e2c24f', '#c9764a']

function AppMock({ en, live = false }) {
  const rows = en
    ? [
        ['Invoices & VAT', '48%', '₺13.200'],
        ['Services', '32%', '₺8.800'],
        ['Product sales', '12%', '₺3.300'],
        ['Other income', '5%', '₺1.400'],
        ['Refunds', '3%', '₺800'],
      ]
    : [
        ['Fatura & KDV', '%48', '₺13.200'],
        ['Hizmet geliri', '%32', '₺8.800'],
        ['Ürün satışı', '%12', '₺3.300'],
        ['Diğer gelir', '%5', '₺1.400'],
        ['İadeler', '%3', '₺800'],
      ]
  return (
    <div className="lp-app">
      <div className="lp-app__rail" aria-hidden="true">
        <i className="on">
          <Boxes />
        </i>
        <i>
          <LineChart />
        </i>
        <i>
          <ScanLine />
        </i>
        <i>
          <TriangleAlert />
        </i>
        <span className="sp" />
        <span className="lp-app__me" />
      </div>

      <div className="lp-app__main">
        <div className="lp-app__bar">
          <div>
            <div className="lp-app__ttl">{en ? 'Projected cash' : 'Nakit tahmini'}</div>
            <div className="lp-app__sub">{en ? 'No negative days expected' : 'Eksiye düşen gün beklenmiyor'}</div>
          </div>
          <span className="lp-app__pick">
            {en ? 'Next 30 days' : 'Önümüzdeki 30 gün'}
            <Plus style={{ width: 13, height: 13, opacity: 0.4 }} />
          </span>
          <span className="lp-app__plus" aria-hidden="true">
            <Plus />
          </span>
        </div>

        <div className="lp-app__grid">
          <div className="lp-hcard lp-hcard--tall" style={poseVars(0, live)}>
            <div className="lp-panel">
              <div className="lp-panel__top">
                <div>
                  <div className="lp-panel__k">{en ? 'Income' : 'Gelir'}</div>
                </div>
                <span className="lp-tag lp-tag--dark" style={{ marginLeft: 'auto' }}>
                  +18%
                </span>
              </div>
              <div className="lp-panel__big">
                <span>₺</span>27.500
              </div>
              <div className="lp-spark">
                <Spark />
                <div className="lp-spark__x">
                  <span>1 {en ? 'Dec' : 'Ara'}</span>
                  <span>14 {en ? 'Dec' : 'Ara'}</span>
                  <span>28 {en ? 'Dec' : 'Ara'}</span>
                </div>
              </div>
              <div className="lp-panel__foot" style={{ paddingTop: 14 }}>
                <div className="lp-panel__cell">
                  <b>₺7.200</b>
                  <span>{en ? 'Safe buffer' : 'Güvenli bakiye'}</span>
                </div>
                <div className="lp-panel__cell">
                  <b>₺1.380</b>
                  <span>{en ? 'At risk' : 'Riskli'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lp-hcard" style={poseVars(1, live)}>
            <div className="lp-panel">
              <div className="lp-panel__top">
                <div>
                  <div className="lp-panel__k">{en ? 'Liquidity' : 'Likidite'}</div>
                  <div className="lp-panel__d">{en ? 'Safe cash buffer' : 'Güvenli nakit payı'}</div>
                </div>
                <span className="lp-tag lp-tag--ok" style={{ marginLeft: 'auto' }}>
                  +12%
                </span>
              </div>
              <div className="lp-panel__big" style={{ marginTop: 'auto' }}>
                82<small>%</small>
              </div>
            </div>
          </div>

          <div className="lp-hcard" style={poseVars(2, live)}>
            <div className="lp-panel">
              <div className="lp-panel__top">
                <div>
                  <div className="lp-panel__k">{en ? 'Collection' : 'Tahsilat'}</div>
                </div>
                <span className="lp-tag lp-tag--ok" style={{ marginLeft: 'auto' }}>
                  +6%
                </span>
              </div>
              <div className="lp-days">
                <i className="on">
                  <b>1</b>
                  {en ? 'Mon' : 'Pzt'}
                </i>
                <i>
                  <b>2</b>
                  {en ? 'Tue' : 'Sal'}
                </i>
                <i>
                  <b>3</b>
                  {en ? 'Wed' : 'Çar'}
                </i>
              </div>
              <div className="lp-panel__big" style={{ marginTop: 'auto' }}>
                96<small>%</small>
              </div>
            </div>
          </div>

          <div className="lp-hcard lp-hcard--wide" style={poseVars(3, live)}>
            <div className="lp-panel">
              <div className="lp-panel__top">
                <div>
                  <div className="lp-panel__k">{en ? 'Income sources' : 'Gelir kaynakları'}</div>
                  <div className="lp-panel__d">{en ? 'Overview' : 'Genel bakış'}</div>
                </div>
                <span className="lp-tag" style={{ marginLeft: 'auto' }}>
                  Q4 2026
                </span>
              </div>
              <div className="lp-bars" aria-hidden="true">
                {[48, 32, 12, 5, 3].map((n, i) => (
                  <i key={i} style={{ flex: n, background: BRK[i] }} />
                ))}
              </div>
              <div className="lp-brk">
                {rows.map(([k, p, v]) => (
                  <div className="lp-brk__row" key={k}>
                    <i style={{ background: BRK[rows.findIndex((r) => r[0] === k)] }} />
                    <span>{k}</span>
                    <em>{p}</em>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- slab visuals ----------
   Small floating panels that sit on the mesh half of each slab. */

function Float({ className = '', style, children }) {
  return (
    <div
      className={'lp-panel ' + className}
      style={{ boxShadow: '0 2px 4px rgba(36,36,38,.05), 0 16px 40px rgba(36,36,38,.12)', ...style }}
    >
      {children}
    </div>
  )
}

function ReadMock({ en }) {
  const f = en
    ? [['Vendor', 'Teknopark Gayrimenkul A.Ş.'], ['Net', '₺12.350'], ['VAT', '₺2.470'], ['Total', '₺14.820']]
    : [['Satıcı', 'Teknopark Gayrimenkul A.Ş.'], ['Matrah', '₺12.350'], ['KDV', '₺2.470'], ['Toplam', '₺14.820']]
  return (
    <Float>
      <div className="lp-panel__top">
        <div className="lp-panel__k">{en ? 'Read fields' : 'Okunan alanlar'}</div>
        <span className="lp-tag lp-tag--ok" style={{ marginLeft: 'auto' }}>
          0,91
        </span>
      </div>
      <div className="lp-brk" style={{ paddingTop: 14 }}>
        {f.map(([k, v]) => (
          <div className="lp-brk__row" key={k}>
            <span style={{ color: 'var(--ink-50)' }}>{k}</span>
            <b style={{ marginLeft: 'auto', minWidth: 0 }}>{v}</b>
          </div>
        ))}
      </div>
    </Float>
  )
}

function TaxMock({ en }) {
  const r = en
    ? [['VAT return', '26 Dec', 'ok'], ['Withholding', '26 Dec', 'ok'], ['Social security', '31 Dec', 'warn']]
    : [['KDV beyannamesi', '26 Ara', 'ok'], ['Muhtasar', '26 Ara', 'ok'], ['SGK bildirgesi', '31 Ara', 'warn']]
  return (
    <Float>
      <div className="lp-panel__top">
        <div className="lp-panel__k">{en ? 'Filing calendar' : 'Beyan takvimi'}</div>
        <span className="lp-tag" style={{ marginLeft: 'auto' }}>
          2026
        </span>
      </div>
      <div className="lp-brk" style={{ paddingTop: 14 }}>
        {r.map(([k, d, tone]) => (
          <div className="lp-brk__row" key={k}>
            <span>{k}</span>
            <span className={'lp-tag lp-tag--' + tone} style={{ marginLeft: 'auto' }}>
              {d}
            </span>
          </div>
        ))}
      </div>
    </Float>
  )
}

function CashMock({ en }) {
  return (
    <Float>
      <div className="lp-panel__top">
        <div className="lp-panel__k">{en ? '30-day forecast' : '30 günlük tahmin'}</div>
        <span className="lp-tag lp-tag--lime" style={{ marginLeft: 'auto' }}>
          Prophet
        </span>
      </div>
      <div className="lp-spark" style={{ height: 130, flex: 'none' }}>
        <Spark />
      </div>
      <div className="lp-panel__foot" style={{ paddingTop: 14 }}>
        <div className="lp-panel__cell">
          <b>₺41.900</b>
          <span>{en ? 'Projected' : 'Beklenen'}</span>
        </div>
        <div className="lp-panel__cell">
          <b>18 {en ? 'Dec' : 'Ara'}</b>
          <span>{en ? 'Tightest day' : 'En dar gün'}</span>
        </div>
      </div>
    </Float>
  )
}

function BankMock({ en }) {
  const r = en
    ? [['Teknopark A.Ş.', '₺14.820', '100%', 'ok'], ['Mavi Lojistik', '₺6.400', '95%', 'ok'], ['Unmatched', '₺2.150', '—', 'warn']]
    : [['Teknopark A.Ş.', '₺14.820', '%100', 'ok'], ['Mavi Lojistik', '₺6.400', '%95', 'ok'], ['Eşleşmeyen', '₺2.150', '—', 'warn']]
  return (
    <Float>
      <div className="lp-panel__top">
        <div className="lp-panel__k">{en ? 'Statement match' : 'Ekstre eşleşmesi'}</div>
        <span className="lp-tag" style={{ marginLeft: 'auto' }}>
          CSV
        </span>
      </div>
      <div className="lp-brk" style={{ paddingTop: 14 }}>
        {r.map(([k, v, p, tone]) => (
          <div className="lp-brk__row" key={k}>
            <span>{k}</span>
            <b style={{ marginLeft: 'auto', minWidth: 0 }}>{v}</b>
            <span className={'lp-tag lp-tag--' + tone}>{p}</span>
          </div>
        ))}
      </div>
    </Float>
  )
}

const SLAB_ART = [ReadMock, TaxMock, CashMock, BankMock]
const SLAB_ICON = [ScanLine, Percent, LineChart, Landmark]
/* The reference sets its feature slabs on out-of-focus photographs,
   not on flat CSS meshes — that depth is most of why its slabs read
   as designed rather than generated. These are Unsplash gradients
   (see public/img/README.md); they carry no claim, they are texture. */
const SLAB_ART_BG = ['/img/art-1.jpg', '/img/art-2.jpg', '/img/art-3.jpg', '/img/art-4.jpg']

/* ---------- bento visuals ---------- */

function CatsMock({ en }) {
  const c = en
    ? ['Utilities', 'Software', 'Rent', 'Taxes & fees', 'Payroll', 'Income']
    : ['Fatura', 'Yazılım', 'Kira', 'Vergi & harç', 'Bordro', 'Gelir']
  /* [left offset %, rotation deg]. A straight column with random
     left offsets read as a layout accident; the reference tilts
     them so the scatter is legibly on purpose. */
  const lay = [[22, -7], [2, 4], [38, -5], [8, 6], [30, -4], [14, 5]]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', paddingBottom: 22 }}>
      {c.map((x, i) => (
        <span
          key={x}
          className="lp-pill"
          style={{ '--off': lay[i][0] + '%', transform: `rotate(${lay[i][1]}deg)` }}
        >
          {x}
        </span>
      ))}
    </div>
  )
}

function SyncMock({ en }) {
  const [ref, on] = useInOnce()
  return (
    <div ref={ref} style={{ width: '100%', paddingBottom: 24 }}>
      <Float style={{ borderColor: 'rgba(36,36,38,.1)' }}>
        <div className="lp-panel__top">
          <span className="lp-tag lp-tag--ok">{en ? 'Incoming' : 'Gelen'}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-50)' }}>
            {en ? '1 min ago' : '1 dk önce'}
          </span>
        </div>
        <div className="lp-panel__big" style={{ paddingTop: 10 }}>
          <span>+₺</span>
          <Count to={14820} on={on} />
        </div>
        <div style={{ height: 1, background: 'var(--ink-07)', marginTop: 12 }} />
        <div style={{ fontSize: 13, color: 'var(--ink-50)', paddingTop: 10 }}>
          {en ? 'Matched to invoice #002-12' : '#002-12 faturasıyla eşleşti'}
        </div>
      </Float>
    </div>
  )
}

function ScoreMock({ en }) {
  const [ref, on] = useInOnce()
  const pct = 0.74
  const r = 56
  const c = 2 * Math.PI * r
  const score = useCount(74, on)
  return (
    <div ref={ref} style={{ display: 'grid', placeItems: 'center', paddingBottom: 26 }}>
      <svg viewBox="0 0 140 140" style={{ width: 186, height: 186 }} aria-hidden="true">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(36,36,38,.08)" strokeWidth="8" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#35363b"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          /* the arc sweeps from nothing to its share; the dash offset
             is the animated property, so the cap keeps its round end
             the whole way round */
          strokeDashoffset={on ? c * (1 - pct) : c}
          style={{ transition: 'stroke-dashoffset 1.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
          transform="rotate(-90 70 70)"
        />
        <text
          x="70"
          y="72"
          textAnchor="middle"
          fontSize="32"
          fill="#242426"
          letterSpacing="-1.2"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {Math.round(score)}
        </text>
        <text x="70" y="90" textAnchor="middle" fontSize="9.5" fill="rgba(36,36,38,.5)">
          {en ? 'of 100' : '100 üzerinden'}
        </text>
      </svg>
    </div>
  )
}

function InvMock({ en }) {
  const r = en
    ? [['#002-12', 'Mira Stüdyo', 1200, 'ok', 'Paid'], ['#003-12', 'Gümüş Masa', 550, 'stop', 'Overdue']]
    : [['#002-12', 'Mira Stüdyo', 1200, 'ok', 'Ödendi'], ['#003-12', 'Gümüş Masa', 550, 'stop', 'Gecikti']]
  const [ref, on] = useInOnce()
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', paddingBottom: 24 }}>
      {r.map(([no, who, amt, tone, label]) => (
        <Float key={no} style={{ borderColor: 'rgba(36,36,38,.1)' }}>
          <div className="lp-panel__top">
            <span style={{ fontSize: 12, color: 'var(--ink-50)' }}>{no}</span>
            <span className={'lp-tag lp-tag--' + tone} style={{ marginLeft: 'auto' }}>
              {label}
            </span>
          </div>
          <div style={{ fontSize: 20, letterSpacing: '-0.02em', paddingTop: 8 }}>{who}</div>
          <div className="lp-brk__row" style={{ paddingTop: 8 }}>
            <span style={{ fontSize: 13 }}>{en ? 'Services' : 'Hizmet bedeli'}</span>
            <b style={{ marginLeft: 'auto' }}>
              <Count to={amt} on={on} pre="₺" />
            </b>
          </div>
        </Float>
      ))}
    </div>
  )
}

function DueMock({ en }) {
  /* the flanking cards carry real values rather than sitting empty:
     blank rectangles read as unloaded placeholders, which is exactly
     what this section must not look like */
  const [ref, on] = useInOnce()
  const side = (label, amount, key) => (
    <Float key={key} style={{ flex: '0 1 86px', padding: '12px 10px', minWidth: 0, opacity: 0.55, textAlign: 'center' }}>
      <div style={{ fontSize: 15, letterSpacing: '-0.02em' }}>
        <Count to={amount} on={on} pre="₺" />
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-50)', paddingTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
    </Float>
  )
  return (
    <div ref={ref} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', width: '100%', minWidth: 0, paddingBottom: 28, justifyContent: 'center' }}>
      {side(en ? 'Stamp tax' : 'Damga', 610, 'a')}
      <Float style={{ flex: '1 1 150px', maxWidth: 170, padding: 16, textAlign: 'center', minWidth: 0 }}>
        <div style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 12, background: 'var(--pg)', margin: '0 auto 10px' }}>
          <Landmark style={{ width: 18, height: 18, color: 'var(--ink-50)' }} />
        </div>
        <div style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
          <Count to={4940} on={on} pre="₺" />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-50)', paddingTop: 2 }}>{en ? 'VAT · 26 Dec' : 'KDV · 26 Ara'}</div>
      </Float>
      {side(en ? 'Payroll tax' : 'SGK', 2180, 'b')}
    </div>
  )
}

function AlertMock({ en }) {
  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>
      <Float style={{ borderColor: 'rgba(36,36,38,.1)', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16 }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: 'rgba(190,70,60,.12)', color: '#a4433a', flex: '0 0 auto' }}>
            <TriangleAlert style={{ width: 17, height: 17 }} />
          </span>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 14 }}>{en ? 'Duplicate invoice' : 'Mükerrer fatura'}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-50)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              #002-12 · ₺14.820
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--pg)', fontSize: 13, color: 'var(--ink-75)' }}>
          {en ? 'Fix the invoice, alert clears' : 'Fatura düzeltilince uyarı kalkar'}
          <span style={{ marginLeft: 'auto', display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 8, background: 'var(--lime)', color: '#242426' }}>
            <CircleCheck style={{ width: 13, height: 13 }} />
          </span>
        </div>
      </Float>
    </div>
  )
}

const BENTO_ART = [CatsMock, SyncMock, ScoreMock, InvMock, DueMock, AlertMock]
const BENTO_ICON = [Tags, Landmark, Gauge, ListChecks, CalendarClock, TriangleAlert]
/* The reference's bento is three columns of alternating tall/short
   cards, not a uniform grid: column 2 starts short so the seam
   between columns never lines up. Each entry is
   [card index, height, tone]; heights are the measured 584 / 382. */
const BENTO_COLS = [
  [[0, 'tall', 'a'], [4, 'short', 'c']],
  [[1, 'short', 'b'], [3, 'tall', 'a']],
  [[2, 'tall', 'c'], [5, 'short', 'b']],
]
const SECTOR_ICON = [Factory, Truck, Wheat, Recycle, Boxes, Hammer]
const SPOT_ICON = [ScanLine, LineChart, Tags, Landmark]
const SHOW_ICON = [LayoutDashboard, LineChart, ListChecks]

/* ============================================================
   The page
   ============================================================ */

export default function Landing() {
  const { t, lang, setLanguage } = useLang()
  const en = lang === 'en'

  const page = useRef(null)
  const stage = useRef(null)
  const sayRef = useRef(null)
  const track = useRef(null)

  useScrollVar(stage, heroMap)
  useScrollVar(sayRef, sayMap)

  const [stuck, setStuck] = useState(false)
  const [navDark, setNavDark] = useState(false)
  const [menu, setMenu] = useState(false)
  const [yearly, setYearly] = useState(true)
  const [tab, setTab] = useState(0)
  const [open, setOpen] = useState(0)
  const [slide, setSlide] = useState(0)

  useNavTone(page, setNavDark)

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // the drawer owns the scroll lock while it is open
  useEffect(() => {
    if (!menu) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menu])

  const nav = t('lp.nav')
  const hero = t('lp.hero')
  const strip = t('lp.strip')
  const say = t('lp.say')
  const slabs = t('lp.slabs')
  const bento = t('lp.bento')
  const show = t('lp.show')
  const price = t('lp.price')
  const spot = t('lp.spot')
  const faq = t('lp.faq')
  const close = t('lp.close')
  const foot = t('lp.foot')

  const words = String(say.text).split(/\s+/)
  const groups = faq.groups[tab] || []
  const priceWords = String(price.title).split(/\s+/)

  const onTrack = useCallback(() => {
    const el = track.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const i = max <= 0 ? 0 : Math.round((el.scrollLeft / max) * (spot.cards.length - 1))
    setSlide(i)
  }, [spot.cards.length])

  const move = (dir) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector('.lp-rcard')
    const step = card ? card.getBoundingClientRect().width + 20 : el.clientWidth
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  const links = [
    ['#modules', nav.modules],
    ['#how', nav.how],
    ['#pricing', nav.pricing],
    ['#faq', nav.faq],
  ]

  return (
    <div className="lp" ref={page}>
      {/* ---------- nav ---------- */}
      <div className={'lp-navwrap' + (stuck ? ' is-stuck' : '') + (navDark ? ' is-dark' : '')}>
        <Rv as="nav" y={-56} now className="lp-nav">
          <Link className="lp-nav__brand" to="/">
            Muhai
          </Link>

          <div className="lp-nav__links">
            {links.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </div>

          <div className="lp-nav__right">
            <LangFlags lang={lang} setLanguage={setLanguage} />
            <button
              className="lp-burger"
              onClick={() => setMenu(true)}
              aria-label={en ? 'Open menu' : 'Menüyü aç'}
            >
              <Menu style={{ width: 18, height: 18 }} />
            </button>
            <Link className="lp-nav__login" to="/login">
              {t('lp.login')}
            </Link>
            <Btn to="/register" label={t('lp.start')} size="sm" />
          </div>
        </Rv>
      </div>

      <div className={'lp-drawer' + (menu ? ' is-open' : '')}>
        <div className="lp-drawer__top">
          <Link className="lp-nav__brand" to="/" onClick={() => setMenu(false)}>
            Muhai
          </Link>
          <button className="lp-burger" onClick={() => setMenu(false)} aria-label={en ? 'Close menu' : 'Menüyü kapat'}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <div className="lp-drawer__body">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
          <a href="/login" onClick={() => setMenu(false)}>
            {t('lp.login')}
          </a>
          <div className="lp-drawer__foot">
            <LangFlags lang={lang} setLanguage={setLanguage} />
            <Btn to="/register" label={t('lp.start')} onClick={() => setMenu(false)} />
          </div>
        </div>
      </div>

      {/* ---------- hero ---------- */}
      <header className="lp-hero">
        <div className="lp-shell">
          <div className="lp-hero__head">
            <Rv as="h1" y={48} delay={60} className="lp-d1 lp-hero__title">
              {hero.title}
            </Rv>
            <Rv as="p" y={72} delay={120} className="lp-lead lp-hero__lead">
              {hero.sub}
            </Rv>
            <Rv y={96} delay={180} className="lp-hero__cta">
              <Btn to="/register" label={t('lp.start')} size="lg" />
              <div className="lp-trust">
                <div className="lp-trust__row" aria-hidden="true">
                  {[Factory, Truck, Boxes, Landmark].map((I, i) => (
                    <span className="lp-trust__dot" key={i}>
                      <I style={{ width: 14, height: 14 }} />
                    </span>
                  ))}
                </div>
                <span className="lp-trust__label">{hero.trust}</span>
              </div>
            </Rv>
          </div>
        </div>

        <div className="lp-shell">
          <Rv y={128} delay={240} className="lp-rv--zoom">
            <div className="lp-stage" ref={stage}>
              <AppMock en={en} live />
            </div>
          </Rv>
        </div>
      </header>

      {/* ---------- sector strip ---------- */}
      <section className="lp-sec lp-strip" id="modules">
        <div className="lp-shell">
          <Rv className="lp-strip__bar">
            <p>{strip.head}</p>
            <a className="lp-strip__link" href="#how">
              <i>
                <ArrowUpRight />
              </i>
              {strip.link}
            </a>
          </Rv>
          <Rv delay={80} className="lp-strip__panel">
            {strip.sectors.map((s, i) => {
              const I = SECTOR_ICON[i % SECTOR_ICON.length]
              return (
                <div className="lp-strip__item" key={s}>
                  <I />
                  <span>{s}</span>
                </div>
              )
            })}
          </Rv>
        </div>
      </section>

      {/* ---------- statement + pinned slabs ---------- */}
      <section className="lp-sec lp-stack" id="how">
        <div className="lp-stack__pin">
          <div className="lp-say" ref={sayRef}>
            <div className="lp-shell">
              <h2 className="lp-say__text" style={{ '--n': words.length }}>
                {words.map((w, i) => (
                  <span className="lp-say__w" key={i} style={{ '--i': i }}>
                    {w}
                    {i < words.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </h2>
              <div className="lp-say__trio">
                {say.trio.map((c, i) => {
                  const I = [ScanLine, Percent, LineChart][i]
                  return (
                    <div className="lp-say__cell" key={c.b}>
                      <span className="lp-say__ico">
                        <I />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <b>{c.b}</b>
                        <span>{c.s}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="lp-slabs">
            {slabs.map((s, i) => {
              const Art = SLAB_ART[i]
              const I = SLAB_ICON[i]
              return (
                <div className={'lp-slab' + (i % 2 ? ' lp-slab--flip' : '')} key={s.badge}>
                  <div className="lp-shell" style={{ width: '100%' }}>
                    <div className="lp-slab__card">
                      <div className="lp-slab__say">
                        <Eyebrow icon={I} tone="flat">
                          {s.badge}
                        </Eyebrow>
                        <h3 className="lp-d4">{s.title}</h3>
                        <p className="lp-lead">{s.body}</p>
                        <div className="lp-slab__foot">
                          <CircleCheck />
                          {s.foot}
                        </div>
                      </div>
                      <div
                        className="lp-slab__art"
                        style={{ '--art': `url(${SLAB_ART_BG[i % SLAB_ART_BG.length]})` }}
                      >
                        <span className="lp-slab__ghost lp-slab__ghost--a" aria-hidden="true" />
                        <span className="lp-slab__ghost lp-slab__ghost--b" aria-hidden="true" />
                        <div className="lp-slab__mock">
                          <Art en={en} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------- bento ---------- */}
      <section className="lp-sec lp-sec--pad lp-bento">
        <div className="lp-shell">
          <div className="lp-bento__head">
            <Rv>
              <Eyebrow icon={Layers} tone="flat">
                {bento.eyebrow}
              </Eyebrow>
            </Rv>
            <Rv as="h2" delay={60} className="lp-d3">
              {bento.title}
            </Rv>
            <Rv as="p" delay={120} className="lp-lead">
              {bento.sub}
            </Rv>
          </div>

          <div className="lp-bento__grid">
            {BENTO_COLS.map((col, ci) => (
              <div className="lp-bento__col" key={ci}>
                {col.map(([i, size, tone], ri) => {
                  const c = bento.cards[i]
                  const Art = BENTO_ART[i]
                  const I = BENTO_ICON[i]
                  return (
                    <Rv
                      key={c.title}
                      y={32}
                      delay={ci * 90 + ri * 60}
                      className={'lp-bcard lp-bcard--' + size + ' lp-bcard--' + tone}
                    >
                      <Eyebrow icon={I}>{c.badge}</Eyebrow>
                      <h3 className="lp-d5 lp-bcard__title">{c.title}</h3>
                      <p className="lp-bcard__body">{c.body}</p>
                      <div className="lp-bcard__art">
                        <Art en={en} />
                      </div>
                    </Rv>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- showcase ---------- */}
      <section className="lp-sec lp-show">
        <div className="lp-show__slab lp-dark">
          <div className="lp-show__head">
            <Rv>
              <Eyebrow icon={LayoutDashboard} tone="dark">
                {show.eyebrow}
              </Eyebrow>
            </Rv>
            <Rv as="h2" delay={60} className="lp-d3">
              {show.title}
            </Rv>
            <Rv as="p" delay={120} className="lp-lead lp-lead--dark">
              {show.sub}
            </Rv>
          </div>

          <Rv delay={160} className="lp-show__frame">
            <div className="lp-show__glass">
              <div className="lp-show__clip">
                <AppMock en={en} />
              </div>
            </div>
          </Rv>

          <div className="lp-show__list">
            {show.list.map((c, i) => {
              const I = SHOW_ICON[i]
              return (
                <Rv key={c.t} delay={i * 90} className="lp-show__cell">
                  <b>
                    <i>
                      <I />
                    </i>
                    {c.t}
                  </b>
                  <span>{c.d}</span>
                </Rv>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------- pricing ---------- */}
      <section className="lp-sec lp-sec--pad lp-price" id="pricing">
        <div className="lp-shell">
          <div className="lp-price__head">
            <Rv>
              <Eyebrow icon={Tag} tone="flat">
                {price.eyebrow}
              </Eyebrow>
            </Rv>
            <Rv as="h2" delay={60} className="lp-d3">
              {priceWords.slice(0, -1).join(' ')}{' '}
              <span className="lp-price__hi">{priceWords[priceWords.length - 1]}</span>
            </Rv>
            <Rv as="p" delay={120} className="lp-lead">
              {price.sub}
            </Rv>
          </div>

          <Rv delay={80} className="lp-price__tabs" role="group">
            <button className={'lp-price__tab' + (yearly ? ' on' : '')} onClick={() => setYearly(true)} aria-pressed={yearly}>
              {price.yearly}
            </button>
            <button className={'lp-price__tab' + (!yearly ? ' on' : '')} onClick={() => setYearly(false)} aria-pressed={!yearly}>
              {price.monthly}
            </button>
          </Rv>

          <Rv delay={120} className="lp-price__grid">
            {price.plans.map((p, i) => (
              <div className="lp-plan" key={p.name}>
                <div className="lp-plan__name">{p.name}</div>
                <p className="lp-plan__note">{p.note}</p>
                <div className="lp-plan__price">
                  <em>₺</em>
                  {yearly ? p.y : p.m}
                  <span>/{en ? 'mo' : 'ay'}</span>
                </div>
                <div className="lp-plan__per">{price.per}</div>
                <Btn
                  to="/register"
                  label={p.cta}
                  variant={i === 1 ? '' : 'quiet'}
                  size="wide"
                />
                <ul className="lp-plan__feats">
                  {p.feats.map((f, j) => (
                    <li key={f}>
                      {j === 0 ? <CircleCheck /> : <Plus />}
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Rv>

          <Rv delay={120} className="lp-ent">
            <div className="lp-ent__text">
              <Eyebrow icon={Server}>{price.entBadge}</Eyebrow>
              <h3 className="lp-d4">{price.entTitle}</h3>
              <p className="lp-lead">{price.entBody}</p>
            </div>
            <Btn href="mailto:info@muhai.app" label={price.entCta} />
          </Rv>
        </div>
      </section>

      {/* ---------- capability rail ---------- */}
      <section className="lp-sec lp-rail">
        <div className="lp-rail__slab lp-dark">
          <div className="lp-rail__head">
            <div>
              <Rv>
                <Eyebrow icon={Target} tone="dark">
                  {spot.eyebrow}
                </Eyebrow>
              </Rv>
              <Rv as="h2" delay={60} className="lp-d3">
                {spot.title}
              </Rv>
              <Rv as="p" delay={120} className="lp-lead lp-lead--dark">
                {spot.sub}
              </Rv>
            </div>
          </div>

          <div className="lp-rail__track" ref={track} onScroll={onTrack}>
            {spot.cards.map((c, i) => {
              const I = SPOT_ICON[i % SPOT_ICON.length]
              return (
                <article className={'lp-rcard lp-rcard--' + (i % 4)} key={c.title}>
                  <div className="lp-rcard__say">
                    <h3 className="lp-d4">{c.title}</h3>
                    <p>{c.body}</p>
                  </div>
                  <div className="lp-rcard__facts">
                    <div className="lp-rcard__art" aria-hidden="true">
                      <I />
                    </div>
                    {c.facts.map((f) => (
                      <div className="lp-rcard__fact" key={f.k}>
                        <span>{f.k}</span>
                        <b>{f.v}</b>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="lp-rail__foot">
            <div className="lp-rail__nav">
              <button onClick={() => move(-1)} aria-label={en ? 'Previous' : 'Önceki'}>
                <ArrowLeft />
              </button>
              <button onClick={() => move(1)} aria-label={en ? 'Next' : 'Sonraki'}>
                <Arrow />
              </button>
            </div>
            <div className="lp-rail__bar" aria-hidden="true">
              {spot.cards.map((c, i) => (
                <i key={c.title} className={i === slide ? 'on' : ''} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- faq ---------- */}
      <section className="lp-sec lp-sec--pad lp-faq" id="faq">
        <div className="lp-shell">
          <div className="lp-faq__head">
            <Rv>
              <Eyebrow icon={MessagesSquare} tone="flat">
                {faq.eyebrow}
              </Eyebrow>
            </Rv>
            <Rv as="h2" delay={60} className="lp-d3">
              {faq.titleA} <em>{faq.titleB}</em>
            </Rv>
            <Rv as="p" delay={120} className="lp-lead">
              {faq.sub}
            </Rv>
          </div>

          <div className="lp-faq__grid">
            <Rv className="lp-faq__side">
              {faq.tabs.map((x, i) => (
                <button
                  key={x}
                  className={i === tab ? 'on' : ''}
                  onClick={() => {
                    setTab(i)
                    setOpen(0)
                  }}
                >
                  {x}
                </button>
              ))}
            </Rv>

            <div className="lp-faq__list">
              {groups.map((q, i) => (
                <Rv key={q.q} delay={i * 60} className={'lp-q' + (open === i ? ' on' : '')}>
                  <button
                    className="lp-q__btn"
                    onClick={() => setOpen(open === i ? -1 : i)}
                    aria-expanded={open === i}
                  >
                    {q.q}
                    <i>
                      <Plus />
                    </i>
                  </button>
                  <div className="lp-q__body">
                    <div>
                      <p>{q.a}</p>
                    </div>
                  </div>
                </Rv>
              ))}

              <Rv delay={120} className="lp-ask">
                <div className="lp-ask__text">
                  <Eyebrow icon={MessagesSquare}>{faq.askBadge}</Eyebrow>
                  <h3 className="lp-d4">{faq.askTitle}</h3>
                  <p className="lp-lead">{faq.askBody}</p>
                </div>
                <Btn href="mailto:info@muhai.app" label={faq.askCta} />
              </Rv>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- closing ---------- */}
      <div className="lp-closewrap">
        <section className="lp-close lp-dark">
          <div className="lp-close__head">
            <Rv as="h2" className="lp-d2">
              {close.title}
            </Rv>
            <Rv as="p" delay={60} className="lp-lead lp-lead--dark">
              {close.sub}
            </Rv>
            <Rv delay={120}>
              <Btn to="/register" label={close.cta} variant="lime" size="lg" />
            </Rv>
          </div>
          <Rv delay={160} className="lp-close__stage">
            <AppMock en={en} />
          </Rv>
        </section>
      </div>

      {/* ---------- footer ---------- */}
      <footer className="lp-foot">
        <div className="lp-shell">
          <div className="lp-foot__grid">
            <div className="lp-foot__brand">
              <Link className="lp-nav__brand" to="/">
                    Muhai
              </Link>
              <p>{foot.tagline}</p>
            </div>
            {foot.cols.map((c) => (
              <div className="lp-foot__col" key={c.h}>
                <h4>{c.h}</h4>
                {c.items.map((x) => (
                  <a key={x} href="#modules">
                    {x}
                  </a>
                ))}
              </div>
            ))}
          </div>

          <div className="lp-foot__mark" aria-hidden="true">
            <span>Muhai</span>
          </div>

          <div className="lp-foot__bar">
            <p>© {new Date().getFullYear()} Muhai. {foot.rights}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
