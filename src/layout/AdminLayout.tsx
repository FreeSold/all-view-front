import { Breadcrumb, Button, Layout, Menu, Space, theme, Typography } from 'antd'
import { useAppShell } from '../context/AppShellContext'
import { useGlobalLog } from '../context/GlobalLogContext'
import { CaretLeftFilled, CaretRightFilled } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { AdminLogo } from './AdminLogo'
import { useAuth } from '../auth/AuthContext'
import { usePhotoFolder } from '../context/PhotoFolderContext'
import { menuItems } from '../menu/menuConfig'
import type { AppMenuItem } from '../menu/menuTypes'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { useThemeMode } from '../theme/ThemeContext'
import type { FolderTreeNode } from '../storage/photoTypes'

const { Header, Content, Sider } = Layout
const PHOTO_FOLDER_PREFIX = 'photo:'

function flatten(items: AppMenuItem[]): AppMenuItem[] {
  const out: AppMenuItem[] = []
  const walk = (arr: AppMenuItem[]) => {
    for (const it of arr) {
      out.push(it)
      if (it.children?.length) walk(it.children)
    }
  }
  walk(items)
  return out
}

function folderToMenuItems(node: FolderTreeNode): MenuProps['items'] {
  const key = `${PHOTO_FOLDER_PREFIX}${node.id}`
  const children = (node.children ?? [])
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((c) => folderToMenuItems(c) ?? [])
  return [
    {
      key,
      label: `${node.name} (${node.count})`,
      children: children.length ? children : undefined,
    },
  ]
}

function toAntdItems(
  items: AppMenuItem[],
  folderTree: FolderTreeNode | null,
  isOnPhotos: boolean
): MenuProps['items'] {
  return items.map((it) => {
    const isPhotos = it.key === 'photos'
    const folderChildren =
      isPhotos && isOnPhotos && folderTree
        ? folderToMenuItems(folderTree)
        : undefined
    return {
      key: it.key,
      label: it.label,
      icon: it.icon,
      children: folderChildren ?? (it.children?.length ? toAntdItems(it.children, folderTree, false) : undefined),
    }
  })
}

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const { mode } = useThemeMode()
  const { user, logout } = useAuth()
  const photoFolder = usePhotoFolder()
  const { lines: logLines, clear: clearLog } = useGlobalLog()
  const { contentHeaderRight } = useAppShell()

  const [collapsed, setCollapsed] = useState(false)
  const isOnPhotos = location.pathname === '/app/photos'

  const flat = useMemo(() => flatten(menuItems), [])
  const pathToKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of flat) {
      if (it.path) map.set(it.path, it.key)
    }
    return map
  }, [flat])

  const selectedKeys = useMemo(() => {
    if (isOnPhotos && photoFolder?.activeFolderId) {
      return [`${PHOTO_FOLDER_PREFIX}${photoFolder.activeFolderId}`]
    }
    const key = pathToKey.get(location.pathname)
    return key ? [key] : []
  }, [location.pathname, pathToKey, isOnPhotos, photoFolder?.activeFolderId])

  const openKeys = useMemo(() => {
    const parents: string[] = []
    for (const p of menuItems) {
      if (p.children?.some((c) => c.path === location.pathname)) parents.push(p.key)
    }
    if (isOnPhotos) parents.push('resource', 'photos')
    return parents
  }, [location.pathname, isOnPhotos])

  const keyToPath = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of flat) {
      if (it.path) map.set(it.key, it.path)
    }
    return map
  }, [flat])

  const menuItemsComputed = useMemo(
    () => toAntdItems(menuItems, photoFolder?.folderTree ?? null, isOnPhotos),
    [photoFolder?.folderTree, isOnPhotos]
  )

  const breadcrumbItems = useMemo(() => {
    const crumbs: { title: string }[] = [{ title: '后台' }]
    const current = flat.find((x) => x.path === location.pathname)
    if (!current) return crumbs
    const parent = menuItems.find((m) => m.children?.some((c) => c.key === current.key))
    if (parent) crumbs.push({ title: parent.label })
    crumbs.push({ title: current.label })
    return crumbs
  }, [flat, location.pathname])

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={260}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
        theme={mode === 'dark' ? 'dark' : 'light'}
      >
        <AdminLogo collapsed={collapsed} />
        <div style={{ flex: 1, minHeight: 0, padding: 8, overflow: 'auto' }}>
          <Menu
            mode="inline"
            theme={mode === 'dark' ? 'dark' : 'light'}
            items={menuItemsComputed}
            selectedKeys={selectedKeys}
            defaultOpenKeys={openKeys}
            onClick={(info) => {
              const key = String(info.key)
              if (key.startsWith(PHOTO_FOLDER_PREFIX)) {
                const folderId = key.slice(PHOTO_FOLDER_PREFIX.length)
                photoFolder?.setActiveFolderId(folderId)
                return
              }
              const path = keyToPath.get(key)
              if (path) navigate(path)
            }}
          />
        </div>
        {!collapsed && (
          <div
            style={{
              flexShrink: 0,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              padding: 8,
              maxHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              background: token.colorBgLayout,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <Typography.Text strong style={{ fontSize: 12 }}>
                日志
              </Typography.Text>
              <Button type="link" size="small" onClick={clearLog} disabled={!logLines.length}>
                清空
              </Button>
            </div>
            <pre
              style={{
                margin: 0,
                fontSize: 10,
                lineHeight: 1.35,
                overflow: 'auto',
                flex: 1,
                minHeight: 0,
                maxHeight: 140,
                color: token.colorTextSecondary,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {logLines.length ? logLines.join('\n') : '—'}
            </pre>
          </div>
        )}
        <div
          onClick={() => setCollapsed((c) => !c)}
          style={{
            position: 'absolute',
            top: '50%',
            right: 0,
            transform: 'translateY(-50%)',
            width: 16,
            height: 80,
            borderTopLeftRadius: 5,
            borderBottomLeftRadius: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: token.colorPrimary,
            border: `1px solid ${token.colorPrimary}`,
            borderRight: 'none',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          {collapsed ? (
            <CaretRightFilled style={{ fontSize: 12, color: '#fff' }} />
          ) : (
            <CaretLeftFilled style={{ fontSize: 12, color: '#fff' }} />
          )}
        </div>
      </Sider>

      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: 16,
            height: 56,
            lineHeight: '56px',
          }}
        >
          <span />
          <Space>
            <ThemeSwitcher />
            <Typography.Text type="secondary">当前用户：{user!.username}</Typography.Text>
            <Button
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              退出登录
            </Button>
          </Space>
        </Header>

        <Content style={{ padding: 16 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <Breadcrumb items={breadcrumbItems} style={{ margin: 0 }} />
            <div style={{ flex: '1 1 auto', display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
              {typeof contentHeaderRight === 'function' ? contentHeaderRight() : null}
            </div>
          </div>
          <div
            style={{
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 12,
              padding: 16,
              minHeight: 360,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
