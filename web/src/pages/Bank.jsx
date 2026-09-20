/* ============================================================
   Banka mutabakatı — bank reconciliation.

   One question, answered: which movements on the statement are already in the
   books, and which are not. An unmatched row is the useful one — a missing
   invoice, or a payment nobody recorded — so it is what the screen defaults to.

   Two sources, one table. When a bank API is configured the statement is
   fetched; when it is not, the same statement is imported from a CSV export
   and goes through the same matcher. The screen never pretends a bank is
   connected when it is not: the status line says which setting is missing and
   points at the import instead.

   Nothing here is stored until the user asks. "Add to ledger" writes one
   workspace transaction through db.js, the single write path, using the
   document the API already built for that row.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, CheckCircle2,
  Loader2, Plus, RefreshCw, Upload,
} from 'lucide-react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { useData } from '../context/DataContext.jsx'
import { formatCurrency, formatDate } from '../lib/format.js'
import { COLLECTIONS, addItem } from '../lib/db.js'
import {
  getBankStatus, importStatement, invoiceRefs, listBankAccounts,
  reconcileStatement, syncStatement,
} from '../lib/bank.js'
import Badge from '../components/ui/Badge.jsx'
import PageSkeleton from '../components/ui/PageSkeleton.jsx'

const DEFAULT_WINDOW_DAYS = 30

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

export default function Bank() {
  const { t, lang } = useLang()
  const { invoices, learnedCategories, loading } = useData()
  const cur = (v) => formatCurrency(v, lang)
  const fileInput = useRef(null)

  const [status, setStatus] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [since, setSince] = useState(isoDaysAgo(DEFAULT_WINDOW_DAYS))
  const [until, setUntil] = useState(isoDaysAgo(0))

  const [statement, setStatement] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [savedRows, setSavedRows] = useState({})
  const [filter, setFilter] = useState('unmatched')

  // ── Connection ──────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    getBankStatus()
      .then((s) => {
        if (!alive) return
        setStatus(s)
        if (!s.live) return
        listBankAccounts()
          .then((list) => {
            if (!alive) return
            setAccounts(list)
            if (list.length) setAccountId((current) => current || list[0].id)
          })
          // A connected bank that will not list accounts is still usable with
          // an account number typed in, so this is not worth an error banner.
          .catch(() => {})
      })
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

  const refs = useMemo(() => invoiceRefs(invoices), [invoices])

  // ── Actions ─────────────────────────────────────────────────────────
  const run = useCallback(
    async (work) => {
      setBusy(true)
      setError(null)
      try {
        setStatement(await work())
        setSavedRows({})
      } catch (err) {
        setError(err.message)
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const fetchFromBank = () =>
    run(() =>
      syncStatement({
        account_id: accountId,
        since,
        until,
        invoices: refs,
        learned: learnedCategories,
      }),
    )

  const importFile = (file) =>
    run(async () => {
      const imported = await importStatement(file)
      // The import endpoint parses; matching is a second, pure call over the
      // rows it returned plus the invoices this browser already holds.
      const matched = await reconcileStatement({
        rows: imported.rows,
        invoices: refs,
        learned: learnedCategories,
      })
      return { ...matched, source: 'csv', since: imported.since, until: imported.until }
    })

  async function addToLedger(row, index) {
    setSavedRows((s) => ({ ...s, [index]: 'saving' }))
    try {
      await addItem(COLLECTIONS.transactions, row.ledger)
      setSavedRows((s) => ({ ...s, [index]: 'saved' }))
    } catch (err) {
      setSavedRows((s) => ({ ...s, [index]: null }))
      setError(err.message)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────
  const rows = statement?.rows ?? []
  const matches = statement?.matches ?? []
  const summary = statement?.summary
  const invoiceById = useMemo(
    () => Object.fromEntries(invoices.map((i) => [i.id, i])),
    [invoices],
  )

  const visible = useMemo(
    () =>
      rows
        .map((row, index) => ({ row, index, match: matches[index] }))
        .filter(({ match }) => {
          if (filter === 'all') return true
          const matched = match?.status === 'matched'
          return filter === 'matched' ? matched : !matched
        }),
    [rows, matches, filter],
  )

  if (loading) return <PageSkeleton />

  const live = status?.live
  const counts = {
    all: rows.length,
    matched: summary?.matched ?? 0,
    unmatched: summary?.unmatched ?? 0,
  }

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <h1 className="page-title">{t('bank.title')}</h1>
          <p className="page-sub">{t('bank.subtitle')}</p>
        </div>
        {live && (
          <button className="btn btn--brand btn--sm" onClick={fetchFromBank} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} strokeWidth={2.6} />}
            {t('bank.fetch')}
          </button>
        )}
      </div>

      {/* ── Connection ── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="bank-conn">
          <span className={`bank-conn__dot ${live ? 'bank-conn__dot--live' : ''}`} />
          <div className="bank-conn__text">
            <strong>{live ? status.display_name : t('bank.notConnected')}</strong>
            <span>
              {live
                ? t('bank.connectedHint')
                : status?.reason || t('bank.notConnectedHint')}
            </span>
          </div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            <Upload size={14} strokeWidth={2.6} /> {t('bank.importCsv')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.txt,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) importFile(file)
            }}
          />
        </div>

        {live && (
          <div className="bank-controls">
            <label className="field">
              <span className="field__label">{t('bank.account')}</span>
              <span className="field__wrap">
                {accounts.length > 0 ? (
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.iban ? ` · ${a.iban}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder={t('bank.accountId')}
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  />
                )}
              </span>
            </label>
            <label className="field">
              <span className="field__label">{t('bank.since')}</span>
              <span className="field__wrap">
                <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
              </span>
            </label>
            <label className="field">
              <span className="field__label">{t('bank.until')}</span>
              <span className="field__wrap">
                <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              </span>
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="review-banner" style={{ marginBottom: 20 }}>
          <AlertTriangle size={18} strokeWidth={2.2} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Results ── */}
      {!statement && !busy && (
        <div className="panel bank-empty">
          <Banknote size={26} strokeWidth={1.8} />
          <h3>{t('bank.emptyTitle')}</h3>
          <p>{live ? t('bank.emptyBodyLive') : t('bank.emptyBodyCsv')}</p>
        </div>
      )}

      {busy && !statement && (
        <div className="panel bank-empty">
          <Loader2 size={24} className="spin" />
          <p>{t('bank.working')}</p>
        </div>
      )}

      {statement && (
        <>
          <div className="mini-stats" style={{ marginBottom: 20 }}>
            <div className="mini-stats__item">
              <div className="mini-stats__label">{t('bank.kpiRows')}</div>
              <div className="mini-stats__value tnum">{summary.total}</div>
            </div>
            <div className="mini-stats__item">
              <div className="mini-stats__label">{t('bank.kpiMatched')}</div>
              <div className="mini-stats__value tnum mini-stats__value--pos">{summary.matched}</div>
            </div>
            <div className="mini-stats__item">
              <div className="mini-stats__label">{t('bank.kpiUnmatched')}</div>
              <div className={`mini-stats__value tnum ${summary.unmatched ? 'mini-stats__value--neg' : ''}`}>
                {summary.unmatched}
              </div>
            </div>
            <div className="mini-stats__item">
              <div className="mini-stats__label">{t('bank.kpiNet')}</div>
              <div className="mini-stats__value tnum">{cur(summary.net)}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head bank-panel-head">
              <div>
                <div className="panel-title">{t('bank.movements')}</div>
                <div className="panel-sub">
                  {statement.source === 'csv' ? t('bank.sourceCsv') : t('bank.sourceApi')}
                  {statement.since && statement.until
                    ? ` · ${formatDate(statement.since, lang)} – ${formatDate(statement.until, lang)}`
                    : ''}
                </div>
              </div>
              <div className="seg">
                {['unmatched', 'matched', 'all'].map((key) => (
                  <button
                    key={key}
                    className={filter === key ? 'is-active' : ''}
                    onClick={() => setFilter(key)}
                  >
                    {t(`bank.filter.${key}`)} ({counts[key]})
                  </button>
                ))}
              </div>
            </div>

            <div className="tbl-scroll">
              <table className="tbl bank-tbl">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('bank.description')}</th>
                    <th>{t('bank.category')}</th>
                    <th className="num">{t('common.amount')}</th>
                    <th>{t('common.status')}</th>
                    <th className="num">{t('common.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ row, index, match }) => {
                    const matched = match?.status === 'matched'
                    const invoice = matched ? invoiceById[match.invoice_id] : null
                    const saved = savedRows[index]
                    return (
                      <tr key={`${row.reference || row.description}-${index}`}>
                        <td className="mono">{row.date ? formatDate(row.date, lang) : '—'}</td>
                        <td>
                          <div className="strong">{row.description || row.counterparty || '—'}</div>
                          {row.counterparty && row.counterparty !== row.description && (
                            <div className="bank-row__sub">{row.counterparty}</div>
                          )}
                        </td>
                        <td>{t(`dashboard.cat.${row.category}`)}</td>
                        <td className={`num strong ${row.amount >= 0 ? 'bank-amt--in' : 'bank-amt--out'}`}>
                          {row.amount >= 0 ? (
                            <ArrowDownLeft size={13} strokeWidth={2.4} />
                          ) : (
                            <ArrowUpRight size={13} strokeWidth={2.4} />
                          )}{' '}
                          {cur(Math.abs(row.amount))}
                        </td>
                        <td>
                          {matched ? (
                            <Badge tone="green">
                              {invoice?.number || t('bank.matched')} · %
                              {Math.round((match.confidence || 0) * 100)}
                            </Badge>
                          ) : (
                            <Badge tone="amber">{t('bank.unmatched')}</Badge>
                          )}
                        </td>
                        <td className="num">
                          {matched ? (
                            <span className="bank-row__sub">{t('bank.inBooks')}</span>
                          ) : saved === 'saved' ? (
                            <span className="bank-row__sub bank-row__sub--ok">
                              <CheckCircle2 size={13} strokeWidth={2.4} /> {t('bank.added')}
                            </span>
                          ) : (
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => addToLedger(row, index)}
                              disabled={saved === 'saving'}
                            >
                              {saved === 'saving' ? (
                                <Loader2 size={12} className="spin" />
                              ) : (
                                <Plus size={12} strokeWidth={2.8} />
                              )}
                              {t('bank.addToLedger')}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 28 }}>
                        {t('bank.noRows')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
