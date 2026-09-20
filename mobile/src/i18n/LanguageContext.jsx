/* TR / EN, over the web app's dictionary.
   The dictionary itself is shared verbatim — only the storage differs, which
   is why this provider is a mobile copy rather than an import: the web one
   reaches for window.localStorage and document.documentElement. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getLocales } from 'expo-localization'

import { translations } from '../shared/translations.js'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'muhai.lang'

/** The phone's own language, when it is one we speak. Turkish otherwise —
    this is an app for Turkish SMEs, so TR is the right default, not English. */
function deviceLanguage() {
  try {
    return getLocales()[0]?.languageCode === 'en' ? 'en' : 'tr'
  } catch {
    return 'tr'
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(deviceLanguage)

  // AsyncStorage is async, so the stored choice arrives after the first paint.
  // Starting from the device language rather than a hardcoded 'tr' keeps that
  // first frame from flashing the wrong language for an English user.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'tr' || stored === 'en') setLang(stored)
      })
      .catch(() => {})
  }, [])

  const setLanguage = useCallback((next) => {
    setLang(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
  }, [])

  const toggle = useCallback(() => {
    setLanguage(lang === 'tr' ? 'en' : 'tr')
  }, [lang, setLanguage])

  // Deep-key lookup, falling back to Turkish and then to the key itself.
  // Copied from web/src/i18n/LanguageContext.jsx so both clients resolve a
  // missing key the same way.
  const t = useCallback(
    (key) => {
      const dict = translations[lang] || translations.tr
      const value = key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), dict)
      if (value == null) {
        const fb = key
          .split('.')
          .reduce((acc, part) => (acc == null ? acc : acc[part]), translations.tr)
        return fb == null ? key : fb
      }
      return value
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, t, toggle, setLanguage }), [lang, t, toggle, setLanguage])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
