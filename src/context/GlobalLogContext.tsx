import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const MAX_LINES = 200

type GlobalLogContextValue = {
  lines: string[]
  append: (msg: string) => void
  clear: () => void
}

const GlobalLogContext = createContext<GlobalLogContextValue | null>(null)

export function GlobalLogProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<string[]>([])

  const append = useCallback((msg: string) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`
    setLines((prev) => [...prev.slice(-(MAX_LINES - 1)), line])
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo(() => ({ lines, append, clear }), [lines, append, clear])

  return <GlobalLogContext.Provider value={value}>{children}</GlobalLogContext.Provider>
}

export function useGlobalLog() {
  const ctx = useContext(GlobalLogContext)
  if (!ctx) throw new Error('useGlobalLog must be used within GlobalLogProvider')
  return ctx
}
