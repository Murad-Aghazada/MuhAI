/* ============================================================
   The agent — a room, not a widget.

   Three columns: the threads on the left, the conversation in the
   middle, the open report on the right. The middle one is the only
   one that is always there; the other two come and go, and the grid
   is what decides that rather than any of them knowing about the
   others.

   It fills the window under the topbar and scrolls internally. The
   page frame (`.page`, `--measure`, the 16px rhythm) is deliberately
   not used here: every other screen is a stack of cards on a tinted
   ground, and this one is a workspace. It still speaks the same
   language — the same ink, the same lime for what is live, the same
   Inter Tight — it just has a different shape, the way a document
   editor does inside an app that is otherwise lists.

   A thread is created lazily. Landing on `/app/assistant` and
   immediately owning an empty "Yeni sohbet" you never used is how a
   chat list fills with noise; the row appears when the first question
   is asked.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PanelLeft, WifiOff } from 'lucide-react'
import { Spark } from '../components/ui/icons.jsx'
import { useLang } from '../i18n/LanguageContext.jsx'
import { useData } from '../context/DataContext.jsx'
import * as agent from '../lib/agent.js'
import ConversationRail from '../components/agent/ConversationRail.jsx'
import AgentThread from '../components/agent/AgentThread.jsx'
import AgentComposer from '../components/agent/AgentComposer.jsx'
import ArtifactPane from '../components/agent/ArtifactPane.jsx'

const STARTERS = ['agent.starter1', 'agent.starter2', 'agent.starter3', 'agent.starter4']

/* Below this the thread rail is an overlay rather than a column — it has to
   match the breakpoint `agent.css` switches at, or the panel opens as a
   column with nowhere to be. */
const NARROW = 720

export default function Agent() {
  const { t } = useLang()
  const { company, isEmpty } = useData()

  const [capabilities, setCapabilities] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])

  const [pending, setPending] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState(null)

  const [artifact, setArtifact] = useState(null)
  const [artifactLoading, setArtifactLoading] = useState(false)
  const [artifactError, setArtifactError] = useState(null)

  // Open beside the conversation on a desktop, shut on a phone — where it is
  // an overlay, and starting on top of the thread would hide the thing the
  // user came for. Read once: this is the initial state, not a live query, so
  // rotating a tablet does not yank the panel away mid-sentence.
  const [railOpen, setRailOpen] = useState(() => window.innerWidth > NARROW)

  // Guards a resolved fetch from writing into a screen the user has left.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // ── Load ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    Promise.all([agent.getCapabilities(), agent.listConversations()])
      .then(([caps, list]) => {
        if (cancelled) return
        setCapabilities(caps)
        setConversations(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || t('agent.loadFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  /* On a phone the rail covers the conversation, so anything that changes
     which conversation is showing has to get out of the way afterwards. */
  const dismissOverlayRail = useCallback(() => {
    if (window.innerWidth <= NARROW) setRailOpen(false)
  }, [])

  const openConversation = useCallback(
    async (id) => {
      setActiveId(id)
      setMessages([])
      setError(null)
      setArtifact(null)
      dismissOverlayRail()
      try {
        const detail = await agent.getConversation(id)
        if (!mounted.current) return
        setMessages(detail.messages || [])
      } catch (err) {
        if (mounted.current) setError(err.message || t('agent.loadFailed'))
      }
    },
    [dismissOverlayRail, t],
  )

  const startNew = useCallback(() => {
    // No row is created here — see the header note. This only clears the
    // middle column so the next question opens a thread of its own.
    setActiveId(null)
    setMessages([])
    setArtifact(null)
    setError(null)
    dismissOverlayRail()
  }, [dismissOverlayRail])

  // ── Reports ─────────────────────────────────────────────────────
  const openArtifact = useCallback(
    async (id) => {
      setArtifactLoading(true)
      setArtifactError(null)
      // The id alone opens the pane immediately; the blocks land when they
      // arrive. Waiting for the fetch would make the panel appear late and
      // look like the click had missed.
      setArtifact({ id })
      try {
        const full = await agent.getArtifact(id)
        if (mounted.current) setArtifact(full)
      } catch (err) {
        if (mounted.current) setArtifactError(err.message || t('agent.reportFailed'))
      } finally {
        if (mounted.current) setArtifactLoading(false)
      }
    },
    [t],
  )

  // ── Asking ──────────────────────────────────────────────────────
  const send = useCallback(
    async (text, attachments = []) => {
      setError(null)
      setPending({ text, attachments })
      setThinking(true)

      try {
        let conversationId = activeId
        if (!conversationId) {
          const created = await agent.createConversation()
          conversationId = created.id
          if (!mounted.current) return
          setActiveId(conversationId)
          setConversations((list) => [created, ...list])
        }

        const turn = await agent.ask(conversationId, text, attachments.map((a) => a.id))
        if (!mounted.current) return

        setPending(null)
        setMessages((list) => [...list, turn.userMessage, turn.message])
        // Move the thread to the top and take the server's title, which is
        // the first question for a thread that did not have one yet.
        setConversations((list) => [
          turn.conversation,
          ...list.filter((c) => c.id !== turn.conversation.id),
        ])

        // A turn that wrote a report opens it. That is the point of the
        // split view — a report card you then have to click is one step of
        // ceremony between asking for a thing and seeing it.
        const first = turn.message.artifacts?.[0]
        if (first) openArtifact(first.id)
      } catch (err) {
        if (!mounted.current) return
        setPending(null)
        setError(err.message || t('agent.askFailed'))
      } finally {
        if (mounted.current) setThinking(false)
      }
    },
    [activeId, openArtifact, t],
  )

  // ── Thread management ───────────────────────────────────────────
  const rename = useCallback(async (id, title) => {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, title } : c)))
    await agent.renameConversation(id, title).catch(() => {})
  }, [])

  const pin = useCallback(async (id, pinned) => {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, pinned } : c)))
    try {
      const updated = await agent.pinConversation(id, pinned)
      setConversations((list) =>
        [...list.map((c) => (c.id === id ? updated : c))].sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')),
        ),
      )
    } catch {
      /* the optimistic flip stands; the next load corrects it */
    }
  }, [])

  const remove = useCallback(
    async (id) => {
      setConversations((list) => list.filter((c) => c.id !== id))
      if (id === activeId) startNew()
      await agent.deleteConversation(id).catch(() => {})
    },
    [activeId, startNew],
  )

  const offline = capabilities && !capabilities.online
  const showArtifact = Boolean(artifact)

  return (
    <div
      className={`agent-screen${railOpen ? '' : ' is-rail-closed'}${
        showArtifact ? ' is-split' : ''
      }`}
    >
      {railOpen && (
        <ConversationRail
          conversations={conversations}
          activeId={activeId}
          onOpen={openConversation}
          onNew={startNew}
          onRename={rename}
          onPin={pin}
          onDelete={remove}
        />
      )}

      <main className="agent-main">
        <header className="agent-bar">
          <button
            className="icon-btn"
            onClick={() => setRailOpen((v) => !v)}
            aria-label={t('agent.toggleHistory')}
            aria-pressed={railOpen}
          >
            <PanelLeft size={17} strokeWidth={1.7} />
          </button>

          <div className="agent-bar__who">
            <span className="agent-bar__name">{t('agent.title')}</span>
            <span className="agent-bar__sub">
              {company?.name ? t('agent.scope').replace('{co}', company.name) : t('agent.subtitle')}
            </span>
          </div>

          <span className="agent-bar__flags">
            {offline ? (
              <span className="agent-flag is-warn">
                <WifiOff size={13} strokeWidth={1.7} />
                {t('agent.offlineMode')}
              </span>
            ) : null}
          </span>
        </header>

        {messages.length === 0 && !pending && !thinking ? (
          <motion.div
            className="agent-welcome"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className="agent-welcome__mark">
              <Spark size={22} strokeWidth={1.5} />
            </span>
            <h1 className="agent-welcome__title">
              {company?.name
                ? t('agent.greetNamed').replace('{co}', company.name)
                : t('agent.greet')}
            </h1>
            <p className="agent-welcome__sub">
              {offline ? t('agent.offlineExplain') : t('agent.welcomeSub')}
            </p>

            {isEmpty && <p className="agent-welcome__warn">{t('agent.noData')}</p>}

            <div className="agent-starters">
              {STARTERS.map((key) => (
                <button key={key} className="agent-starter" onClick={() => send(t(key))}>
                  {t(key)}
                </button>
              ))}
            </div>

            {capabilities?.tools?.length ? (
              <details className="agent-caps">
                <summary>{t('agent.capsTitle').replace('{n}', capabilities.tools.length)}</summary>
                <ul>
                  {capabilities.tools.map((tool) => (
                    <li key={tool.name}>
                      <code>{tool.name}</code>
                      <span>{tool.description}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </motion.div>
        ) : (
          <AgentThread
            messages={messages}
            pending={pending}
            thinking={thinking}
            activeArtifactId={artifact?.id}
            onOpenArtifact={openArtifact}
          />
        )}

        {error && <div className="agent-error">{error}</div>}

        <AgentComposer onSend={send} busy={thinking} hint={offline ? t('agent.offlineHint') : null} />
      </main>

      {showArtifact && (
        <ArtifactPane
          artifact={artifact?.blocks ? artifact : null}
          loading={artifactLoading}
          error={artifactError}
          pdf={capabilities?.pdf !== false}
          onClose={() => setArtifact(null)}
        />
      )}
    </div>
  )
}
