import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type AppShellContextValue = {
  /** 面包屑右侧区域：由子页面注册渲染函数，便于读取最新 Context */
  setContentHeaderRight: (render: (() => React.ReactNode) | null) => void
  contentHeaderRight: (() => React.ReactNode) | null
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [contentHeaderRight, setContentHeaderRightState] = useState<(() => React.ReactNode) | null>(
    null
  )

  const setContentHeaderRight = useCallback((render: (() => React.ReactNode) | null) => {
    // 必须用 updater 形式：若直接 setState(fn)，React 会把 fn 当成 (prev)=>next 并执行，state 会变成 JSX 而非函数
    setContentHeaderRightState(() => render)
  }, [])

  const value = useMemo(
    () => ({ setContentHeaderRight, contentHeaderRight }),
    [setContentHeaderRight, contentHeaderRight]
  )

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShell() {
  const ctx = useContext(AppShellContext)
  if (!ctx) throw new Error('useAppShell must be used within AppShellProvider')
  return ctx
}
