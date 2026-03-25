import { getAppData, updateAppData } from '../storage/appStore'
import type { Account, AccountStatus, Role } from '../storage/types'

export type { Account, AccountStatus, Role }

function nowIso() {
  return new Date().toISOString()
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

const defaultRoles: Role[] = [
  { id: 'r_admin', name: '管理员', code: 'admin', description: '系统全权限（Demo）', createdAt: nowIso() },
  { id: 'r_operator', name: '运营', code: 'operator', description: '部分功能可见（Demo）', createdAt: nowIso() },
]

const defaultAccounts: Account[] = [
  {
    id: 'u_admin',
    username: 'admin',
    displayName: '系统管理员',
    roleId: 'r_admin',
    status: 'active',
    password: 'admin@123',
    createdAt: nowIso(),
  },
  {
    id: 'u_operator',
    username: 'operator',
    displayName: '运营同学',
    roleId: 'r_operator',
    status: 'active',
    password: 'operator123',
    createdAt: nowIso(),
  },
]

export const mockDb = {
  listRoles(): Role[] {
    const { roles } = getAppData()
    return [...roles].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  createRole(input: Omit<Role, 'id' | 'createdAt'>): Role {
    const role: Role = { ...input, id: uid('r'), createdAt: nowIso() }
    updateAppData((d) => {
      d.roles = [role, ...d.roles]
    })
    return role
  },
  updateRole(id: string, patch: Partial<Omit<Role, 'id' | 'createdAt'>>): Role {
    const { roles } = getAppData()
    const idx = roles.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error('角色不存在')
    const next: Role = { ...roles[idx], ...patch }
    updateAppData((d) => {
      d.roles = d.roles.map((r) => (r.id === id ? next : r))
    })
    return next
  },
  deleteRole(id: string) {
    const { accounts } = getAppData()
    if (accounts.some((a) => a.roleId === id)) {
      throw new Error('该角色仍被账户引用，无法删除')
    }
    updateAppData((d) => {
      d.roles = d.roles.filter((r) => r.id !== id)
    })
  },

  listAccounts(): Account[] {
    const { accounts } = getAppData()
    return [...accounts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  createAccount(input: Omit<Account, 'id' | 'createdAt'>): Account {
    const normalized = input.username.trim().toLowerCase()
    if (!normalized) throw new Error('账号不能为空')
    if (!input.password) throw new Error('密码不能为空')
    const { accounts } = getAppData()
    if (accounts.some((a) => a.username === normalized)) throw new Error('账号已存在')
    const acc: Account = { ...input, username: normalized, id: uid('u'), createdAt: nowIso() }
    updateAppData((d) => {
      d.accounts = [acc, ...d.accounts]
    })
    return acc
  },
  updateAccount(id: string, patch: Partial<Omit<Account, 'id' | 'createdAt'>>): Account {
    const { accounts } = getAppData()
    const idx = accounts.findIndex((a) => a.id === id)
    if (idx < 0) throw new Error('账户不存在')
    const prev = accounts[idx]
    const nextUsername = patch.username ? patch.username.trim().toLowerCase() : prev.username
    if (patch.username && accounts.some((a) => a.username === nextUsername && a.id !== id)) {
      throw new Error('账号已存在')
    }
    const next: Account = { ...prev, ...patch, username: nextUsername }
    updateAppData((d) => {
      d.accounts = d.accounts.map((a) => (a.id === id ? next : a))
    })
    return next
  },
  deleteAccount(id: string) {
    updateAppData((d) => {
      d.accounts = d.accounts.filter((a) => a.id !== id)
    })
  },

  reset(): void {
    updateAppData((d) => {
      d.roles = [...defaultRoles]
      d.accounts = [...defaultAccounts]
    })
  },
}
