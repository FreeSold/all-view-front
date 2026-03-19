import { theme } from 'antd'
import { useThemeMode } from '../theme/ThemeContext'

import logoPng from '../assets/allview.png'

type LogoImageProps = {
  size?: number
}

export function LogoImage({ size = 28 }: LogoImageProps) {
  const { token } = theme.useToken()
  const { mode } = useThemeMode()

  const bgStyle =
    mode === 'dark'
      ? {
          background: token.colorBgElevated || '#1A1A1A',
          border: `1px solid ${token.colorBorderSecondary || '#2A2A2A'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }
      : {
          background: token.colorPrimaryBg || 'rgba(22, 119, 255, 0.08)',
          border: `1px solid ${token.colorBorderSecondary || 'rgba(0,0,0,0.06)'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...bgStyle,
      }}
    >
      <img
        src={logoPng}
        alt=""
        style={{
          width: size * 0.85,
          height: size * 0.85,
          objectFit: 'contain',
        }}
      />
    </div>
  )
}
