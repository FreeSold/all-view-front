import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { ThemeConfig } from 'antd'

export type AppThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  mode: AppThemeMode
  setMode: (mode: AppThemeMode) => void
  toggle: () => void
}

const STORAGE_KEY = 'all-view-front/theme-mode'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredMode(): AppThemeMode {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'dark' ? 'dark' : 'light'
}

/** 深色主题：黑橙配色 */
const darkBlackOrangeTokens: ThemeConfig['token'] = {
  colorPrimary: '#E07C24',
  colorPrimaryHover: '#F97316',
  colorPrimaryActive: '#C95A1A',
  colorBgContainer: '#141414',
  colorBgLayout: '#0D0D0D',
  colorBgElevated: '#1A1A1A',
  colorBorder: '#2A2A2A',
  colorBorderSecondary: '#1F1F1F',
  colorText: 'rgba(255,255,255,0.9)',
  colorTextSecondary: 'rgba(255,255,255,0.55)',
  colorTextTertiary: 'rgba(255,255,255,0.4)',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorInfo: '#E07C24',
  colorInfoBg: 'rgba(224, 124, 36, 0.12)',
  colorLink: '#E07C24',
  colorLinkHover: '#F97316',
  colorPrimaryBg: 'rgba(224, 124, 36, 0.1)',
  colorPrimaryBgHover: 'rgba(224, 124, 36, 0.18)',
  colorFillSecondary: 'rgba(255,255,255,0.06)',
  colorFillTertiary: 'rgba(255,255,255,0.04)',
}

/** 浅色主题：白蓝配色（保持默认） */
const lightWhiteBlueTokens: ThemeConfig['token'] = {
  colorPrimary: '#1677ff',
  borderRadius: 12,
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AppThemeMode>(() => readStoredMode())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
    }),
    [mode],
  )

  const algorithm = mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm
  const tokenOverrides =
    mode === 'dark'
      ? { ...darkBlackOrangeTokens, borderRadius: 12 }
      : { ...lightWhiteBlueTokens }

  const components =
    mode === 'dark'
      ? {
          Layout: {
            siderBg: '#141414',
            triggerBg: 'rgba(224, 124, 36, 0.15)',
            triggerColor: '#E07C24',
          },
          Menu: {
            darkItemBg: '#141414',
            darkSubMenuItemBg: '#141414',
            darkPopupBg: '#141414',
            darkItemSelectedBg: 'rgba(224, 124, 36, 0.25)',
            darkItemHoverBg: 'rgba(255,255,255,0.06)',
            itemSelectedBg: 'rgba(224, 124, 36, 0.2)',
            itemHoverBg: 'rgba(255,255,255,0.06)',
            itemActiveBg: 'rgba(224, 124, 36, 0.15)',
          },
          Alert: {
            colorInfoBg: 'rgba(224, 124, 36, 0.12)',
            colorInfoBorder: 'rgba(224, 124, 36, 0.35)',
          },
          Message: {
            contentBg: '#1A1A1A',
          },
        }
      : undefined

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm,
          token: tokenOverrides,
          components,
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider')
  return ctx
}
