import { Tooltip } from 'antd'
import { useThemeMode } from '../theme/ThemeContext'

const LIGHT_SWATCH = {
  value: 'light' as const,
  background: 'linear-gradient(135deg, #f0f7ff 0%, #1677ff 50%, #4096ff 100%)',
  title: '浅色',
}

const DARK_SWATCH = {
  value: 'dark' as const,
  background: 'linear-gradient(135deg, #141414 0%, #E07C24 50%, #C95A1A 100%)',
  title: '深色',
}

export function ThemeSwitcher() {
  const { mode, setMode } = useThemeMode()

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {[LIGHT_SWATCH, DARK_SWATCH].map(({ value, background, title }) => (
        <Tooltip key={value} title={title}>
          <button
            type="button"
            onClick={() => setMode(value)}
            aria-label={title}
            aria-pressed={mode === value}
            style={{
              width: 20,
              height: 20,
              borderRadius: 0,
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              background: mode === value ? background : 'linear-gradient(135deg, #d4d4d4, #a3a3a3)',
              boxShadow:
                mode === value
                  ? value === 'light'
                    ? '0 0 0 2px rgba(0,0,0,0.25)'
                    : '0 0 0 2px rgba(255,255,255,0.7)'
                  : 'none',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          />
        </Tooltip>
      ))}
    </div>
  )
}
