import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Wallet, ShieldCheck, BadgeDollarSign, CheckCircle2, Play } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { formatCurrency } from '../lib/format.js'
import { payrollKpis, payrollBreakdown, employees } from '../data/mockData.js'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import DonutChart from '../components/charts/DonutChart.jsx'

export default function Payroll() {
  const { t, lang } = useLang()
  const cur = (v, o) => formatCurrency(v, lang, o)
  const [run, setRun] = useState(false)

  const stats = [
    { icon: Users, label: t('payroll.kpiEmployees'), value: payrollKpis.employees, format: (v) => Math.round(v).toString() },
    { icon: Wallet, label: t('payroll.kpiGross'), value: payrollKpis.gross, format: (v) => cur(v, { compact: true }), sparkColor: 'var(--c-emerald)' },
    { icon: ShieldCheck, label: t('payroll.kpiSgk'), value: payrollKpis.sgk, format: (v) => cur(v, { compact: true }), sparkColor: 'var(--c-amber)' },
    { icon: BadgeDollarSign, label: t('payroll.kpiNet'), value: payrollKpis.net, format: (v) => cur(v, { compact: true }), sparkColor: 'var(--c-sky)' },
  ]

  const donut = payrollBreakdown.map((d) => ({ ...d, label: t(`payroll.${d.key}`) }))

  return (
    <div className="page">
      <div className="page-head">
        <span className="eyebrow">{t('nav.groupMain')}</span>
        <h1 className="page-title" style={{ marginTop: 8 }}>{t('payroll.title')}</h1>
        <p className="page-sub">{t('payroll.subtitle')}</p>
      </div>

      <div className="kpi-grid">
        {stats.map((s, i) => <StatCard key={s.label} {...s} index={i} />)}
      </div>

      <div className="pay-grid">
        {/* Run payroll */}
        <motion.section className="run-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="run-card__glow" />
          <div className="run-card__top">
            <Badge tone="green"><span className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />{t('payroll.runStatus')}</Badge>
          </div>
          <h3 className="run-card__title">{t('payroll.runTitle')}</h3>
          <p className="run-card__sub">{t('payroll.runSub')}</p>
          <div className="run-card__meta">
            <div><span className="run-card__meta-label">{t('payroll.kpiEmployees')}</span><span className="run-card__meta-val tnum">{payrollKpis.employees}</span></div>
            <div><span className="run-card__meta-label">{t('payroll.kpiNet')}</span><span className="run-card__meta-val tnum">{cur(payrollKpis.net, { compact: true })}</span></div>
          </div>
          <button className={`btn ${run ? 'btn--ghost' : 'btn--brand'}`} style={{ width: '100%', marginTop: 18 }} onClick={() => setRun(true)} disabled={run}>
            {run ? <><CheckCircle2 size={16} /> SGK ✓</> : <><Play size={15} /> {t('payroll.runButton')}</>}
          </button>
        </motion.section>

        {/* Cost breakdown */}
        <motion.section className="panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('payroll.breakdownTitle')}</div>
              <div className="panel-sub">{t('payroll.breakdownSub')}</div>
            </div>
          </div>
          <div className="pay-breakdown">
            <DonutChart data={donut} centerLabel={t('payroll.kpiGross')} formatValue={(v) => cur(v, { compact: true })} size={184} />
            <div className="legend" style={{ flex: 1 }}>
              {donut.map((d) => (
                <div className="legend__row" key={d.key}>
                  <span className="legend__left"><span className="legend__swatch" style={{ background: d.color }} />{d.label}</span>
                  <span className="legend__val">{cur(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>

      {/* Employee table */}
      <section className="panel" style={{ marginTop: 18, padding: '22px 0 8px' }}>
        <div className="panel-head" style={{ padding: '0 22px' }}>
          <div className="panel-title">{t('payroll.tableTitle')}</div>
          <button className="btn btn--ghost btn--sm">{t('common.export')}</button>
        </div>
        <div style={{ padding: '0 6px' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('payroll.colName')}</th>
                <th>{t('payroll.colRole')}</th>
                <th className="num">{t('payroll.colGross')}</th>
                <th className="num">{t('payroll.colDeductions')}</th>
                <th className="num">{t('payroll.colNet')}</th>
                <th>{t('payroll.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.name}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="emp-av">{e.name.split(' ').map((n) => n[0]).join('')}</span>
                      <span className="strong">{e.name}</span>
                    </div>
                  </td>
                  <td>{lang === 'en' ? e.roleEn : e.role}</td>
                  <td className="num">{cur(e.gross)}</td>
                  <td className="num" style={{ color: 'var(--neg)' }}>−{cur(e.deductions)}</td>
                  <td className="num strong">{cur(e.net)}</td>
                  <td><Badge tone={run || e.status === 'paid' ? 'green' : 'amber'}>{run || e.status === 'paid' ? t('payroll.stPaid') : t('payroll.stPending')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
