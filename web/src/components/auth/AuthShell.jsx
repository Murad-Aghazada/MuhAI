import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart3, Bot, ScanLine, ShieldCheck } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import LanguageToggle from '../layout/LanguageToggle.jsx'

const HIGHLIGHTS = [
  { icon: ScanLine, tr: 'Fatura OCR', en: 'Invoice OCR', trSub: 'Tesseract 5 + Türkçe dil paketi', enSub: 'Tesseract 5 with the Turkish pack' },
  { icon: BarChart3, tr: 'Nakit akışı tahmini', en: 'Cash-flow forecast', trSub: 'Prophet ile 30 günlük projeksiyon', enSub: '30-day projection with Prophet' },
  { icon: ShieldCheck, tr: '2026 vergi motoru', en: '2026 tax engine', trSub: 'KDV, stopaj, SGK, kurumlar', enSub: 'VAT, withholding, SGK, corporate' },
  { icon: Bot, tr: 'Finansal asistan', en: 'Financial assistant', trSub: 'İşletme verinize dayalı yanıtlar', enSub: 'Answers grounded in your data' },
]

/** Split layout shared by the login and registration screens. */
export default function AuthShell({ title, subtitle, wide = false, children }) {
  const { lang } = useLang()

  return (
    <div className="auth-page">
      <div className="auth-page__aside">
        <Link to="/" className="auth-brand">
          <span className="auth-brand__logo">
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path
                d="M7 23V9.5C7 9.22 7.22 9 7.5 9C7.66 9 7.8 9.07 7.9 9.2L13.6 16.4C13.8 16.66 14.2 16.66 14.4 16.4L20.1 9.2C20.2 9.07 20.34 9 20.5 9C20.78 9 21 9.22 21 9.5V23"
                stroke="#0E9F6E"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="24" cy="22.5" r="2" fill="#0E9F6E" />
            </svg>
          </span>
          Muhai
        </Link>

        <div className="auth-aside__body">
          <h2 className="auth-aside__title">
            {lang === 'en'
              ? 'Your accounting, already done by the time you look at it.'
              : 'Muhasebeniz, siz bakmadan önce yapılmış olsun.'}
          </h2>
          <ul className="auth-highlights">
            {HIGHLIGHTS.map((h, i) => (
              <motion.li
                key={h.tr}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.1 + i * 0.08 }}
              >
                <span className="auth-highlights__icon">
                  <h.icon size={16} strokeWidth={2.2} />
                </span>
                <span>
                  <strong>{lang === 'en' ? h.en : h.tr}</strong>
                  <em>{lang === 'en' ? h.enSub : h.trSub}</em>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="auth-aside__foot">TEKNOFEST 2026 · Team Nasimi BHOS</p>
      </div>

      <div className="auth-page__main">
        <div className="auth-page__topbar">
          <LanguageToggle />
        </div>
        <motion.div
          className={`auth-card ${wide ? 'auth-card--wide' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="auth-card__title">{title}</h1>
          <p className="auth-card__sub">{subtitle}</p>
          {children}
        </motion.div>
      </div>
    </div>
  )
}
