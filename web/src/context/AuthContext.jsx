/* ============================================================
   Authentication + company identity.

   One Firebase account owns one company. Registration creates the auth
   user, the company document and the user→company link, then optionally
   seeds a demo dataset so the dashboard is never an empty shell.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../lib/firebase.js'
import { createCompany, getCompany, getUserProfile, updateCompany } from '../lib/db.js'
import { seedCompany } from '../lib/seed.js'

const AuthContext = createContext(null)

/** Firebase auth error codes → messages a business owner can act on. */
const ERROR_MESSAGES = {
  'auth/invalid-email': { tr: 'E-posta adresi geçersiz.', en: 'That email address is not valid.' },
  'auth/user-disabled': { tr: 'Bu hesap devre dışı bırakılmış.', en: 'This account has been disabled.' },
  'auth/user-not-found': { tr: 'Bu e-posta ile kayıtlı hesap yok.', en: 'No account found for that email.' },
  'auth/wrong-password': { tr: 'E-posta veya şifre hatalı.', en: 'Email or password is incorrect.' },
  'auth/invalid-credential': { tr: 'E-posta veya şifre hatalı.', en: 'Email or password is incorrect.' },
  'auth/email-already-in-use': { tr: 'Bu e-posta zaten kayıtlı. Giriş yapın.', en: 'That email is already registered. Sign in instead.' },
  'auth/weak-password': { tr: 'Şifre en az 6 karakter olmalı.', en: 'Password must be at least 6 characters.' },
  'auth/too-many-requests': { tr: 'Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.', en: 'Too many attempts. Try again shortly.' },
  'auth/network-request-failed': { tr: 'Ağ bağlantısı kurulamadı.', en: 'Network connection failed.' },
  'auth/operation-not-allowed': {
    tr: 'E-posta/şifre girişi Firebase konsolunda etkin değil.',
    en: 'Email/password sign-in is not enabled in the Firebase console.',
  },
  'permission-denied': {
    tr: 'Firestore kuralları bu işleme izin vermiyor. firestore.rules dosyasını yayınlayın.',
    en: 'Firestore rules rejected this write. Publish firestore.rules.',
  },
}

export function authErrorMessage(err, lang = 'tr') {
  const entry = ERROR_MESSAGES[err?.code]
  if (entry) return entry[lang] || entry.tr
  return err?.message || (lang === 'en' ? 'Something went wrong.' : 'Bir hata oluştu.')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadContext = useCallback(async (fbUser) => {
    if (!fbUser) {
      setProfile(null)
      setCompany(null)
      return
    }
    try {
      const p = await getUserProfile(fbUser.uid)
      setProfile(p)
      setCompany(p?.companyId ? await getCompany(p.companyId) : null)
      setError(null)
    } catch (e) {
      console.error('[muhai] failed to load company context', e)
      setError(e)
    }
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser)
      await loadContext(fbUser)
      setLoading(false)
    })
    return unsub
  }, [loadContext])

  const register = useCallback(
    async ({ email, password, displayName, company: companyInput, withDemoData = true }) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName) {
        await updateProfile(cred.user, { displayName }).catch(() => {})
      }

      const companyId = await createCompany(cred.user.uid, {
        email,
        displayName,
        company: companyInput,
      })

      if (withDemoData) {
        // A seeding failure must not strand a real, created account — the user
        // lands in the app with an empty state they can seed from Settings.
        try {
          await seedCompany(companyId)
        } catch (e) {
          console.error('[muhai] demo seeding failed', e)
        }
      }

      await loadContext(cred.user)
      return companyId
    },
    [loadContext],
  )

  const login = useCallback(
    async ({ email, password }) => {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      await loadContext(cred.user)
      return cred.user
    },
    [loadContext],
  )

  const logout = useCallback(async () => {
    await signOut(auth)
    setProfile(null)
    setCompany(null)
  }, [])

  const resetPassword = useCallback((email) => sendPasswordResetEmail(auth, email), [])

  const refreshCompany = useCallback(async () => {
    if (!profile?.companyId) return null
    const fresh = await getCompany(profile.companyId)
    setCompany(fresh)
    return fresh
  }, [profile?.companyId])

  const saveCompany = useCallback(
    async (patch) => {
      if (!profile?.companyId) return
      await updateCompany(profile.companyId, patch)
      await refreshCompany()
    },
    [profile?.companyId, refreshCompany],
  )

  const value = useMemo(
    () => ({
      user,
      profile,
      company,
      companyId: profile?.companyId ?? null,
      loading,
      error,
      register,
      login,
      logout,
      resetPassword,
      refreshCompany,
      saveCompany,
    }),
    [user, profile, company, loading, error, register, login, logout, resetPassword, refreshCompany, saveCompany],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
