import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Receipt, Percent, Landmark, CalendarClock, FileCheck2 } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { formatCurrency, formatDate, MONTHS } from '../lib/format.js'
import { taxKpis, taxBreakdown, taxTimeline, filings } from '../data/mockData.js'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import DonutChart from '../components/charts/DonutChart.jsx'

const FILING_TONE = { filed: 'green', draft: 'gray', due: 'red' }
const RATES = [1, 10, 20]

export default function Tax() {
  const { t, lang } = useLang()
  const cur = (v, o) => formatCurrency(v, lang, o)
  const [gross, setGross] = useState(10000)
  const [rate, setRate] = useState(20)

  const calc = useMemo(() => {
    const g = Number(gross) || 0
    const net = g / (1 + rate / 100)
    const vat = g - net
    return { net, vat, gross: g }
  }, [gross, rate])

  const stats = [
    { icon: Receipt, label: t('tax.kpiVat'), value: taxKpis.vat, format: (v) => cur(v), sparkColor: 'var(--c-emerald)' },
    { icon: Percent, label: t('tax.kpiWithholding'), value: taxKpis.withholding, format: (v) => cur(v), sparkColor: 'var(--c-amber)' },
    { icon: Landmark, label: t('tax.kpiIncome'), value: taxKpis.income, format: (v) => cur(v), sparkColor: 'var(--c-sky)' },
    { icon: CalendarClock, label: t('tax.kpiNext'), value: taxKpis.nextDays, format: (v) => `${Math.round(v)} ${t('tax.days')}`, sparkColor: 'var(--c-coral)' },
  ]

  const donut = taxBreakdown.map((d) => ({ ...d, label: lang === 'en' ? d.labelEn : d.label }))

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <span className="eyebrow">{t('nav.groupMain')}</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>{t('tax.title')}</h1>
          <p className="page-sub">{t('tax.subtitle')}</p>
        </div>
        <button className="btn btn--brand btn--sm"><FileCheck2 size={16} /> {t('tax.prepare')}</button>
      </div>

      <div className="kpi-grid">
        {stats.map((s, i) => <StatCard key={s.label} {...s} index={i} />)}
      </div>

      <div className="tax-grid">
        {/* Calculator */}
        <motion.section className="panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('tax.calcTitle')}</div>
              <div className="panel-sub">{t('tax.calcSub')}</div>
            </div>
          </div>

          <label className="calc-label">{t('tax.calcAmount')}</label>
          <div className="calc-input">
            <span>₺</span>
            <input type="number" value={gross} onChange={(e) => setGross(e.target.value)} min="0" />
          </div>

          <label className="calc-label" style={{ marginTop: 18 }}>{t('tax.calcRate')}</label>
          <div className="calc-rates">
            {RATES.map((r) => (
              <button key={r} className={`calc-rate ${rate === r ? 'calc-rate--active' : ''}`} onClick={() => setRate(r)}>
                %{r}
              </button>
            ))}
          </div>

          <div className="calc-results">
            <ResultRow label={t('tax.calcNet')} value={cur(calc.net, { decimals: 2 })} />
            <ResultRow label={t('tax.calcVat')} value={cur(calc.vat, { decimals: 2 })} accent />
            <ResultRow label={t('tax.calcGross')} value={cur(calc.gross, { decimals: 2 })} total />
          </div>
        </motion.section>

        {/* Timeline */}
        <motion.section className="panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('tax.timelineTitle')}</div>
              <div className="panel-sub">{t('tax.timelineSub')}</div>
            </div>
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
                <Badge tone={it.status === 'due' ? 'red' : 'amber'}>{it.status === 'due' ? t('tax.stDue') : t('tax.stDraft')}</Badge>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Burden donut */}
        <motion.section className="panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <div className="panel-head">
            <div className="panel-title">{t('tax.breakdownTitle')}</div>
          </div>
          <DonutChart data={donut} centerLabel={lang === 'en' ? 'Total' : 'Toplam'} formatValue={(v) => cur(v, { compact: true })} size={184} />
          <div className="legend" style={{ marginTop: 18 }}>
            {donut.map((d) => (
              <div className="legend__row" key={d.key}>
                <span className="legend__left"><span className="legend__swatch" style={{ background: d.color }} />{d.label}</span>
                <span className="legend__val">{cur(d.value)}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Filings table */}
      <section className="panel" style={{ marginTop: 18, padding: '22px 0 8px' }}>
        <div className="panel-head" style={{ padding: '0 22px' }}>
          <div className="panel-title">{t('tax.filingsTitle')}</div>
          <button className="btn btn--ghost btn--sm">{t('common.export')}</button>
        </div>
        <div style={{ padding: '0 6px' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('tax.colPeriod')}</th>
                <th>{t('tax.colType')}</th>
                <th className="num">{t('tax.colAmount')}</th>
                <th>{t('tax.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f, i) => (
                <tr key={i}>
                  <td className="mono strong">{f.period}</td>
                  <td>{lang === 'en' ? f.typeEn : f.type}</td>
                  <td className="num strong">{cur(f.amount)}</td>
                  <td><Badge tone={FILING_TONE[f.status]}>{t(`tax.st${f.status[0].toUpperCase() + f.status.slice(1)}`)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function ResultRow({ label, value, accent, total }) {
  return (
    <div className={`calc-result ${total ? 'calc-result--total' : ''} ${accent ? 'calc-result--accent' : ''}`}>
      <span>{label}</span>
      <motion.span key={value} className="mono" initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }}>{value}</motion.span>
    </div>
  )
}
