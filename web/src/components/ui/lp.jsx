/* ============================================================
   The landing page's own primitives — the arrow, the chip button,
   the eyebrow pill and the two flags.

   These used to be private to `pages/Landing.jsx`. They are here
   because the auth screens render the same design language and a
   second copy of the chip button would drift from the first the
   first time either was touched. `styles/landing.css` holds every
   rule they read, so anything rendering them has to sit inside a
   `.lp` element.
   ============================================================ */

import { Link } from 'react-router-dom'
import { ReceiptText } from 'lucide-react'

/* The reference draws its arrow across the whole 24 grid — x 3 to
   21, 1.5 stroke, round caps — which is where its buttons get their
   length. Lucide's ArrowRight is inset to 5 → 19 and reads stubby
   beside it. Geometry lifted from the reference's own sprite. */
export function Arrow(props) {
  return (
    <svg
      className="lucide"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 12h18m0 0-7-7m7 7-7 7" />
    </svg>
  )
}

/**
 * The signature control: a pill with a lime chip pinned inside it that
 * sweeps the label into view on hover.
 *
 * Renders a `<Link>` by default, an `<a>` when given `href`, and a real
 * `<button>` when given `type` — the form submit on the auth screens is
 * the third case, and it must stay a button or Enter does nothing.
 */
export function Btn({
  to,
  href,
  type,
  label,
  variant = '',
  size = '',
  onClick,
  icon: Icon = Arrow,
  className = '',
  ...rest
}) {
  const cls = ['lp-btn', variant && 'lp-btn--' + variant, size && 'lp-btn--' + size, className]
    .filter(Boolean)
    .join(' ')

  /* The label is rendered twice on purpose. The copy inside the chip
     is what the hover sweep reveals; the outer one is what fades out
     under it. Both are the same string at the same size, so the swap
     lands on itself rather than shifting. The duplicate is hidden
     from assistive tech. */
  const inner = (
    <>
      <span className="lp-btn__chip" aria-hidden="true">
        <span>{label}</span>
        <i className="lp-btn__ico">
          <Icon />
        </i>
      </span>
      <span className="lp-btn__ghost" aria-hidden="true" />
      <span className="lp-btn__label">{label}</span>
    </>
  )

  if (type) {
    return (
      <button className={cls} type={type} onClick={onClick} {...rest}>
        {inner}
      </button>
    )
  }

  if (href) {
    return (
      <a className={cls} href={href} onClick={onClick} {...rest}>
        {inner}
      </a>
    )
  }

  return (
    <Link className={cls} to={to || '/register'} onClick={onClick} {...rest}>
      {inner}
    </Link>
  )
}

export function Eyebrow({ icon: Icon = ReceiptText, tone = '', children }) {
  return (
    <span className={'lp-eyebrow' + (tone ? ' lp-eyebrow--' + tone : '')}>
      <span className="lp-eyebrow__ico">
        <Icon />
      </span>
      {children}
    </span>
  )
}

/* ---------- language ----------
   Two flags, drawn rather than fetched: an emoji flag is a font
   lottery (Windows has no flag glyphs at all and renders "TR"), and
   an image would be two more requests for 22×15 of colour. */
export function FlagTR() {
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true">
      <rect width="30" height="20" fill="#e30a17" />
      <circle cx="11.5" cy="10" r="5" fill="#fff" />
      <circle cx="13.2" cy="10" r="4" fill="#e30a17" />
      <path
        d="M18.6 7.6 19.19 9.19 20.88 9.26 19.55 10.31 20.01 11.94 18.6 11 17.19 11.94 17.65 10.31 16.32 9.26 18.01 9.19Z"
        fill="#fff"
      />
    </svg>
  )
}

export function FlagEN() {
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true">
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" strokeWidth="2" />
      <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3.4" />
    </svg>
  )
}

export function LangFlags({ lang, setLanguage }) {
  return (
    <div className="lp-flags" role="group" aria-label="Language">
      <button
        type="button"
        className={lang === 'tr' ? 'on' : ''}
        onClick={() => setLanguage('tr')}
        aria-pressed={lang === 'tr'}
        aria-label="Türkçe"
        title="Türkçe"
      >
        <FlagTR />
      </button>
      <button
        type="button"
        className={lang === 'en' ? 'on' : ''}
        onClick={() => setLanguage('en')}
        aria-pressed={lang === 'en'}
        aria-label="English"
        title="English"
      >
        <FlagEN />
      </button>
    </div>
  )
}
