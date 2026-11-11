import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// App-wide language (FR / EN). Chosen once, kept across pages and remembered
// on the device (localStorage) for the next visit.
const KEY = 'lang'
const LangContext = createContext({ lang: 'FR', setLang: () => {} })

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('FR')

  // Read the saved choice after mount (static export: no localStorage at build time).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved === 'FR' || saved === 'EN') setLangState(saved)
    } catch { /* private mode / blocked storage: stay in FR */ }
  }, [])

  useEffect(() => { document.documentElement.lang = lang.toLowerCase() }, [lang])

  // Same signature as useState's setter: value or updater function.
  const setLang = useCallback(next => {
    setLangState(prev => {
      const value = typeof next === 'function' ? next(prev) : next
      try { localStorage.setItem(KEY, value) } catch { /* ignore */ }
      return value
    })
  }, [])

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

// Drop-in replacement for `const [lang, setLang] = useState('FR')`.
export default function useLang() {
  const { lang, setLang } = useContext(LangContext)
  return [lang, setLang]
}
