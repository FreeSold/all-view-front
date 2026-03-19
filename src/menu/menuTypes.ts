import type { ReactNode } from 'react'

export type AppMenuItem = {
  key: string
  label: string
  path?: string
  icon?: ReactNode
  children?: AppMenuItem[]
}
