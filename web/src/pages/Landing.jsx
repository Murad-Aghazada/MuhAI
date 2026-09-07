import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ReceiptText, Landmark, Boxes, Users, Sparkles, LineChart, ArrowRight, ArrowUpRight,
  Check, ScanLine, Database, Wallet, TrendingUp,
} from 'lucide-react'
import { useLang } from '../i18n/LanguageContext.jsx'
import LanguageToggle from '../components/layout/LanguageToggle.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import AreaChart from '../components/charts/AreaChart.jsx'
import DonutChart from '../components/charts/DonutChart.jsx'
import { MONTHS } from '../lib/format.js'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 } }),
}

const FEATURES = [
  { icon: ReceiptText, key: 'f1', color: '#0e9f6e', to: '/app/invoices' },
  { icon: Landmark, key: 'f2', color: '#3b94d6', to: '/app/tax' },
  { icon: Boxes, key: 'f3', color: '#e0962b', to: '/app/inventory' },
  { icon: Users, key: 'f4', color: '#ef6b53', to: '/app/payroll' },
  { icon: Sparkles, key: 'f5', color: '#7b71d6', to: '/app/assistant' },
  { icon: LineChart, key: 'f6', color: '#0e9f6e', to: '/app' },
]

// Illustrative series for the marketing hero mock only. Real figures come
// from Firestore + the compute API once you are signed in.
const PREVIEW_CASHFLOW = [
  { income: 183000, expense: 118000 },
  { income: 176000, expense: 109000 },
  { income: 198000, expense: 124000 },
  { income: 211000, expense: 131000 },
  { income: 205000, expense: 127000 },
  { income: 228000, expense: 138000 },
  { income: 241000, expense: 142000 },
  { income: 263000, expense: 151000 },
]

export default function Landing() {
  const { t, lang } = useLang()

  const donutData = [
    { label: t('dashboard.cat.salaries'), value: 58, color: 'var(--c-emerald)' },
    { label: t('dashboard.cat.supplies'), value: 31, color: 'var(--c-amber)' },
    { label: t('dashboard.cat.rent'), value: 24, color: 'var(--c-sky)' },
    { label: t('dashboard.cat.marketing'), value: 18, color: 'var(--c-coral)' },
  ]

  return (
    <div className="lp">
      {/* ---- Nav ---- */}
      <nav className="lp-nav">
        <Link to="/" className="lp-nav__brand">
          <span className="lp-nav__logo">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M7 23V9.5C7 9.22 7.22 9 7.5 9C7.66 9 7.8 9.07 7.9 9.2L13.6 16.4C13.8 16.66 14.2 16.66 14.4 16.4L20.1 9.2C20.2 9.07 20.34 9 20.5 9C20.78 9 21 9.22 21 9.5V23" stroke="#0E9F6E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="24" cy="22.5" r="2" fill="#0E9F6E" />
            </svg>
          </span>
          Muhai
        </Link>
        <div className="lp-nav__links">
          <a href="#features">{t('nav.modules')}</a>
          <a href="#how">{t('landing.howEyebrow')}</a>
          <a href="#assistant">{t('nav.product')}</a>
        </div>
        <div className="lp-nav__right">
          <LanguageToggle />
          <Link to="/login" className="lp-nav__login">{t('nav.login')}</Link>
          <Link to="/register" className="btn btn--primary btn--sm">{t('nav.launch')} <ArrowRight size={15} /></Link>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <header className="lp-hero">
        <div className="lp-hero__bg" />
        <div className="lp-hero__grid">
          <div className="lp-hero__copy">
            <motion.span className="lp-badge" variants={fadeUp} initial="hidden" animate="show">
              <span className="lp-badge__dot" /> {t('landing.badge')}
            </motion.span>
            <motion.h1 className="lp-hero__title" variants={fadeUp} initial="hidden" animate="show" custom={1}>
              {t('landing.heroLine1')} <br />
              <span className="lp-hero__accent">{t('landing.heroLine2')}</span>
            </motion.h1>
            <motion.p className="lp-hero__sub" variants={fadeUp} initial="hidden" animate="show" custom={2}>
              {t('landing.heroSub')}
            </motion.p>
            <motion.div className="lp-hero__cta" variants={fadeUp} initial="hidden" animate="show" custom={3}>
              <Link to="/register" className="btn btn--brand">{t('landing.ctaPrimary')} <ArrowRight size={17} /></Link>
              <a href="#assistant" className="btn btn--ghost">{t('landing.ctaSecondary')}</a>
            </motion.div>
            <motion.div className="lp-hero__stats" variants={fadeUp} initial="hidden" animate="show" custom={4}>
              <Stat value={2.4} suffix="M+" label={t('landing.statInvoices')} fmt={(v) => v.toFixed(1)} />
              <Stat value={98.6} suffix="%" label={t('landing.statAccuracy')} fmt={(v) => v.toFixed(1)} />
              <Stat value={1200} suffix="+" label={t('landing.statBusinesses')} fmt={(v) => Math.round(v).toString()} />
            </motion.div>
          </div>

          {/* Hero visual: floating dashboard */}
          <motion.div
            className="lp-hero__visual"
            initial={{ opacity: 0, y: 40, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            <div className="lp-mock">
              <div className="lp-mock__head">
                <div className="lp-mock__dots"><span /><span /><span /></div>
                <span className="lp-mock__title">Muhai · {t('nav.dashboard')}</span>
                <span className="lp-mock__live"><span className="live-dot" />{t('common.live')}</span>
              </div>
              <div className="lp-mock__kpis">
                {[
                  { icon: Wallet, label: t('dashboard.kpiRevenue'), val: '₺263K', up: '+9.1%' },
                  { icon: TrendingUp, label: t('dashboard.kpiProfit'), val: '₺112K', up: '+12.8%' },
                ].map((k) => (
                  <div className="lp-mock__kpi" key={k.label}>
                    <span className="lp-mock__kpi-icon"><k.icon size={15} /></span>
                    <div>
                      <div className="lp-mock__kpi-label">{k.label}</div>
                      <div className="lp-mock__kpi-val tnum">{k.val} <em>{k.up}</em></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="lp-mock__chart">
                <div className="lp-mock__chart-label">{t('dashboard.cashflowTitle')}</div>
                <AreaChart data={PREVIEW_CASHFLOW} labels={MONTHS[lang].slice(4)} keys={['income', 'expense']} colors={['var(--c-emerald)', 'var(--c-coral)']} height={150} formatValue={(v) => `₺${Math.round(v / 1000)}K`} seriesNames={[t('dashboard.income'), t('dashboard.expense')]} />
              </div>
            </div>

            {/* floating cards */}
            <motion.div className="lp-float lp-float--scan" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
              <span className="lp-float__icon" style={{ background: 'var(--brand-tint)', color: 'var(--brand-deep)' }}><ScanLine size={16} /></span>
              <div><div className="lp-float__t">OCR</div><div className="lp-float__s">98.6% {lang === 'en' ? 'accuracy' : 'doğruluk'}</div></div>
            </motion.div>
            <motion.div className="lp-float lp-float--ai" animate={{ y: [0, 10, 0] }} transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}>
              <span className="lp-float__icon" style={{ background: '#efeafb', color: 'var(--c-violet)' }}><Sparkles size={16} /></span>
              <div><div className="lp-float__t">{t('common.ai')} · RAG</div><div className="lp-float__s">{lang === 'en' ? 'active' : 'aktif'}</div></div>
            </motion.div>
          </motion.div>
        </div>
      </header>

      {/* ---- Features ---- */}
      <section className="lp-section" id="features">
        <SectionHead eyebrow={t('landing.featuresEyebrow')} title={t('landing.featuresTitle')} sub={t('landing.featuresSub')} />
        <div className="lp-features">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.key}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              custom={i}
            >
              <Link to={f.to} className="lp-feature" style={{ '--accent': f.color }}>
                <div className="lp-feature__top">
                  <span className="lp-feature__icon">
                    <f.icon size={23} strokeWidth={2} />
                  </span>
                  <span className="lp-feature__num">0{i + 1}</span>
                </div>
                <span className="lp-feature__tag">{t(`landing.${f.key}Tag`)}</span>
                <h3>{t(`landing.${f.key}Title`)}</h3>
                <p>{t(`landing.${f.key}Desc`)}</p>
                <span className="lp-feature__explore">
                  {t('landing.featureCta')} <ArrowRight size={14} strokeWidth={2.6} />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="lp-section lp-how" id="how">
        <SectionHead eyebrow={t('landing.howEyebrow')} title={t('landing.howTitle')} center />
        <div className="lp-steps">
          {['how1', 'how2', 'how3'].map((s, i) => (
            <motion.div key={s} className="lp-step" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i}>
              <span className="lp-step__num">0{i + 1}</span>
              <h4>{t(`landing.${s}Title`)}</h4>
              <p>{t(`landing.${s}Desc`)}</p>
              {i < 2 && <ArrowRight className="lp-step__arrow" size={20} />}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---- AI showcase ---- */}
      <section className="lp-section lp-ai" id="assistant">
        <div className="lp-ai__grid">
          <motion.div className="lp-ai__copy" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <span className="eyebrow">{t('landing.aiEyebrow')}</span>
            <h2>{t('landing.aiTitle')}</h2>
            <p>{t('landing.aiSub')}</p>
            <ul className="lp-ai__list">
              {['aiBullet1', 'aiBullet2', 'aiBullet3'].map((b) => (
                <li key={b}><span className="lp-ai__check"><Check size={13} strokeWidth={3} /></span>{t(`landing.${b}`)}</li>
              ))}
            </ul>
            <Link to="/app/assistant" className="btn btn--primary">{t('dashboard.insightAction')} <ArrowUpRight size={16} /></Link>
          </motion.div>

          <motion.div className="lp-ai__visual" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={1}>
            <div className="lp-chat-demo">
              <div className="lp-chat-demo__head"><Database size={13} /> {t('assistant.ragOn')}</div>
              <div className="lp-chat-demo__msg lp-chat-demo__msg--user">{t('assistant.suggest1')}</div>
              <div className="lp-chat-demo__msg lp-chat-demo__msg--bot">
                <Sparkles size={14} color="var(--brand-deep)" style={{ marginBottom: 6 }} />
                <p>{lang === 'en'
                  ? 'In 2026 Türkiye applies three VAT rates: standard 20%, reduced 10%, and super-reduced 1%.'
                  : '2026’da Türkiye’de üç KDV oranı uygulanır: genel %20, indirimli %10 ve süper indirimli %1.'}</p>
                <div className="lp-chat-demo__src">{t('assistant.sources')}: {lang === 'en' ? 'VAT Rates (2026)' : 'KDV Oranları (2026)'}</div>
              </div>
            </div>
            <div className="lp-ai__donut">
              <DonutChart data={donutData} size={120} thickness={16} centerLabel={t('dashboard.kpiExpense')} formatValue={() => '%100'} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="lp-cta">
        <motion.div className="lp-cta__inner" variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <div className="lp-cta__glow" />
          <h2>{t('landing.ctaTitle')}</h2>
          <p>{t('landing.ctaSub')}</p>
          <Link to="/register" className="btn btn--brand">{t('landing.ctaButton')} <ArrowRight size={17} /></Link>
        </motion.div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="lp-footer">
        <div className="lp-footer__main">
          <div className="lp-footer__brand">
            <span className="lp-nav__brand" style={{ fontSize: 20 }}>
              <span className="lp-nav__logo">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                  <path d="M7 23V9.5C7 9.22 7.22 9 7.5 9C7.66 9 7.8 9.07 7.9 9.2L13.6 16.4C13.8 16.66 14.2 16.66 14.4 16.4L20.1 9.2C20.2 9.07 20.34 9 20.5 9C20.78 9 21 9.22 21 9.5V23" stroke="#0E9F6E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="24" cy="22.5" r="2" fill="#0E9F6E" />
                </svg>
              </span>
              Muhai
            </span>
            <p>{t('landing.footerTagline')}</p>
          </div>
          <div className="lp-footer__cols">
            <FooterCol title={t('landing.footerProduct')} items={[t('nav.invoices'), t('nav.tax'), t('nav.inventory'), t('nav.payroll')]} />
            <FooterCol title={t('landing.footerCompany')} items={[t('nav.about'), 'Blog', t('nav.pricing')]} />
            <FooterCol title={t('landing.footerLegal')} items={['KVKK', 'Gizlilik', 'Şartlar']} />
          </div>
        </div>
        <div className="lp-footer__bar">
          <span>© 2026 Muhai. {t('landing.footerRights')}</span>
          <span>{t('landing.madeWith')} 🇹🇷</span>
        </div>
      </footer>
    </div>
  )
}

function Stat({ value, suffix, label, fmt }) {
  return (
    <div className="lp-stat">
      <div className="lp-stat__val tnum"><AnimatedNumber value={value} format={fmt} />{suffix}</div>
      <div className="lp-stat__label">{label}</div>
    </div>
  )
}

function SectionHead({ eyebrow, title, sub, center }) {
  return (
    <motion.div className={`lp-sec-head ${center ? 'lp-sec-head--center' : ''}`} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </motion.div>
  )
}

function FooterCol({ title, items }) {
  return (
    <div className="lp-footer__col">
      <h5>{title}</h5>
      {items.map((it) => <a key={it} href="#">{it}</a>)}
    </div>
  )
}
