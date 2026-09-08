/* ============================================================
   Authentication + company identity.

   One account owns one company. Registration creates both in a single server
   transaction, then optionally seeds a demo dataset so the dashboard is never
   an empty shell.

   The session is a JWT issued by Muhai's own API and kept in localStorage. On
   load the app asks /api/auth/me whether that token is still good — one round
   trip, after which `user` and `company` are settled for the session.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  clearToken,
  get as httpGet,
  getToken,
  post,
  setToken,
  setUnauthenticatedHandler,
} from '../lib/client.js'
import { getCompany, updateCompany } from '../lib/db.js'
import { seedCompany } from '../lib/seed.js'

const AuthContext = createContext(null)

/** Turn an API failure into a message a business owner can act on. */
export function authErrorMessage(err, lang = 'tr') {
  if (err instanceof ApiError) {
    // The API already answers in Turkish; only the transport errors need a
    // second language.
    if (err.isOffline) {
      return lang === 'en'
        ? 'Could not reach the Muhai server. Check your connection.'
        : 'Muhai sunucusuna ulaşılamadı. Bağlantınızı kontrol edin.'
    }
    return err.message
  }
  return err?.message || (lang === 'en' ? 'Something went wrong.' : 'Bir hata oluştu.')
}

/**
 * Shape the API's user record the way the app reads it.
 * `uid` is kept as the identifier name the screens already use.
 */
function toUser(record) {
  if (!record) return null
  return {
    uid: record.id,
    email: record.email,
    displayName: record.display_name || '',
    businessName: record.business_name || '',
    role: record.role || 'owner',
    companyId: record.company_id ?? null,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const applySession = useCallback((session) => {
    setUser(toUser(session?.user))
    setCompany(session?.company ?? null)
    setError(null)
  }, [])

  const endSession = useCallback(() => {
    clearToken()
    setUser(null)
    setCompany(null)
  }, [])

  // A 401 from any call — not just the ones a component is awaiting — unwinds
  // the session, so an expired token lands on the login screen once rather
  // than failing every panel separately.
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setUser(null)
      setCompany(null)
    })
    return () => setUnauthenticatedHandler(null)
  }, [])

  // Restore the stored session on load.
  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const session = await httpGet('/api/auth/me')
        if (!cancelled) applySession(session)
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          // Already cleared by the client; nothing more to do.
        } else {
          console.error('[muhai] could not restore the session', e)
          setError(e)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    restore()
    return () => {
      cancelled = true
    }
  }, [applySession])

  const register = useCallback(
    async ({ email, password, displayName, company: companyInput, withDemoData = true }) => {
      const session = await post(
        '/api/auth/register',
        {
          email,
          password,
          business_name: companyInput?.name || email,
          display_name: displayName || '',
          company: {
            name: companyInput?.name || '',
            taxId: companyInput?.taxId || '',
            taxOffice: companyInput?.taxOffice || '',
            sector: companyInput?.sector || 'general',
            city: companyInput?.city || '',
            legalForm: companyInput?.legalForm || 'ltd',
          },
        },
        { auth: false },
      )

      setToken(session.access_token)
      applySession(session)

      if (withDemoData) {
        // A seeding failure must not strand a real, created account — the user
        // lands in the app with an empty state they can seed from Settings.
        try {
          await seedCompany(session.company.id)
          setCompany(await getCompany())
        } catch (e) {
          console.error('[muhai] demo seeding failed', e)
        }
      }

      return session.company?.id ?? null
    },
    [applySession],
  )

  const login = useCallback(
    async ({ email, password }) => {
      const session = await post('/api/auth/login', { email, password }, { auth: false })
      setToken(session.access_token)
      applySession(session)
      return toUser(session.user)
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    // Nothing to revoke: the token is stateless and short-lived by policy.
    endSession()
  }, [endSession])


  const refreshCompany = useCallback(async () => {
    if (!user?.companyId) return null
    const fresh = await getCompany()
    setCompany(fresh)
    return fresh
  }, [user?.companyId])

  const saveCompany = useCallback(
    async (patch) => {
      if (!user?.companyId) return
      setCompany(await updateCompany(patch))
    },
    [user?.companyId],
  )

  /** Attach a company to an account that registered without one. */
  const createCompanyForAccount = useCallback(
    async (companyInput) => {
      const session = await post('/api/auth/company', companyInput)
      applySession(session)
      return session.company?.id ?? null
    },
    [applySession],
  )

  // ProtectedRoute and the screens read `profile.companyId`; keeping that shape
  // means the routing logic did not have to change with the backend.
  const profile = useMemo(
    () =>
      user
        ? {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            companyId: user.companyId,
            role: user.role,
          }
        : null,
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      profile,
      company,
      companyId: user?.companyId ?? null,
      loading,
      error,
      register,
      login,
      logout,
      refreshCompany,
      saveCompany,
      createCompanyForAccount,
    }),
    [
      user, profile, company, loading, error, register, login, logout,
      refreshCompany, saveCompany, createCompanyForAccount,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
