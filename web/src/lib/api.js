/* ============================================================
   Muhai compute API client.

   Firestore stores the data; this API computes over it. Every call carries
   the caller's Firebase ID token, which the backend verifies against
   Google's public certificates.

   Two rules the whole app relies on:
     1. Every call has a timeout. A hanging fetch is worse than a failure.
     2. A failed call raises ApiError with a readable message — callers show
        the locally-derived numbers and a "hesaplama servisi çevrimdışı"
        note rather than an empty screen.
   ============================================================ */
import { auth } from './firebase.js'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const PREFIX = '/api/compute'
const DEFAULT_TIMEOUT_MS = 20000

export class ApiError extends Error {
  constructor(message, { status = 0, detail = null, cause = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.cause = cause
  }
}

async function authHeader() {
  const user = auth.currentUser
  if (!user) return {}
  try {
    // Cached until ~5 min before expiry; the SDK refreshes transparently.
    const token = await user.getIdToken()
    return { Authorization: `Bearer ${token}` }
  } catch (e) {
    console.warn('[muhai] could not obtain an ID token', e)
    return {}
  }
}

async function request(path, { method = 'POST', body, isForm = false, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(`${BASE}${PREFIX}${path}`, {
      method,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(await authHeader()),
      },
      body: isForm ? body : body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

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

    return await res.json()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err.name === 'AbortError') {
      throw new ApiError('Hesaplama servisi yanıt vermedi (zaman aşımı).', { status: 0, cause: err })
    }
    throw new ApiError('Hesaplama servisine ulaşılamıyor.', { status: 0, cause: err })
  } finally {
    clearTimeout(timer)
  }
}

/** Liveness probe used by the connection badge. */
export async function ping(timeout = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(`${BASE}/health`, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export const apiBaseUrl = BASE

// ── Endpoints ─────────────────────────────────────────────────────────
export const getDashboard = (snapshot) => request('/dashboard', { body: snapshot })
export const getMuhaiScore = (snapshot) => request('/muhai-score', { body: snapshot })
export const getForecast = (snapshot, horizon = 30) =>
  request(`/forecast?horizon=${horizon}`, { body: snapshot, timeout: 45000 })
export const getTaxSummary = (snapshot) => request('/tax-summary', { body: snapshot })
export const runPayroll = (snapshot) => request('/payroll', { body: snapshot })
export const classifyExpenses = (items) => request('/classify', { body: { items } })
export const askAssistant = (message, snapshot, lang = 'tr') =>
  request('/chat', { body: { message, snapshot, lang }, timeout: 40000 })

export function scanInvoice(file) {
  const form = new FormData()
  form.append('file', file)
  return request('/ocr', { body: form, isForm: true, timeout: 60000 })
}
