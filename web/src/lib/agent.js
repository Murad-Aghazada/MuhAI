/* ============================================================
   The agent client — conversations, answers and reports.

   `/api/agent` is the second company-scoped surface after the workspace.
   Unlike `api.js`, nothing here posts a snapshot: the agent reads the
   company's tables itself, so a question is a question and the server
   decides what to look at.

   Three things this file deliberately does not do:

     · It does not hold state. The page owns the conversation list and the
       open thread; a module-level cache here would be a second copy of the
       truth that goes stale the moment another tab writes.
     · It does not retry. An agent turn can take ten seconds and cost a
       model call; a silent second attempt would double both and could run
       the tools twice.
     · It does not touch `window` or `import.meta`. Everything platform-
       specific lives in `client.js`, which is what lets the shared layer
       bundle for the phone as well (N20).
   ============================================================ */
import { ApiError, apiBaseUrl, del, get, getToken, patch, post } from './client.js'

const BASE = '/api/agent'

// A tool-using turn runs several database reads, a Prophet fit and a model
// round trip. 20s — the client default — cuts off answers that were coming.
const ASK_TIMEOUT_MS = 90000

// ── Capabilities ──────────────────────────────────────────────────────

/** What this deployment's agent can do. Read once, on mount. */
export function getCapabilities() {
  return get(`${BASE}/capabilities`)
}

// ── Conversations ─────────────────────────────────────────────────────

export function listConversations() {
  return get(`${BASE}/conversations`)
}

export function createConversation(title) {
  return post(`${BASE}/conversations`, title ? { title } : {})
}

export function getConversation(id) {
  return get(`${BASE}/conversations/${id}`, { timeout: 30000 })
}

export function renameConversation(id, title) {
  return patch(`${BASE}/conversations/${id}`, { title })
}

export function pinConversation(id, pinned) {
  return patch(`${BASE}/conversations/${id}`, { pinned })
}

export function deleteConversation(id) {
  return del(`${BASE}/conversations/${id}`)
}

// ── Asking ────────────────────────────────────────────────────────────

/**
 * One turn. Resolves to `{ conversation, userMessage, message }`.
 * The stored user message comes back too, so the optimistic bubble the UI
 * drew can be replaced by the row that actually exists rather than living on
 * with a fabricated id.
 */
export function ask(conversationId, message) {
  return post(
    `${BASE}/conversations/${conversationId}/ask`,
    { message },
    { timeout: ASK_TIMEOUT_MS },
  )
}

// ── Reports ───────────────────────────────────────────────────────────

export function listArtifacts() {
  return get(`${BASE}/artifacts`)
}

export function getArtifact(id) {
  return get(`${BASE}/artifacts/${id}`, { timeout: 30000 })
}

/**
 * Fetch a report's PDF bytes.
 *
 * Deliberately *not* an `<a href>` with the token in the query string. An
 * anchor cannot carry an Authorization header, and putting the session token
 * in a URL puts it in the browser history, the Referer of anything that page
 * later loads, and every proxy access log between here and the API — for a
 * file the user could just as well be handed as a blob. So: one authenticated
 * fetch, and the page layer turns the result into a download.
 *
 * Returns `{ blob, filename }`. A 503 here means the deployment is missing
 * WeasyPrint's system libraries, which is a fixable deployment fault and not
 * a problem with the report — the caller says so rather than "failed".
 */
export async function fetchPdf(artifactId) {
  const response = await fetch(`${apiBaseUrl}${BASE}/artifacts/${artifactId}/pdf`, {
    headers: { Authorization: `Bearer ${getToken() || ''}` },
  })

  if (!response.ok) {
    let detail = null
    try {
      detail = (await response.json())?.detail ?? null
    } catch {
      /* the error body was not JSON */
    }
    throw new ApiError(
      typeof detail === 'string' ? detail : `PDF alınamadı (HTTP ${response.status}).`,
      { status: response.status, detail },
    )
  }

  const disposition = response.headers.get('Content-Disposition') || ''
  const match = /filename="([^"]+)"/.exec(disposition)
  return { blob: await response.blob(), filename: match ? match[1] : 'muhai-rapor.pdf' }
}
