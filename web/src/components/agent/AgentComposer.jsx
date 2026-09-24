/* ============================================================
   The composer.

   Centred on the same measure as the thread, so the input sits
   directly under the answer rather than under the whole window.
   Enter sends, Shift+Enter breaks the line — the convention every
   chat surface shares and the only one nobody has to be told.
   ============================================================ */
import { useRef, useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext.jsx'

const MAX_HEIGHT = 168

export default function AgentComposer({ onSend, busy, disabled, hint }) {
  const { t } = useLang()
  const [value, setValue] = useState('')
  const areaRef = useRef(null)

  const submit = () => {
    const text = value.trim()
    if (!text || busy || disabled) return
    onSend(text)
    setValue('')
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

  return (
    <div className="agent-composer">
      <div className="agent-composer__inner">
        <div className={`agent-input${busy ? ' is-busy' : ''}`}>
          <textarea
            ref={areaRef}
            rows={1}
            value={value}
            onChange={onInput}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={t('agent.placeholder')}
            aria-label={t('agent.placeholder')}
          />
          <button
            className="agent-send"
            onClick={submit}
            disabled={!value.trim() || busy || disabled}
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
