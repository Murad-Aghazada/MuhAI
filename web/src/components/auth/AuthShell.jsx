import { Link } from 'react-router-dom'
import { BarChart3, Bot, Check, ScanLine, ShieldCheck } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { Btn, LangFlags } from '../ui/lp.jsx'

const HIGHLIGHTS = [
  { icon: ScanLine, tr: 'Fatura OCR', en: 'Invoice OCR', trSub: 'Tutar, KDV ve tarih otomatik okunur', enSub: 'Amount, VAT and dates read automatically' },
  { icon: BarChart3, tr: 'Nakit akışı tahmini', en: 'Cash-flow forecast', trSub: '30 günlük nakit projeksiyonu', enSub: 'A 30-day cash projection' },
  { icon: ShieldCheck, tr: '2026 vergi motoru', en: '2026 tax engine', trSub: 'KDV, stopaj, SGK, kurumlar', enSub: 'VAT, withholding, SGK, corporate' },
  { icon: Bot, tr: 'Finansal asistan', en: 'Financial assistant', trSub: 'İşletme verinize dayalı yanıtlar', enSub: 'Answers grounded in your data' },
]

/**
 * The auth shell — the landing page's own language, one step in.
 *
 * The root is a `.lp` element on purpose: the wordmark, the nav pill, the
 * chip button, the type pair and every token come from `styles/landing.css`
 * rather than from a second palette that would drift from it. The card is
 * the landing's slab geometry — 8px of padding around two panels, dark on
 * the left, the form on the right. Below 940px the dark panel drops.
 *
 * `alt` names where the other door is: /login offers /register and back.
 */
export default function AuthShell({ title, subtitle, alt, children }) {
  const { lang, setLanguage } = useLang()
  const en = lang === 'en'

  return (
    <div className="lp lp-auth">
      <div className="lp-auth__nav">
        <nav className="lp-nav">
          <Link className="lp-nav__brand" to="/">
            Muhai
          </Link>

          <span className="lp-auth__gap" />

          <div className="lp-nav__right">
            <LangFlags lang={lang} setLanguage={setLanguage} />
            {alt && (
              <>
                <Link className="lp-nav__login" to={alt.to}>
                  {alt.quiet}
                </Link>
                <Btn to={alt.to} label={alt.cta} size="sm" />
              </>
            )}
          </div>
        </nav>
      </div>

      <div className="lp-auth__body">
        <div className="lp-auth__card">
          <aside className="lp-auth__pitch">
            <h2 className="lp-d5">
              {en
                ? 'Your accounting, already done by the time you look at it.'
                : 'Muhasebeniz, siz bakmadan önce yapılmış olsun.'}
            </h2>

            <ul className="lp-auth__list">
              {HIGHLIGHTS.map((h) => (
                <li key={h.tr}>
                  <span className="lp-auth__mark">
                    <Check strokeWidth={2.2} />
                  </span>
                  <span>
                    <b>{en ? h.en : h.tr}</b>
                    <span>{en ? h.enSub : h.trSub}</span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="lp-auth__foot">TEKNOFEST 2026 · Team Nasimi BHOS</p>
          </aside>

          <div className="lp-auth__form">
            <h1 className="lp-d4 lp-auth__title">{title}</h1>
            <p className="lp-lead lp-auth__sub">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
