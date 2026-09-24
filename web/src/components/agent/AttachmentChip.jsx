/* ============================================================
   A file sent to the agent, as a chip.

   The same chip in the composer (while the file uploads) and in the
   thread (after it was sent), so a file looks like one thing from
   the moment it is picked. The model reads the file itself, so the
   meta line says what the file is (PDF and its pages, or an image,
   and its size) and not how the server's backup reading went.
   ============================================================ */
import { motion } from 'framer-motion'
import { AlertCircle, FileText, Image as ImageIcon, Loader2, X } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import * as agent from '../../lib/agent.js'

// In the composer a chip arrives and leaves on its own, so it animates; in
// the thread it is part of a message that already fades in, so it does not.
// "position" only: a chip changes width when its upload finishes, and a
// full layout animation would scale the text while it does.
const CHIP_MOTION = {
  layout: 'position',
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.94, transition: { duration: 0.12 } },
  transition: { duration: 0.18, ease: [0.22, 0.8, 0.3, 1] },
}

function formatSize(bytes, lang) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  const number = (value, digits) =>
    value.toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: digits })
  return mb >= 1 ? `${number(mb, 1)} MB` : `${number(Math.max(1, Math.round(bytes / 1024)), 0)} KB`
}

/** "PDF · 2 sayfa · 184 KB" / "Görsel · 1,2 MB". */
export function attachmentMeta(attachment, t, lang) {
  if (!attachment) return ''
  const parts = []
  if (attachment.kind === 'pdf') {
    parts.push('PDF')
    if (attachment.pages > 1) parts.push(t('agent.filePages').replace('{n}', attachment.pages))
  } else {
    parts.push(t('agent.fileImage'))
  }
  const size = formatSize(attachment.size, lang)
  if (size) parts.push(size)
  return parts.join(' · ')
}

/**
 * Open the stored file in a new tab.
 *
 * The tab is opened *before* the fetch, synchronously inside the click:
 * a window.open after an await is a popup as far as the browser is
 * concerned, and gets blocked.
 */
export async function openAttachment(id) {
  const tab = window.open('', '_blank')
  try {
    const url = URL.createObjectURL(await agent.fetchAttachment(id))
    if (tab) {
      tab.location.href = url
    } else {
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener'
      link.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (err) {
    tab?.close()
    throw err
  }
}

export default function AttachmentChip({
  name,
  kind,
  status = 'ready',
  meta,
  error,
  onOpen,
  onRemove,
  animated = false,
}) {
  const { t } = useLang()
  const Icon = kind === 'pdf' ? FileText : ImageIcon
  const busy = status === 'uploading'
  const failed = status === 'error'
  const Root = animated ? motion.span : 'span'

  return (
    <Root
      className={`agent-file${busy ? ' is-busy' : ''}${failed ? ' is-bad' : ''}`}
      {...(animated ? CHIP_MOTION : {})}
    >
      <span className="agent-file__icon">
        {busy ? (
          <Loader2 size={15} strokeWidth={1.8} className="spin" />
        ) : failed ? (
          <AlertCircle size={15} strokeWidth={1.8} />
        ) : (
          <Icon size={15} strokeWidth={1.6} />
        )}
      </span>

      <span className="agent-file__body">
        {onOpen && !busy && !failed ? (
          <button type="button" className="agent-file__name" onClick={onOpen} title={t('agent.openFile')}>
            {name}
          </button>
        ) : (
          <span className="agent-file__name">{name}</span>
        )}
        <span className="agent-file__meta">
          {busy ? t('agent.fileReading') : failed ? error : meta}
        </span>
      </span>

      {onRemove && (
        <button
          type="button"
          className="agent-file__remove"
          onClick={onRemove}
          aria-label={t('agent.fileRemove')}
        >
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </Root>
  )
}
