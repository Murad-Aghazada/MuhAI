/* ============================================================
   The HTTP client every request goes through.

   One origin, one token. The API is Muhai's own FastAPI service: it holds the
   data, the maths and the sessions. There is no third-party SDK in the path
   any more, and nothing but this file knows how a request is authenticated.

   The two facts that differ between a browser and a phone — where the API is,
   and where the session is kept — are injected once at boot through
   configureClient(). That is the whole reason this file is portable: the Expo
   app bundles it unchanged, and `web/src/main.jsx` is the only place in the
   web app that knows about Vite's environment.

   Three rules the rest of the app relies on:
     1. Every call has a timeout. A hanging fetch is worse than a failure.
     2. A failure raises ApiError with a message a business owner can read —
        callers show locally-derived numbers and an "offline" badge rather
        than a blank screen.
     3. A 401 clears the stored session exactly once and tells the app, so an
        expired token lands on the login screen instead of looping.
   ============================================================ */

// Where the API is. Empty means "same origin", which is the production
// arrangement: nginx proxies /api to the backend, so no hostname is baked into
// the bundle. The entry point supplies the value through configureClient()
// below — this module deliberately reads no build-time environment of its own,
// because it is also bundled by Metro for the Expo app and `import.meta` is a
// syntax error there.
//
// `let` rather than `const` on purpose: an ES-module live binding means
// lib/api.js's re-export and the one read in pages/Settings.jsx see the
// configured value without either of them changing. The one hazard is a future
// consumer that copies it at module scope, before boot.
export let apiBaseUrl = ''

const TOKEN_KEY = 'muhai.token'
const DEFAULT_TIMEOUT_MS = 20000

export class ApiError extends Error {
  constructor(message, { status = 0, detail = null, cause = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.cause = cause
  }

  /** True when the request never reached the server. */
  get isOffline() {
    return this.status === 0
  }
}

// ── Session token ─────────────────────────────────────────────────────
// Storage rather than a cookie: the API is stateless and CSRF-free because
// nothing is sent ambiently — every authenticated request carries the token in
// a header this file adds.
//
// The store is injectable because React Native has no localStorage and its
// replacements are asynchronous, while getToken() is called synchronously
// inside every request. So a native app reads the token once at boot and hands
// it to configureClient(); the synchronous read below is only ever a browser's.

const browserStore = {
  read() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      // Private mode, or storage blocked. The session is then tab-only.
      return null
    }
  },
  write(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* in-memory session only */
    }
  },
}

const memoryStore = { read: () => null, write() {} }

let store = typeof localStorage !== 'undefined' ? browserStore : memoryStore
let memoryToken = null

/**
 * Point the client at an API and tell it where the session lives.
 *
 * Called once from the entry point before anything renders — `main.jsx` on the
 * web, the Expo root layout on a phone. Those two are the only places that
 * know which platform this is; everything below here does not.
 *
 * `token` is the boot hydration: a native app has already read it out of
 * asynchronous storage and passes it in, which is what keeps getToken()
 * synchronous for every caller.
 */
export function configureClient({ baseUrl, tokenStore, token } = {}) {
  if (baseUrl !== undefined) apiBaseUrl = String(baseUrl || '').replace(/\/$/, '')
  if (tokenStore) store = tokenStore
  if (token !== undefined) memoryToken = token || null
}

export function getToken() {
  if (memoryToken) return memoryToken
  memoryToken = store.read()
  return memoryToken
}

export function setToken(token) {
  memoryToken = token || null
  store.write(memoryToken)
}

export function clearToken() {
  setToken(null)
}

// The auth context registers here so an expired token can unwind the session
// from any call site, not just the ones that happen to be inside a component.
let onUnauthenticated = null

export function setUnauthenticatedHandler(fn) {
  onUnauthenticated = fn
}

// ── Requests ──────────────────────────────────────────────────────────

export async function request(
  path,
  { method = 'GET', body, isForm = false, timeout = DEFAULT_TIMEOUT_MS, auth = true } = {},
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const token = auth ? getToken() : null

  try {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        ...(isForm ? {} : body != null ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isForm ? body : body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (res.status === 401) {
      clearToken()
      onUnauthenticated?.()
      throw new ApiError('Oturumunuzun süresi doldu. Tekrar giriş yapın.', { status: 401 })
    }

    if (!res.ok) {
      let detail = null
      try {
        detail = (await res.json())?.detail ?? null
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(
        typeof detail === 'string' ? detail : `İstek başarısız (HTTP ${res.status})`,
        { status: res.status, detail },
      )
    }

    if (res.status === 204) return null
    return await res.json()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err.name === 'AbortError') {
      throw new ApiError('Sunucu yanıt vermedi (zaman aşımı).', { status: 0, cause: err })
    }
    throw new ApiError('Sunucuya ulaşılamıyor.', { status: 0, cause: err })
  } finally {
    clearTimeout(timer)
  }
}

export const get = (path, options) => request(path, { ...options, method: 'GET' })
export const post = (path, body, options) => request(path, { ...options, method: 'POST', body })
export const patch = (path, body, options) => request(path, { ...options, method: 'PATCH', body })
export const del = (path, options) => request(path, { ...options, method: 'DELETE' })

/** Liveness probe used by the connection badge. */
export async function ping(timeout = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(`${apiBaseUrl}/health`, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
