import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogoImage } from '../components/LogoImage'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { useAuth } from '../auth/AuthContext'
import { useThemeMode } from '../theme/ThemeContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { mode } = useThemeMode()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isDark = mode === 'dark'
  const pageBg = isDark
    ? 'radial-gradient(1200px 600px at 10% 10%, rgba(224, 124, 36, 0.15), transparent 60%), radial-gradient(900px 500px at 90% 20%, rgba(201, 90, 26, 0.12), transparent 55%), #0D0D0D'
    : 'radial-gradient(1200px 600px at 10% 10%, rgba(79, 70, 229, 0.22), transparent 60%), radial-gradient(900px 500px at 90% 20%, rgba(6, 182, 212, 0.18), transparent 55%), #0B1020'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: pageBg,
      }}
    >
      <Card
        style={{ width: 420, borderRadius: 16 }}
        styles={{ body: { padding: 20 } }}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Space align="center" size={8}>
              <LogoImage size={36} />
              <Typography.Title
                level={3}
                style={{
                  margin: 0,
                  fontFamily: "'Nunito', sans-serif",
                  fontWeight: 900,
                  letterSpacing: '0.02em',
                }}
              >
                All Play
              </Typography.Title>
            </Space>
            <ThemeSwitcher />
          </div>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Form
            layout="vertical"
            requiredMark={false}
            initialValues={{ username: 'admin', password: 'admin@123' }}
            onFinish={async (values) => {
              setError(null)
              setLoading(true)
              try {
                await login(values)
                navigate('/app', { replace: true })
              } catch (e) {
                setError(e instanceof Error ? e.message : '登录失败')
              } finally {
                setLoading(false)
              }
            }}
          >
            <Form.Item
              label="账号"
              name="username"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input placeholder="请输入账号" autoFocus />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  )
}
