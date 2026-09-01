import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ReceiptText, Clock, CheckCircle2, ScanLine, UploadCloud, FileText, Sparkles, AlertCircle } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { formatCurrency, formatDate } from '../lib/format.js'
import { allInvoices, invoiceKpis, ocrSample } from '../data/mockData.js'
import { runOcr } from '../lib/ocr.js'
import StatCard from '../components/ui/StatCard.jsx'
import Badge from '../components/ui/Badge.jsx'

const STATUS_TONE = { paid: 'green', pending: 'amber', overdue: 'red' }

export default function Invoices() {
  const { t, lang } = useLang()
  const cur = (v) => (v == null ? '—' : formatCurrency(v, lang, { decimals: Number.isInteger(v) ? 0 : 2 }))

  const [phase, setPhase] = useState('idle') // idle | scanning | done
  const [source, setSource] = useState(null) // 'demo' | 'file'
  const [imageUrl, setImageUrl] = useState(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)
  const timers = useRef([])

  const reset = () => {
    timers.current.forEach(clearTimeout)
    setError(null)
  }

  // --- Real OCR on an uploaded image ---
  const handleFile = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith('image/')) return
      reset()
      const url = URL.createObjectURL(file)
      setSource('file')
      setImageUrl(url)
      setResult(null)
      setProgress(0)
      setPhase('scanning')
      try {
        const { fields, confidence, text } = await runOcr(file, (p) => setProgress(Math.round(p * 100)))
        setResult({ ...fields, confidence, rawText: text, lineItems: null })
        setPhase('done')
      } catch (e) {
        console.error('[muhai] OCR failed', e)
        setError(t('invoices.ocrError'))
        setPhase('idle')
      }
    },
    [t],
  )

  // --- Simulated demo (no image handy) ---
  const runDemo = () => {
    reset()
    setSource('demo')
    setImageUrl(null)
    setResult(null)
    setPhase('scanning')
    timers.current = [
      setTimeout(() => setProgress(60), 900),
      setTimeout(() => {
        setResult({ ...ocrSample, rawText: null })
        setPhase('done')
      }, 2600),
    ]
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }

  const stats = [
    { icon: ReceiptText, label: t('invoices.kpiTotal'), value: invoiceKpis.total, format: (v) => Math.round(v).toString() },
    { icon: Clock, label: t('invoices.kpiPending'), value: invoiceKpis.pending, format: (v) => Math.round(v).toString(), sparkColor: 'var(--c-amber)' },
    { icon: CheckCircle2, label: t('invoices.kpiPaid'), value: invoiceKpis.paid, format: (v) => Math.round(v).toString() },
    { icon: ScanLine, label: t('invoices.kpiOcr'), value: invoiceKpis.ocr, format: (v) => `${v.toFixed(1)}%` },
  ]

  const scanning = phase === 'scanning'

  return (
    <div className="page">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />

      <div className="page-head page-head-row">
        <div>
          <span className="eyebrow">{t('nav.groupMain')}</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>{t('invoices.title')}</h1>
          <p className="page-sub">{t('invoices.subtitle')}</p>
        </div>
        <button className="btn btn--brand btn--sm" onClick={() => fileRef.current?.click()}>
          <UploadCloud size={16} /> {t('invoices.upload')}
        </button>
      </div>

      <div className="kpi-grid">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} index={i} />
        ))}
      </div>

      {/* OCR scanner */}
      <div className="ocr-grid">
        <section className="panel ocr-stage">
          <div className="panel-head">
            <div>
              <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ScanLine size={18} color="var(--brand-deep)" /> {t('invoices.scanTitle')}
              </div>
              <div className="panel-sub">{t('invoices.scanSub')}</div>
            </div>
            <Badge tone="green">Tesseract 5.0 · CNN</Badge>
          </div>

          <div
            className={`ocr-dropzone ${scanning || dragging ? 'ocr-dropzone--active' : ''}`}
            onClick={phase === 'idle' ? () => fileRef.current?.click() : undefined}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {imageUrl ? (
              /* real uploaded invoice */
              <div className="ocr-doc ocr-doc--image">
                <img src={imageUrl} alt="invoice" />
                {scanning && <motion.div className="ocr-scanline" animate={{ top: ['2%', '96%', '2%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />}
                {phase === 'done' && <div className="ocr-doc__check"><CheckCircle2 size={26} /></div>}
              </div>
            ) : (
              /* faux invoice (demo / idle) */
              <div className="ocr-doc">
                <div className="ocr-doc__head">
                  <div className="ocr-doc__logo" />
                  <div className="ocr-doc__lines"><span style={{ width: '70%' }} /><span style={{ width: '45%' }} /></div>
                </div>
                {[88, 72, 80, 60, 76].map((w, i) => (
                  <div className="ocr-doc__row" key={i}><span style={{ width: `${w}%` }} /><span style={{ width: '18%' }} /></div>
                ))}
                <div className="ocr-doc__total"><span style={{ width: '30%' }} /><span style={{ width: '22%' }} /></div>
                {scanning && source === 'demo' && <motion.div className="ocr-scanline" animate={{ top: ['4%', '94%', '4%'] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} />}
              </div>
            )}

            <div className="ocr-hint">
              {phase === 'idle' && !error && (
                <>
                  <UploadCloud size={22} />
                  <span>{t('invoices.dropHere')}</span>
                  <small>{t('invoices.dropOr')}</small>
                </>
              )}
              {phase === 'idle' && error && (
                <span className="ocr-status" style={{ color: 'var(--neg)' }}><AlertCircle size={18} /> {error}</span>
              )}
              {scanning && (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <span className="ocr-status">
                    <span className="ocr-spinner" />
                    {source === 'file'
                      ? progress > 0
                        ? `${t('invoices.recognizing')} · %${progress}`
                        : t('invoices.preparing')
                      : progress > 0
                        ? t('invoices.detecting')
                        : t('invoices.scanning')}
                  </span>
                  {source === 'file' && (
                    <div className="ocr-progress"><motion.div className="ocr-progress__bar" animate={{ width: `${Math.max(progress, 6)}%` }} transition={{ ease: 'linear' }} /></div>
                  )}
                </div>
              )}
              {phase === 'done' && <span className="ocr-status ocr-status--done"><CheckCircle2 size={18} /> {t('invoices.extracted')}</span>}
            </div>
          </div>

          {phase === 'idle' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
                <UploadCloud size={16} /> {t('invoices.upload')}
              </button>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={runDemo}>
                <ScanLine size={16} /> {t('invoices.runDemo')}
              </button>
            </div>
          )}
        </section>

        {/* Extracted result */}
        <section className="panel">
          <div className="panel-head">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={17} color="var(--brand-deep)" /> {t('invoices.extracted')}
            </div>
            {phase === 'done' && result && (
              <div style={{ display: 'flex', gap: 8 }}>
                {source === 'file' && <Badge tone="sky">{t('invoices.realBadge')}</Badge>}
                <Badge tone="green">{t('invoices.confidence')} {result.confidence}%</Badge>
              </div>
            )}
          </div>

          {phase !== 'done' || !result ? (
              <div className="ocr-empty">
                <FileText size={30} strokeWidth={1.6} />
                <p>{lang === 'en' ? 'Extracted fields will appear here after scanning.' : 'Taranan alanlar burada görünecek.'}</p>
              </div>
            ) : (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="ocr-fields">
                  <Field label={t('invoices.vendor')} value={result.vendor} delay={0} />
                  <Field label={t('invoices.invoiceNo')} value={result.invoiceNo} mono delay={0.05} />
                  <Field label={t('invoices.taxId')} value={result.taxId} mono delay={0.1} />
                </div>

                {result.lineItems && (
                  <div className="ocr-items">
                    {result.lineItems.map((li, i) => (
                      <motion.div className="ocr-item" key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.07 }}>
                        <span>{li.name}</span>
                        <span className="mono muted">×{li.qty}</span>
                        <span className="mono strong">{cur(li.total)}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                <div className="ocr-summary">
                  <Row label={t('invoices.subtotal')} value={cur(result.subtotal)} />
                  <Row label={t('invoices.vat')} value={cur(result.vat)} />
                  <Row label={t('invoices.total')} value={cur(result.total)} total />
                </div>

                {result.rawText && (
                  <details className="ocr-rawtext">
                    <summary>{t('invoices.rawText')}</summary>
                    <pre>{result.rawText.trim()}</pre>
                  </details>
                )}
              </motion.div>
            )}
        </section>
      </div>

      {/* Table */}
      <section className="panel" style={{ marginTop: 18, padding: '22px 0 8px' }}>
        <div className="panel-head" style={{ padding: '0 22px' }}>
          <div className="panel-title">{t('invoices.tableTitle')}</div>
          <button className="btn btn--ghost btn--sm">{t('common.filter')}</button>
        </div>
        <div style={{ padding: '0 6px' }}>
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
              {allInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="strong">{inv.vendor}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{inv.id}</td>
                  <td>{formatDate(inv.date, lang)}</td>
                  <td className="num strong">{formatCurrency(inv.amount, lang)}</td>
                  <td><Badge tone={STATUS_TONE[inv.status]}>{t(`invoices.st${inv.status[0].toUpperCase() + inv.status.slice(1)}`)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Field({ label, value, mono, delay }) {
  return (
    <motion.div className="ocr-field" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <span className="ocr-field__label">{label}</span>
      <span className={`ocr-field__value ${mono ? 'mono' : ''}`}>{value}</span>
    </motion.div>
  )
}

function Row({ label, value, total }) {
  return (
    <div className={`ocr-row ${total ? 'ocr-row--total' : ''}`}>
      <span>{label}</span>
      <span className="mono">{value}</span>
    </div>
  )
}
