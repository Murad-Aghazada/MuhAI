/* TR / EN, over the web app's dictionary.
   The dictionary itself is shared verbatim — only the storage differs, which
   is why this provider is a mobile copy rather than an import: the web one
   reaches for window.localStorage and document.documentElement. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { translations } from '../shared/translations.js'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'muhai.lang'

/** Turkish, always, until the user says otherwise.

    This used to read the phone's locale and hand an English-language handset
    an English app. That is the wrong default for Muhai: the product is for
    Turkish SMEs, the invoices are Turkish, the tax vocabulary is Turkish, and
    plenty of people in that market carry a phone set to English. The stored
    choice still wins — see the effect below — so English remains one tap away
    for anyone who wants it. */
function defaultLanguage() {
  return 'tr'
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(defaultLanguage)

  // AsyncStorage is async, so a stored choice arrives after the first paint.
  // Turkish renders first and is replaced only if this user picked English.
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
