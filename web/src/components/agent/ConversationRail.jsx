/* ============================================================
   Previous chats.

   A list of threads, pinned first and then by last use — not by
   creation date. A chat list is ordered by when you last touched
   something, which is what keeps yesterday's long conversation at
   the top this morning instead of buried under three one-question
   threads opened since.

   Renaming is inline rather than a modal: the title is a single
   field, and a dialog to edit one field is a dialog too many.
   Deleting asks first, in place, because there is no undo — the
   messages are gone with the row.
   ============================================================ */
import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Pin, PinOff, Plus, Search, Trash2, X } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'

function when(value, lang) {
  if (!value) return ''
  const date = new Date(value)
  const days = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (days <= 0) {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }
  if (days === 1) return lang === 'en' ? 'Yesterday' : 'Dün'
  if (days < 7) return `${days} ${lang === 'en' ? 'days ago' : 'gün önce'}`
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function Row({ conversation, active, onOpen, onRename, onPin, onDelete }) {
  const { t, lang } = useLang()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  // A row that scrolls out of view while its delete confirmation is open
  // would come back armed. Reset whenever the thread underneath changes.
  useEffect(() => {
    setConfirming(false)
    setDraft(conversation.title)
  }, [conversation.id, conversation.title])

  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== conversation.title) onRename(conversation.id, next)
    else setDraft(conversation.title)
  }

  if (editing) {
    return (
      <div className="cvrow cvrow--editing">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(conversation.title)
              setEditing(false)
            }
          }}
          aria-label={t('agent.rename')}
        />
        <button className="cvrow__act" onClick={commit} aria-label={t('common.save')}>
          <Check size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className={`cvrow${active ? ' is-live' : ''}`}>
      <button className="cvrow__open" onClick={() => onOpen(conversation.id)}>
        <span className="cvrow__title">{conversation.title}</span>
        <span className="cvrow__meta">
          {conversation.pinned ? <Pin size={11} strokeWidth={1.8} /> : null}
          {when(conversation.lastMessageAt || conversation.createdAt, lang)}
        </span>
      </button>

      {confirming ? (
        <span className="cvrow__confirm">
          <button
            className="cvrow__act cvrow__act--stop"
            onClick={() => onDelete(conversation.id)}
            aria-label={t('common.delete')}
          >
            <Check size={14} />
          </button>
          <button
            className="cvrow__act"
            onClick={() => setConfirming(false)}
            aria-label={t('common.cancel')}
          >
            <X size={14} />
          </button>
        </span>
      ) : (
        <span className="cvrow__acts">
          <button
            className="cvrow__act"
            onClick={() => onPin(conversation.id, !conversation.pinned)}
            aria-label={conversation.pinned ? t('agent.unpin') : t('agent.pin')}
          >
            {conversation.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            className="cvrow__act"
            onClick={() => setEditing(true)}
            aria-label={t('agent.rename')}
          >
            <Pencil size={14} />
          </button>
          <button
            className="cvrow__act"
            onClick={() => setConfirming(true)}
            aria-label={t('common.delete')}
          >
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </div>
  )
}

export default function ConversationRail({
  conversations,
  activeId,
  onOpen,
  onNew,
  onRename,
  onPin,
  onDelete,
}) {
  const { t } = useLang()
  const [query, setQuery] = useState('')

  const needle = query.trim().toLocaleLowerCase('tr')
  const shown = needle
    ? conversations.filter((c) => c.title.toLocaleLowerCase('tr').includes(needle))
    : conversations

  return (
    <aside className="agent-rail" aria-label={t('agent.history')}>
      <button className="btn btn--sm agent-rail__new" onClick={onNew}>
        <Plus size={15} strokeWidth={1.8} />
        {t('agent.newChat')}
      </button>

      {conversations.length > 6 && (
        <label className="agent-rail__search">
          <Search size={14} strokeWidth={1.6} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('agent.searchChats')}
            aria-label={t('agent.searchChats')}
          />
        </label>
      )}

      <div className="agent-rail__list">
        {shown.length === 0 ? (
          <p className="agent-rail__empty">
            {conversations.length ? t('agent.noMatch') : t('agent.noChats')}
          </p>
        ) : (
          shown.map((conversation) => (
            <Row
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeId}
              onOpen={onOpen}
              onRename={onRename}
              onPin={onPin}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </aside>
  )
}
