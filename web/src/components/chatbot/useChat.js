import { useState, useCallback, useRef } from 'react'
import { askAssistant } from '../../lib/gemini.js'
import { businessSummary } from '../../data/mockData.js'
import { useLang } from '../../i18n/LanguageContext.jsx'

/**
 * Shared chat state for both the floating widget and the Assistant page.
 * Manages history, loading state and calls the RAG-grounded Gemini client.
 */
export function useChat() {
  const { lang, t } = useLang()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const historyRef = useRef([])

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      const userMsg = { role: 'user', text: trimmed }
      setMessages((m) => [...m, userMsg])
      setLoading(true)

      try {
        const { text: answer, sources } = await askAssistant(trimmed, historyRef.current, lang, businessSummary)
        const botMsg = { role: 'assistant', text: answer || t('assistant.error'), sources }
        setMessages((m) => [...m, botMsg])
        historyRef.current = [...historyRef.current, userMsg, botMsg].slice(-10)
      } catch (e) {
        console.error('[muhai] assistant error', e)
        setMessages((m) => [...m, { role: 'assistant', text: t('assistant.error'), error: true }])
      } finally {
        setLoading(false)
      }
    },
    [lang, loading, t],
  )

  const clear = useCallback(() => {
    setMessages([])
    historyRef.current = []
  }, [])

  return { messages, loading, send, clear }
}
