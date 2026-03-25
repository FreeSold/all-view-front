import React, { createContext, useContext, useMemo, useState } from 'react'
import { getAppData } from '../storage/appStore'

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
        const { accounts, roles } = getAppData()
        const acc = accounts.find((a) => a.username === normalized && a.status === 'active')
        if (!acc) {
          throw new Error('账号不存在或未启用')
        }
        if (!acc.password) {
          throw new Error('该账号未设置密码')
        }
        if (acc.password !== password) {
          throw new Error('账号或密码错误')
        }

        const roleCode = roles.find((r) => r.id === acc.roleId)?.code
        if (roleCode !== 'admin' && roleCode !== 'operator') {
          throw new Error('账号角色配置异常')
        }

        const role: UserRole = roleCode
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
