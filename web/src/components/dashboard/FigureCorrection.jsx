/* ============================================================
   Correcting the month's income or expense from the dashboard.

   The figure is a total of records, so it is never overwritten. The
   difference between what the records add up to and what the user
   types is saved as one correction record (category "adjustment",
   dated today), negative when the figure goes down. Everything that
   reads the records then agrees with the dashboard: the tax figure,
   the Muhai Score, the tax page, the agent and its reports.

   One correction per month and direction. Saving again replaces it
   instead of stacking a second, and it can be taken back from here.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { COLLECTIONS, addItem, removeItem, updateItem } from '../../lib/db.js'
import { ADJUSTMENT, monthKey, todayIso } from '../../lib/analytics.js'
import { formatCurrency } from '../../lib/format.js'

const round2 = (n) => Math.round(n * 100) / 100

const MONTH_NAMES = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

/**
 * "400.000", "400,000", "400000", "400.000,50", "1,234.5" -> a number.
 *
 * Needs no locale: money has at most two decimals, so a separator followed
 * by exactly three digits is always a thousands mark and one followed by one
 * or two digits at the end is always the decimal. "400.5" is 400,5 in either
 * language, never 4005.
 */
export function parseAmount(raw) {
  const s = String(raw ?? '').replace(/[₺\s ]/g, '')
  const m = s.match(/^(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,](\d{1,2}))?$/)
  if (!m) return NaN
  return Number(m[1].replace(/[.,]/g, '') + (m[2] ? `.${m[2]}` : ''))
}

const signed = (value, lang) =>
  `${value > 0 ? '+' : '−'}${formatCurrency(Math.abs(value), lang, { decimals: value % 1 ? 2 : 0 })}`

export default function FigureCorrection({ kind, onDone }) {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const { transactions } = useData()
  const inputRef = useRef(null)

  const asOf = todayIso()
  const month = monthKey(asOf)

  // The same records, the same window and the same sign rules as the
  // snapshot the dashboard's figure was computed from (analytics.js), so
  // "current" here is the number on the row.
  const { recorded, corrections, current } = useMemo(() => {
    let sum = 0
    const found = []
    for (const tx of transactions) {
      if ((tx.type === 'income' ? 'income' : 'expense') !== kind) continue
      if (!tx.date || monthKey(tx.date) !== month || tx.date > asOf) continue
      if (tx.category === ADJUSTMENT) found.push(tx)
      else sum += Math.abs(Number(tx.amount) || 0)
    }
    const corrected = found.reduce((s, tx) => s + (Number(tx.amount) || 0), 0)
    return { recorded: round2(sum), corrections: found, current: round2(sum + corrected) }
  }, [transactions, kind, month, asOf])

  const existing = round2(current - recorded)

  const [value, setValue] = useState(() =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 2 }).format(current),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const target = parseAmount(value)
  const valid = Number.isFinite(target) && target >= 0 && target < 1e12
  const next = valid ? round2(target - recorded) : 0
  const changed = valid && Math.abs(target - current) >= 0.005

  const monthName = MONTH_NAMES[lang === 'en' ? 'en' : 'tr'][Number(month.slice(5, 7)) - 1]
  const title = t(`dashboard.correction.title_${kind}`).replace('{month}', monthName)

  let note = t('dashboard.correction.hint')
  if (!valid && value.trim()) note = t('dashboard.correction.invalid')
  else if (changed && Math.abs(next) < 0.005) note = t('dashboard.correction.willRemove')
  else if (changed && corrections.length) note = t('dashboard.correction.willUpdate').replace('{amount}', signed(next, lang))
  else if (changed) note = t('dashboard.correction.willAdd').replace('{amount}', signed(target - current, lang))

  async function apply(amount) {
    setBusy(true)
    setError(null)
    try {
      const [first, ...rest] = corrections
      if (Math.abs(amount) < 0.005) {
        for (const tx of corrections) await removeItem(COLLECTIONS.transactions, tx.id)
      } else {
        const doc = {
          date: asOf,
          type: kind,
          amount,
          category: ADJUSTMENT,
          description: t('dashboard.correction.description'),
          vendor: '',
          // Kept with the record, so it says what it was set to, when and by whom.
          correctedTo: round2(recorded + amount),
          correctedAt: new Date().toISOString(),
          correctedBy: user?.email || '',
        }
        if (first) await updateItem(COLLECTIONS.transactions, first.id, doc)
        else await addItem(COLLECTIONS.transactions, doc)
        for (const tx of rest) await removeItem(COLLECTIONS.transactions, tx.id)
      }
      onDone()
    } catch (err) {
      setError(err?.message || t('common.error'))
      setBusy(false)
    }
  }

  return (
    <form
      className="figure-fix"
      onSubmit={(event) => {
        event.preventDefault()
        if (changed && !busy) apply(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDone()
      }}
    >
      <label className="field">
        <span className="field__label">{title}</span>
        <span className="field__wrap">
          <span className="figure-fix__unit" aria-hidden="true">₺</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!valid && value.trim() ? true : undefined}
            disabled={busy}
          />
        </span>
      </label>

      <p className={`figure-fix__note${!valid && value.trim() ? ' is-bad' : ''}`} aria-live="polite">
        {note}
      </p>

      {corrections.length > 0 && Math.abs(existing) >= 0.005 ? (
        <p className="figure-fix__existing">
          {t('dashboard.correction.existing').replace('{amount}', signed(existing, lang))}{' '}
          <button type="button" className="figure-fix__undo" onClick={() => apply(0)} disabled={busy}>
            {t('dashboard.correction.undo')}
          </button>
        </p>
      ) : null}

      {error ? <p className="figure-fix__note is-bad" role="alert">{error}</p> : null}

      <div className="figure-fix__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onDone} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={!changed || busy}>
          {busy ? <Loader2 size={14} className="spin" /> : null}
          {t('common.save')}
        </button>
      </div>
    </form>
  )
}
