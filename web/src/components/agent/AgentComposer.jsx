/* ============================================================
   The composer.

   Centred on the same measure as the thread, so the input sits
   directly under the answer rather than under the whole window.
   Enter sends, Shift+Enter breaks the line — the convention every
   chat surface shares and the only one nobody has to be told.

   Files come in three ways: the paperclip, a drop anywhere on the
   composer, and a paste (a screenshot of an invoice is the commonest
   case). Each is uploaded the moment it arrives, while the question
   is still being typed, and goes to the model as the file itself
   when the message is sent. Send is held until every upload is done.
   ============================================================ */
import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Paperclip, Square } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'
import * as agent from '../../lib/agent.js'
import AttachmentChip, { attachmentMeta, openAttachment } from './AttachmentChip.jsx'

const MAX_HEIGHT = 168
// Mirrors the API: 10 MB a file, five files a message.
const MAX_BYTES = 10 * 1024 * 1024
const MAX_FILES = 5
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const ACCEPTED = /\.(pdf|jpe?g|png|webp)$/i

let nextKey = 0

export default function AgentComposer({ onSend, busy, disabled, hint }) {
  const { t, lang } = useLang()
  const [value, setValue] = useState('')
  const [files, setFiles] = useState([]) // { key, name, kind, status, attachment, error }
  const [dropping, setDropping] = useState(false)
  const areaRef = useRef(null)
  const pickerRef = useRef(null)

  const patchFile = (key, patch) =>
    setFiles((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)))

  const addFiles = (incoming) => {
    const room = MAX_FILES - files.length
    const picked = [...incoming]
    const added = picked.slice(0, Math.max(room, 0)).map((file) => {
      const key = ++nextKey
      const kind = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'pdf' : 'image'
      const typeOk = ACCEPT.split(',').includes(file.type) || ACCEPTED.test(file.name)
      const error = !typeOk
        ? t('agent.fileBadType')
        : file.size > MAX_BYTES
          ? t('agent.fileTooLarge')
          : null
      return { key, file, name: file.name || 'dosya', kind, status: error ? 'error' : 'uploading', error }
    })
    if (picked.length > room) {
      added.push({
        key: ++nextKey,
        name: t('agent.fileTooMany'),
        kind: 'image',
        status: 'error',
        error: t('agent.fileTooManyHint').replace('{n}', MAX_FILES),
      })
    }
    setFiles((list) => [...list, ...added])

    for (const item of added) {
      if (item.status !== 'uploading') continue
      agent
        .uploadAttachment(item.file)
        .then((attachment) => patchFile(item.key, { status: 'ready', attachment }))
        .catch((err) => patchFile(item.key, { status: 'error', error: err.message || t('agent.fileFailed') }))
    }
  }

  const removeFile = (item) => {
    setFiles((list) => list.filter((f) => f.key !== item.key))
    // A read file already sits on the server; take it back rather than
    // leave it for the day-old sweep.
    if (item.attachment) agent.deleteAttachment(item.attachment.id).catch(() => {})
  }

  const ready = files.filter((f) => f.status === 'ready')
  const reading = files.some((f) => f.status === 'uploading')
  const canSend = (value.trim() || ready.length > 0) && !reading && !busy && !disabled

  const submit = () => {
    if (!canSend) return
    onSend(value.trim(), ready.map((f) => f.attachment))
    setValue('')
    setFiles([])
    if (areaRef.current) areaRef.current.style.height = 'auto'
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const onInput = (event) => {
    setValue(event.target.value)
    event.target.style.height = 'auto'
    event.target.style.height = `${Math.min(event.target.scrollHeight, MAX_HEIGHT)}px`
  }

  const onPaste = (event) => {
    const pasted = [...(event.clipboardData?.files || [])]
    if (!pasted.length) return
    event.preventDefault()
    addFiles(pasted)
  }

  const onDragOver = (event) => {
    if (![...(event.dataTransfer?.types || [])].includes('Files')) return
    event.preventDefault()
    setDropping(true)
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDropping(false)
    if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files)
  }

  return (
    <div
      className={`agent-composer${dropping ? ' is-drop' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDropping(false)
      }}
      onDrop={onDrop}
    >
      <div className="agent-composer__inner">
        {/* The row opens and closes instead of popping, so the composer
            grows into the thread smoothly when the first file lands. */}
        <AnimatePresence initial={false}>
          {files.length > 0 && (
            <motion.div
              key="files"
              className="agent-files is-animated"
              initial={{ height: 0, marginBottom: 0, opacity: 0 }}
              animate={{ height: 'auto', marginBottom: 8, opacity: 1 }}
              exit={{ height: 0, marginBottom: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 0.8, 0.3, 1] }}
            >
              <AnimatePresence initial={false}>
                {files.map((item) => (
                  <AttachmentChip
                    key={item.key}
                    animated
                    name={item.name}
                    kind={item.kind}
                    status={item.status}
                    meta={attachmentMeta(item.attachment, t, lang)}
                    error={item.error}
                    onOpen={item.attachment ? () => openAttachment(item.attachment.id).catch(() => {}) : undefined}
                    onRemove={() => removeFile(item)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`agent-input${busy ? ' is-busy' : ''}`}>
          <button
            type="button"
            className="agent-attach"
            onClick={() => pickerRef.current?.click()}
            disabled={disabled || files.length >= MAX_FILES}
            aria-label={t('agent.attach')}
            title={t('agent.attachHint')}
          >
            <Paperclip size={17} strokeWidth={1.6} />
          </button>
          <input
            ref={pickerRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files?.length) addFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <textarea
            ref={areaRef}
            rows={1}
            value={value}
            onChange={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            disabled={disabled}
            placeholder={dropping ? t('agent.dropHere') : t('agent.placeholder')}
            aria-label={t('agent.placeholder')}
          />
          <button
            className="agent-send"
            onClick={submit}
            disabled={!canSend}
            aria-label={t('agent.send')}
          >
            {busy ? <Square size={13} strokeWidth={2.4} /> : <ArrowUp size={17} strokeWidth={2} />}
          </button>
        </div>
        <p className="agent-composer__note">{hint || t('agent.disclaimer')}</p>
      </div>
    </div>
  )
}
