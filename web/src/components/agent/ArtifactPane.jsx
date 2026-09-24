/* ============================================================
   The report pane — the right half of the split view.

   It renders the *same* blocks the thread does, through the same
   `AgentBlocks`, and the PDF renders them again server-side. One
   schema, three renderers, no parsing between them.

   The pane is a document, not a card: a masthead with the company
   and the period, then the sections. What it must never become is
   a second chat — it has no composer and no scroll-linked state,
   because the whole point is that the thread can move while the
   report stays put.
   ============================================================ */
import { useState } from 'react'
import { Download, Loader2, Printer, X } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { fetchPdf } from '../../lib/agent.js'
import AgentBlocks from './AgentBlocks.jsx'

export default function ArtifactPane({ artifact, loading, error, pdf = true, onClose }) {
  const { t } = useLang()
  const { company } = useData()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  const download = async () => {
    if (!artifact || downloading) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const { blob, filename } = await fetchPdf(artifact.id)
      // An object URL rather than a token in a query string — see the note on
      // `fetchPdf`. Revoked on the next tick: Chrome needs the URL to survive
      // the click, and never revoking leaks the whole blob for the session.
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (err) {
      setDownloadError(err.message || t('agent.pdfFailed'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="agent-pane" aria-label={t('agent.reportPane')}>
      <header className="agent-pane__bar">
        <span className="agent-pane__label">{t('agent.report')}</span>
        <div className="agent-pane__acts">
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => window.print()}
            disabled={!artifact}
          >
            <Printer size={14} strokeWidth={1.7} />
            {t('agent.print')}
          </button>
          {/* Dark: it is the act in this pane, and the only one. Hidden
              outright when the server says it cannot render a PDF — a
              disabled button invites a click and explains nothing. */}
          {pdf && (
            <button
              className="btn btn--primary btn--sm"
              onClick={download}
              disabled={!artifact || downloading}
            >
              {downloading ? (
                <Loader2 size={14} strokeWidth={1.9} className="agent-spin" />
              ) : (
                <Download size={14} strokeWidth={1.8} />
              )}
              {t('agent.downloadPdf')}
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="agent-pane__scroll">
        {loading && <div className="agent-pane__state">{t('common.loading')}</div>}
        {error && !loading && <div className="agent-pane__state is-bad">{error}</div>}

        {artifact && !loading && (
          <article className="agent-doc">
            <header className="agent-doc__mast">
              <div className="agent-doc__brand">
                Muhai · {company?.name || '—'}
              </div>
              <h2 className="agent-doc__title">{artifact.title}</h2>
              {artifact.subtitle ? (
                <p className="agent-doc__sub">{artifact.subtitle}</p>
              ) : null}
              <div className="agent-doc__meta">
                {artifact.period ? <span>{artifact.period}</span> : null}
                <span>
                  {new Date(artifact.createdAt || Date.now()).toLocaleDateString('tr-TR')}
                </span>
              </div>
            </header>

            <AgentBlocks blocks={artifact.blocks} />

            <p className="agent-doc__foot">{t('agent.reportFooter')}</p>
          </article>
        )}

        {downloadError && <div className="agent-pane__state is-bad">{downloadError}</div>}
      </div>
    </section>
  )
}
