import { theme, Typography } from 'antd'
import { LogoImage } from '../components/LogoImage'

export function AdminLogo({ collapsed }: { collapsed: boolean }) {
  const { token } = theme.useToken()
  const textColor = token.colorText

  return (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        paddingInline: collapsed ? 12 : 16,
        gap: 6,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <LogoImage size={28} />
      {!collapsed ? (
        <Typography.Text
          style={{
            color: textColor,
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: '0.01em',
          }}
        >
          All Play
        </Typography.Text>
      ) : null}
    </div>
  )
}
