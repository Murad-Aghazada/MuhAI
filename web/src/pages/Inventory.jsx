import { motion } from 'framer-motion'
import { Boxes, Wallet, AlertTriangle, RefreshCw, Plus } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { formatCurrency, formatNumber, WEEKDAYS } from '../lib/format.js'
import { inventoryKpis, stockMovements, products, topMoved } from '../data/mockData.js'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'
import BarChart from '../components/charts/BarChart.jsx'

const STATUS_TONE = { in: 'green', low: 'amber', out: 'red' }
const STATUS_KEY = { in: 'stIn', low: 'stLow', out: 'stOut' }

export default function Inventory() {
  const { t, lang } = useLang()
  const cur = (v, o) => formatCurrency(v, lang, o)
  const num = (v) => formatNumber(v, lang)

  const stats = [
    { icon: Boxes, label: t('inventory.kpiSku'), value: inventoryKpis.sku, format: (v) => Math.round(v).toString() },
    { icon: Wallet, label: t('inventory.kpiValue'), value: inventoryKpis.value, format: (v) => cur(v, { compact: true }), sparkColor: 'var(--c-emerald)' },
    { icon: AlertTriangle, label: t('inventory.kpiLow'), value: inventoryKpis.low, format: (v) => Math.round(v).toString(), sparkColor: 'var(--c-coral)' },
    { icon: RefreshCw, label: t('inventory.kpiTurnover'), value: inventoryKpis.turnover, format: (v) => `${v.toFixed(1)}×`, sparkColor: 'var(--c-sky)' },
  ]

  const maxMoved = Math.max(...topMoved.map((m) => m.moved))

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <span className="eyebrow">{t('nav.groupMain')}</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>{t('inventory.title')}</h1>
          <p className="page-sub">{t('inventory.subtitle')}</p>
        </div>
        <button className="btn btn--brand btn--sm"><Plus size={16} /> {t('inventory.addProduct')}</button>
      </div>

      <div className="kpi-grid">
        {stats.map((s, i) => <StatCard key={s.label} {...s} index={i} />)}
      </div>

      <div className="inv-grid">
        <motion.section className="panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">{t('inventory.movementsTitle')}</div>
              <div className="panel-sub">{t('inventory.movementsSub')}</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span className="legend__left" style={{ fontSize: 12.5 }}><span className="legend__swatch" style={{ background: 'var(--c-emerald)' }} />{t('inventory.inbound')}</span>
              <span className="legend__left" style={{ fontSize: 12.5 }}><span className="legend__swatch" style={{ background: 'var(--c-amber)' }} />{t('inventory.outbound')}</span>
            </div>
          </div>
          <BarChart
            data={stockMovements}
            labels={WEEKDAYS[lang]}
            keys={['inbound', 'outbound']}
            colors={['var(--c-emerald)', 'var(--c-amber)']}
            seriesNames={[t('inventory.inbound'), t('inventory.outbound')]}
            formatValue={(v) => `${num(v)} ${t('inventory.units')}`}
            height={236}
          />
        </motion.section>

        <motion.section className="panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <div className="panel-head">
            <div className="panel-title">{t('inventory.topTitle')}</div>
          </div>
          <div className="hbar-list">
            {topMoved.map((m, i) => (
              <div className="hbar" key={m.name}>
                <div className="hbar__top">
                  <span className="hbar__name">{m.name}</span>
                  <span className="hbar__val mono">{num(m.moved)}</span>
                </div>
                <div className="hbar__track">
                  <motion.div className="hbar__fill" initial={{ width: 0 }} animate={{ width: `${(m.moved / maxMoved) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 + i * 0.08 }} />
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      <section className="panel" style={{ marginTop: 18, padding: '22px 0 8px' }}>
        <div className="panel-head" style={{ padding: '0 22px' }}>
          <div className="panel-title">{t('inventory.tableTitle')}</div>
          <button className="btn btn--ghost btn--sm">{t('common.filter')}</button>
        </div>
        <div style={{ padding: '0 6px' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('inventory.colProduct')}</th>
                <th>{t('inventory.colSku')}</th>
                <th className="num">{t('inventory.colStock')}</th>
                <th className="num">{t('inventory.colPrice')}</th>
                <th>{t('inventory.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.sku}>
                  <td className="strong">{p.name}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{p.sku}</td>
                  <td className="num strong">{num(p.stock)}</td>
                  <td className="num">{cur(p.price)}</td>
                  <td><Badge tone={STATUS_TONE[p.status]}>{t(`inventory.${STATUS_KEY[p.status]}`)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
