import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Landmark,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useData } from '../context/DataContext.jsx'
import { formatCurrency, formatDate, MONTHS } from '../lib/format.js'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import AreaChart from '../components/charts/AreaChart.jsx'
import DonutChart from '../components/charts/DonutChart.jsx'
import ForecastChart from '../components/charts/ForecastChart.jsx'
import ScoreGauge from '../components/charts/ScoreGauge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageSkeleton from '../components/ui/PageSkeleton.jsx'

const STATUS_TONE = { paid: 'green', pending: 'amber', overdue: 'red' }
const SEVERITY_TONE = { high: 'red', medium: 'amber', low: 'gray' }

// The card is a prompt to act, not a register. Four rows keep it the height of
// the score panel beside it; the rest are counted off underneath.
const ALERTS_SHOWN = 4

// Stable colours per category so the donut and legend never re-shuffle.
const CATEGORY_COLORS = [
  'var(--c-emerald)',
  'var(--c-amber)',
  'var(--c-sky)',
  'var(--c-coral)',
  'var(--c-violet)',
  '#4bb3a5',
  '#c98fd6',
  '#8fa8c9',
  '#d4a373',
  '#b9bfbc',
]

export default function Dashboard() {
  const { t, lang } = useLang()
  const { company, profile } = useAuth()
  const navigate = useNavigate()
  const { dashboard, score, forecast, compliance, invoices, loading, isEmpty, apiOnline, computing, refresh } = useData()

  const cur = (v, o) => formatCurrency(v, lang, o)
  const compact = (v) => formatCurrency(v, lang, { compact: true })

  const monthly = dashboard?.monthly ?? []
  const kpis = dashboard?.kpis

  const monthLabels = useMemo(
    () => monthly.map((m) => MONTHS[lang][Number(m.month.slice(5, 7)) - 1]),
    [monthly, lang],
  )

  const stats = useMemo(() => {
    if (!kpis) return []
    const income = monthly.map((m) => m.income)
    const expense = monthly.map((m) => m.expense)
    const profit = monthly.map((m) => m.profit)
    return [
      { icon: Wallet, label: t('dashboard.kpiRevenue'), value: kpis.revenue, delta: `${kpis.revenue_delta}%`, deltaValue: kpis.revenue_delta, deltaPositive: kpis.revenue_delta >= 0, spark: income, sparkColor: 'var(--c-emerald)' },
      { icon: CreditCard, label: t('dashboard.kpiExpense'), value: kpis.expense, delta: `${kpis.expense_delta}%`, deltaValue: kpis.expense_delta, deltaPositive: kpis.expense_delta <= 0, spark: expense, sparkColor: 'var(--c-coral)' },
      { icon: TrendingUp, label: t('dashboard.kpiProfit'), value: kpis.profit, delta: `${kpis.profit_delta}%`, deltaValue: kpis.profit_delta, deltaPositive: kpis.profit_delta >= 0, spark: profit, sparkColor: 'var(--c-sky)' },
      { icon: Landmark, label: t('dashboard.kpiTax'), value: kpis.tax, delta: `${kpis.tax_delta}%`, deltaValue: kpis.tax_delta, deltaPositive: kpis.tax_delta <= 0, spark: monthly.map((m) => Math.max(m.income - m.expense, 0) * 0.167), sparkColor: 'var(--c-amber)' },
    ]
  }, [kpis, monthly, t])

  // Only the largest categories get their own slice, but the tail is rolled
  // into "other" rather than dropped — the donut's centre is labelled as the
  // month's total expense, so it has to actually be the total.
  const donutData = useMemo(() => {
    const all = dashboard?.expense_breakdown ?? []
    const TOP = 7
    const head = all.slice(0, TOP)
    const tail = all.slice(TOP)
    const slices = [...head]
    if (tail.length) {
      slices.push({ key: 'other', value: tail.reduce((s, e) => s + e.value, 0) })
    }
    return slices.map((e, i) => ({
      ...e,
      label: t(`dashboard.cat.${e.key}`),
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }))
  }, [dashboard?.expense_breakdown, t])

  // Alerts name an invoice by id; the row shows its number so the user knows
  // which document is meant before clicking through.
  const invoiceById = useMemo(
    () => new Map(invoices.map((i) => [i.id, i])),
    [invoices],
  )

  const recent = useMemo(
    () =>
      [...invoices]
        .sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)))
        .slice(0, 5),
    [invoices],
  )

  if (loading) return <PageSkeleton />
  if (isEmpty) return <EmptyState />

  const firstName = (profile?.displayName || '').split(' ')[0]

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <span className="eyebrow">
            {formatDate(new Date(), lang)} · {company?.name || '—'}
          </span>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {t('dashboard.greeting')}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="page-sub">{t('dashboard.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn--ghost btn--sm" onClick={refresh} disabled={computing}>
            <RefreshCw size={14} strokeWidth={2.4} className={computing ? 'spin' : ''} />
            {computing ? t('common.computing') : t('common.refresh')}
          </button>
          <button className="btn btn--brand btn--sm" onClick={() => navigate('/app/invoices')}>
            {t('invoices.upload')}
          </button>
        </div>
      </div>

      {!apiOnline && (
        <div className="notice notice--warn" style={{ marginBottom: 18 }}>
          <strong>{t('common.offline')}</strong> — {t('common.offlineHint')}
        </div>
      )}

      <div className="kpi-grid">
        {stats.map((s, i) => (
          // Exact figures below a million: a business owner reads these as money,
          // and "₺218 B" hides ₺218.430. Compact only when it would overflow.
          <StatCard key={s.label} {...s} index={i} format={(v) => cur(v, { compact: Math.abs(v) >= 1e6 })} />
        ))}
      </div>

      <div className="dash-grid">
        {/* Cash flow */}
        <motion.section className="panel dash-cashflow" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('dashboard.cashflowTitle')}</div>
              <div className="panel-sub">{t('dashboard.cashflowSub')}</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span className="legend__left" style={{ fontSize: 12.5 }}>
                <span className="legend__swatch" style={{ background: 'var(--c-emerald)' }} />
                {t('dashboard.income')}
              </span>
              <span className="legend__left" style={{ fontSize: 12.5 }}>
                <span className="legend__swatch" style={{ background: 'var(--c-coral)' }} />
                {t('dashboard.expense')}
              </span>
            </div>
          </div>
          <AreaChart
            data={monthly}
            labels={monthLabels}
            keys={['income', 'expense']}
            colors={['var(--c-emerald)', 'var(--c-coral)']}
            seriesNames={[t('dashboard.income'), t('dashboard.expense')]}
            formatValue={(v) => cur(v)}
            formatAxis={compact}
            height={260}
          />
        </motion.section>

        {/* Expense split */}
        <motion.section className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.28 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('dashboard.breakdownTitle')}</div>
              <div className="panel-sub">{t('dashboard.breakdownSub')}</div>
            </div>
          </div>
          {donutData.length ? (
            <>
              <DonutChart data={donutData} centerLabel={t('dashboard.kpiExpense')} formatValue={compact} />
              <div className="legend" style={{ marginTop: 22 }}>
                {donutData.map((d) => (
                  <div className="legend__row" key={d.key}>
                    <span className="legend__left">
                      <span className="legend__swatch" style={{ background: d.color }} />
                      {d.label}
                    </span>
                    <span className="legend__val">{cur(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="chart-empty" style={{ height: 200 }}>{t('common.none')}</div>
          )}
        </motion.section>

        {/* Assistant insight — generated from this month's actual figures */}
        <motion.section className="insight-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.34 }}>
          <div className="insight-card__glow" />
          <div className="insight-card__head">
            <span className="insight-card__icon">
              <Sparkles size={17} strokeWidth={2.3} />
            </span>
            <span>{t('dashboard.insightTitle')}</span>
            <Badge tone="green" dot>{t('common.ai')}</Badge>
          </div>
          <p className="insight-card__body">{dashboard?.insight || t('dashboard.insightBody')}</p>
          <button className="insight-card__action" onClick={() => navigate('/app/assistant')}>
            {t('dashboard.insightAction')}
            <ArrowRight size={15} strokeWidth={2.4} />
          </button>
        </motion.section>

        {/* Compliance & risk — rule checks over the same snapshot. Nothing is
            stored, so an alert disappears as soon as the invoice is corrected. */}
        <motion.section className="panel dash-compliance" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.36 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('dashboard.compliance.title')}</div>
              <div className="panel-sub">{t('dashboard.compliance.sub')}</div>
            </div>
            {compliance?.total ? (
              <Badge tone={compliance.high ? 'red' : 'amber'}>{compliance.total}</Badge>
            ) : (
              <ShieldCheck size={20} color={compliance ? 'var(--c-emerald)' : 'var(--ink-4)'} />
            )}
          </div>

          {!compliance ? (
            <div className="chart-empty" style={{ height: 120 }}>
              {t('dashboard.compliance.offline')}
            </div>
          ) : compliance.total === 0 ? (
            <div className="alert-clean">
              <ShieldCheck size={18} strokeWidth={2.2} />
              <span>{t('dashboard.compliance.clean')}</span>
            </div>
          ) : (
            <>
              <ul className="alert-list">
                {compliance.alerts.slice(0, ALERTS_SHOWN).map((a, i) => {
                  const invoice = a.ref_id ? invoiceById.get(a.ref_id) : null
                  return (
                    <li className={`alert-row alert-row--${a.severity}`} key={`${a.type}-${a.ref_id ?? ''}-${i}`}>
                      <span className="alert-row__mark" />
                      <div className="alert-row__body">
                        <div className="alert-row__head">
                          <ShieldAlert size={14} strokeWidth={2.3} />
                          <span className="alert-row__type">{t(`dashboard.compliance.type.${a.type}`)}</span>
                          <Badge tone={SEVERITY_TONE[a.severity]}>
                            {t(`dashboard.compliance.sev.${a.severity}`)}
                          </Badge>
                        </div>
                        <p className="alert-row__text">{a.description}</p>
                        {invoice && (
                          <button className="link-btn" onClick={() => navigate('/app/invoices')}>
                            {t('dashboard.compliance.openInvoice')}
                            {invoice.number && <span className="alert-row__ref">· {invoice.number}</span>}
                            <ArrowUpRight size={13} strokeWidth={2.4} />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {compliance.total > ALERTS_SHOWN && (
                <p className="alert-more">
                  +{compliance.total - ALERTS_SHOWN} {t('dashboard.compliance.more')}
                </p>
              )}
            </>
          )}
        </motion.section>

        {/* Muhai Score */}
        <motion.section className="panel dash-score" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.38 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">Muhai Score</div>
              <div className="panel-sub">
                {score
                  ? `${lang === 'en' ? 'Cash runway' : 'Nakit pisti'} · ${Math.round(score.cash_runway_days)} ${lang === 'en' ? 'days' : 'gün'}`
                  : t('common.computing')}
              </div>
            </div>
          </div>
          {score ? (
            <div className="score-row">
              <ScoreGauge score={score.total_score} rating={score.rating} label="/ 100" />
              <ul className="score-cats">
                {score.categories
                  .slice()
                  .sort((a, b) => a.score - b.score)
                  .slice(0, 4)
                  .map((c) => (
                    <li key={c.key}>
                      <span className="score-cats__label">{c.label}</span>
                      <span className="score-cats__bar">
                        <motion.i
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(c.score * 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.4 }}
                          style={{
                            background:
                              c.score > 0.75 ? 'var(--c-emerald)' : c.score > 0.45 ? 'var(--c-amber)' : 'var(--c-coral)',
                          }}
                        />
                      </span>
                      <span className="score-cats__val tnum">{Math.round(c.score * 100)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <div className="chart-empty" style={{ height: 160 }}>{t('common.offline')}</div>
          )}
          {score?.recommendations?.length ? (
            <p className="score-reco">{score.recommendations[0]}</p>
          ) : null}
        </motion.section>

        {/* Prophet forecast */}
        <motion.section className="panel dash-forecast" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.42 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{lang === 'en' ? '30-day cash-flow forecast' : '30 günlük nakit akışı tahmini'}</div>
              <div className="panel-sub">
                {forecast
                  ? `${forecast.engine === 'prophet' ? 'Prophet' : lang === 'en' ? 'Moving average' : 'Hareketli ortalama'} · ${forecast.history_points} ${lang === 'en' ? 'points' : 'veri noktası'} · %80 ${lang === 'en' ? 'interval' : 'güven aralığı'}`
                  : t('common.computing')}
              </div>
            </div>
            {forecast && (
              <span className={`delta ${forecast.projected_net >= 0 ? 'delta--pos' : 'delta--neg'}`}>
                {cur(forecast.projected_net, { compact: true })}
              </span>
            )}
          </div>
          <ForecastChart
            points={forecast?.points ?? []}
            formatValue={(v) => cur(v)}
            formatAxis={compact}
            formatDate={(d) => {
              const dt = new Date(d)
              return `${dt.getDate()} ${MONTHS[lang][dt.getMonth()]}`
            }}
            emptyLabel={t('common.offline')}
            height={230}
          />
        </motion.section>

        {/* Tax calendar */}
        <motion.section className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.46 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('dashboard.taxWidgetTitle')}</div>
              <div className="panel-sub">{t('dashboard.taxWidgetSub')}</div>
            </div>
            <CalendarClock size={20} color="var(--ink-4)" />
          </div>
          <div className="tax-timeline">
            {(dashboard?.deadlines ?? []).map((it) => (
              <div className="tax-timeline__row" key={`${it.type}-${it.due_date}`}>
                <div className="tax-timeline__date">
                  <span className="tax-timeline__day">{new Date(it.due_date).getDate()}</span>
                  <span className="tax-timeline__mon">{MONTHS[lang][new Date(it.due_date).getMonth()]}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{it.name}</div>
                  <div className="tnum" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                    {it.days_remaining} {lang === 'en' ? 'days left' : 'gün kaldı'}
                  </div>
                </div>
                <Badge tone={it.is_due_soon ? 'red' : 'amber'}>
                  {it.is_due_soon ? t('tax.stDue') : t('tax.stDraft')}
                </Badge>
              </div>
            ))}
            {!dashboard?.deadlines?.length && <div className="chart-empty" style={{ height: 120 }}>{t('common.offline')}</div>}
          </div>
        </motion.section>

        {/* Recent invoices */}
        <motion.section className="panel dash-invoices" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('dashboard.recentTitle')}</div>
              <div className="panel-sub">{t('dashboard.recentSub')}</div>
            </div>
            <button className="link-btn" onClick={() => navigate('/app/invoices')}>
              {t('common.viewAll')} <ArrowUpRight size={14} strokeWidth={2.4} />
            </button>
          </div>
          <div className="tbl-scroll">
            <table className="tbl">
            <thead>
              <tr>
                <th>{t('invoices.colVendor')}</th>
                <th>{t('invoices.colNo')}</th>
                <th>{t('invoices.colDate')}</th>
                <th className="num">{t('invoices.colAmount')}</th>
                <th>{t('invoices.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((inv) => (
                <tr key={inv.id}>
                  <td className="strong">{inv.vendor}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{inv.number}</td>
                  <td>{formatDate(inv.issueDate, lang)}</td>
                  <td className="num strong">{cur(inv.amount)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[inv.status]}>
                      {t(`invoices.st${inv.status[0].toUpperCase()}${inv.status.slice(1)}`)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
