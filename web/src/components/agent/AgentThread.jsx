/* ============================================================
   The message stream.

   Full width, no bubbles on the assistant side. A chart or a table
   inside a rounded speech balloon reads as a screenshot someone
   pasted into a chat; the same content as a plain column reads as
   the answer. The question keeps a bubble — it is short, and it is
   the only thing that needs distinguishing.

   Two things ride under an answer:

     · the tool trace, collapsed. An answer about money has to be
       able to show what it read, and "sen bunu nereden buldun?" is
       the first thing anyone asks it.
     · a report card, if the turn wrote one. The card, not the
       report — the blocks left the stream when they were bound
       (see `ToolContext.bind_report`), because a card above the
       same six charts is the answer printed twice.
   ============================================================ */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Database, FileText, WifiOff } from 'lucide-react'
import { Spark } from '../ui/icons.jsx'
import { useLang } from '../../i18n/LanguageContext.jsx'
import AgentBlocks, { Prose } from './AgentBlocks.jsx'
import AttachmentChip, { attachmentMeta, openAttachment } from './AttachmentChip.jsx'

function ToolTrace({ calls }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  if (!calls?.length) return null

  return (
    <div className={`agent-trace${open ? ' is-open' : ''}`}>
      <button className="agent-trace__toggle" onClick={() => setOpen((v) => !v)}>
        <Database size={13} strokeWidth={1.6} />
        {t('agent.readCount').replace('{n}', calls.length)}
        <ChevronDown size={13} strokeWidth={1.8} className="agent-trace__chev" />
      </button>

      {open && (
        <ul className="agent-trace__list">
          {calls.map((call, index) => (
            <li key={index} className={call.ok === false ? 'is-bad' : undefined}>
              <code>{call.name}</code>
              <span>{call.summary}</span>
              <b className="tnum">{call.ms} ms</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReportCard({ artifact, active, onOpen }) {
  const { t } = useLang()
  return (
    <button
      className={`agent-report-card${active ? ' is-live' : ''}`}
      onClick={() => onOpen(artifact.id)}
    >
      <span className="agent-report-card__icon">
        <FileText size={17} strokeWidth={1.6} />
      </span>
      <span className="agent-report-card__body">
        <span className="agent-report-card__title">{artifact.title}</span>
        <span className="agent-report-card__meta">
          {[artifact.period, t('agent.blockCount').replace('{n}', artifact.blockCount)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="agent-report-card__cta">{t('agent.openReport')}</span>
    </button>
  )
}

/* The question: its files above it, then its words. A file sent on its own
   is a whole question, so an empty bubble is not drawn under it. */
function Question({ text, attachments }) {
  const { t, lang } = useLang()
  return (
    <div className="agent-msg__question">
      {attachments?.length > 0 && (
        <div className="agent-files agent-files--sent">
          {attachments.map((file) => (
            <AttachmentChip
              key={file.id}
              name={file.filename}
              kind={file.kind}
              meta={attachmentMeta(file, t, lang)}
              onOpen={() => openAttachment(file.id).catch(() => {})}
            />
          ))}
        </div>
      )}
      {text ? <div className="agent-msg__ask">{text}</div> : null}
    </div>
  )
}

function Message({ message, activeArtifactId, onOpenArtifact }) {
  const { t } = useLang()

  if (message.role === 'user') {
    return (
      <motion.div
        className="agent-msg agent-msg--user"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <Question text={message.content} attachments={message.attachments} />
      </motion.div>
    )
  }

  return (
    <motion.div
      className="agent-msg agent-msg--bot"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <span className="agent-msg__mark">
        <Spark size={15} strokeWidth={1.5} />
      </span>

      <div className="agent-msg__body">
        <ToolTrace calls={message.toolCalls} />
        <div className="agent-msg__prose">
          <Prose text={message.content} />
        </div>
        <AgentBlocks blocks={message.blocks} />

        {message.artifacts?.map((artifact) => (
          <ReportCard
            key={artifact.id}
            artifact={artifact}
            active={artifact.id === activeArtifactId}
            onOpen={onOpenArtifact}
          />
        ))}

        {message.source === 'offline' && (
          <div className="agent-msg__offline">
            <WifiOff size={11} strokeWidth={1.6} />
            {t('agent.offlineBadge')}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function AgentThread({
  messages,
  pending,
  thinking,
  activeArtifactId,
  onOpenArtifact,
}) {
  const { t } = useLang()
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, pending, thinking])

  return (
    <div className="agent-thread">
      <div className="agent-thread__inner">
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            activeArtifactId={activeArtifactId}
            onOpenArtifact={onOpenArtifact}
          />
        ))}

        {/* The optimistic question, drawn before the server has stored it.
            Replaced by the real row when the turn resolves. */}
        {pending && (
          <div className="agent-msg agent-msg--user">
            <Question text={pending.text} attachments={pending.attachments} />
          </div>
        )}

        {thinking && (
          <div className="agent-msg agent-msg--bot">
            <span className="agent-msg__mark">
              <Spark size={15} strokeWidth={1.5} />
            </span>
            <div className="agent-msg__body">
              <div className="agent-thinking">
                <span className="agent-dots">
                  <span />
                  <span />
                  <span />
                </span>
                {t('agent.working')}
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  )
}
