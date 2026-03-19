import React, { createContext, useContext, useMemo, useState } from 'react'

export type UserRole = 'admin' | 'operator'

export type AuthUser = {
  username: string
  role: UserRole
}

type AuthContextValue = {
  user: AuthUser | null
  login: (params: { username: string; password: string }) => Promise<void>
  logout: () => void
}

const STORAGE_KEY = 'all-view-front/auth-user'

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: async ({ username, password }) => {
        const normalized = username.trim().toLowerCase()
        const ok =
          (normalized === 'admin' && password === 'admin@123') ||
          (normalized === 'operator' && password === 'operator123')

        if (!ok) {
          throw new Error('账号或密码错误（Demo：admin/admin@123 或 operator/operator123）')
        }

        const role: UserRole = normalized === 'admin' ? 'admin' : 'operator'
        const next: AuthUser = { username: normalized, role }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        setUser(next)
      },
      logout: () => {
        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
