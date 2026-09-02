import { motion } from 'framer-motion'
import { Wallet, CreditCard, TrendingUp, Landmark, ArrowUpRight, Sparkles, CalendarClock, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n/LanguageContext.jsx'
import { formatCurrency, formatDate, MONTHS } from '../lib/format.js'
import { cashflow, kpis, expenseBreakdown, recentInvoices, taxTimeline } from '../data/mockData.js'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import AreaChart from '../components/charts/AreaChart.jsx'
import DonutChart from '../components/charts/DonutChart.jsx'

const STATUS_TONE = { paid: 'green', pending: 'amber', overdue: 'red' }

export default function Dashboard() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const cur = (v, o) => formatCurrency(v, lang, o)

  const incomeSpark = cashflow.map((d) => d.income)
  const expenseSpark = cashflow.map((d) => d.expense)
  const profitSpark = cashflow.map((d) => d.income - d.expense)
  const taxSpark = cashflow.map((d) => Math.round(d.income * 0.146))

  const stats = [
    { icon: Wallet, label: t('dashboard.kpiRevenue'), value: kpis.revenue, delta: `${kpis.revenueDelta}%`, deltaPositive: true, spark: incomeSpark, sparkColor: 'var(--c-emerald)' },
    { icon: CreditCard, label: t('dashboard.kpiExpense'), value: kpis.expense, delta: `${kpis.expenseDelta}%`, deltaPositive: false, spark: expenseSpark, sparkColor: 'var(--c-coral)' },
    { icon: TrendingUp, label: t('dashboard.kpiProfit'), value: kpis.profit, delta: `${kpis.profitDelta}%`, deltaPositive: true, spark: profitSpark, sparkColor: 'var(--c-sky)' },
    { icon: Landmark, label: t('dashboard.kpiTax'), value: kpis.tax, delta: `${kpis.taxDelta}%`, deltaPositive: false, spark: taxSpark, sparkColor: 'var(--c-amber)' },
  ]

  const donutData = expenseBreakdown.map((e) => ({ ...e, label: t(`dashboard.cat.${e.key}`) }))

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <span className="eyebrow">{formatDate(new Date('2026-06-29'), lang)} · Atlas Ticaret Ltd.</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {t('dashboard.greeting')}, Emin 👋
          </h1>
          <p className="page-sub">{t('dashboard.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost btn--sm">{t('common.export')}</button>
          <button className="btn btn--brand btn--sm" onClick={() => navigate('/app/invoices')}>
            {t('invoices.upload')}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} index={i} format={(v) => cur(v, { compact: v > 99999 })} />
        ))}
      </div>

      {/* Main analytics grid */}
      <div className="dash-grid">
        <motion.section
          className="panel dash-cashflow"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
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
            data={cashflow}
            labels={MONTHS[lang]}
            keys={['income', 'expense']}
            colors={['var(--c-emerald)', 'var(--c-coral)']}
            seriesNames={[t('dashboard.income'), t('dashboard.expense')]}
            formatValue={(v) => cur(v)}
            height={250}
          />
        </motion.section>

        <motion.section
          className="panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
        >
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('dashboard.breakdownTitle')}</div>
              <div className="panel-sub">{t('dashboard.breakdownSub')}</div>
            </div>
          </div>
          <DonutChart data={donutData} centerLabel={t('dashboard.kpiExpense')} formatValue={(v) => cur(v, { compact: true })} />
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
        </motion.section>

        {/* Assistant insight */}
        <motion.section
          className="insight-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.34 }}
        >
          <div className="insight-card__glow" />
          <div className="insight-card__head">
            <span className="insight-card__icon">
              <Sparkles size={17} strokeWidth={2.3} />
            </span>
            <span>{t('dashboard.insightTitle')}</span>
            <Badge tone="green" dot>
              {t('common.ai')}
            </Badge>
          </div>
          <p className="insight-card__body">{t('dashboard.insightBody')}</p>
          <button className="insight-card__action" onClick={() => navigate('/app/assistant')}>
            {t('dashboard.insightAction')}
            <ArrowRight size={15} strokeWidth={2.4} />
          </button>
        </motion.section>

        {/* Tax calendar */}
        <motion.section
          className="panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('dashboard.taxWidgetTitle')}</div>
              <div className="panel-sub">{t('dashboard.taxWidgetSub')}</div>
            </div>
            <CalendarClock size={20} color="var(--ink-4)" />
          </div>
          <div className="tax-timeline">
            {taxTimeline.map((it, i) => (
              <div className="tax-timeline__row" key={i}>
                <div className="tax-timeline__date">
                  <span className="tax-timeline__day">{new Date(it.date).getDate()}</span>
                  <span className="tax-timeline__mon">{MONTHS[lang][new Date(it.date).getMonth()]}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13.5 }}>{lang === 'en' ? it.typeEn : it.type}</div>
                  <div className="tnum" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{cur(it.amount)}</div>
                </div>
                <Badge tone={it.status === 'due' ? 'red' : 'amber'}>
                  {it.status === 'due' ? t('tax.stDue') : t('tax.stDraft')}
                </Badge>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Recent invoices */}
        <motion.section
          className="panel dash-invoices"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.46 }}
        >
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('dashboard.recentTitle')}</div>
              <div className="panel-sub">{t('dashboard.recentSub')}</div>
            </div>
            <button className="link-btn" onClick={() => navigate('/app/invoices')}>
              {t('common.viewAll')} <ArrowUpRight size={14} strokeWidth={2.4} />
            </button>
          </div>
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
              {recentInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="strong">{inv.vendor}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{inv.id}</td>
                  <td>{formatDate(inv.date, lang)}</td>
                  <td className="num strong">{cur(inv.amount)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[inv.status]}>{t(`invoices.st${inv.status[0].toUpperCase() + inv.status.slice(1)}`)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.section>
      </div>
    </div>
  )
}
