import { Breadcrumb, Button, Layout, Menu, Modal, Space, theme, Typography } from 'antd'
import { useAppShell } from '../context/AppShellContext'
import { useGlobalLog } from '../context/GlobalLogContext'
import { CaretLeftFilled, CaretRightFilled, QuestionCircleOutlined } from '@ant-design/icons'
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
  const [docOpen, setDocOpen] = useState(false)
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
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined />}
              onClick={() => setDocOpen(true)}
              aria-label="打开系统操作文档"
              title="操作文档"
            />
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

      <Modal
        open={docOpen}
        title="系统操作文档"
        footer={null}
        onCancel={() => setDocOpen(false)}
        width={760}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text>
            本系统支持视频、漫画、图片统一管理。建议先在右上角选择数据目录，再开始录入与导出。
          </Typography.Text>

          <Typography.Title level={5} style={{ margin: 0 }}>
            一、基础操作
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            1）右上角两色块用于切换浅色/深色主题。
            <br />
            2）左侧菜单用于切换模块；图片管理支持目录树筛选、关键词筛选与排序。
            <br />
            3）所有模块优先使用文件句柄引用原文件，减少重复占用空间。
          </Typography.Paragraph>

          <Typography.Title level={5} style={{ margin: 0 }}>
            二、图片管理
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            1）点击“导入图片”可选择文件或文件夹；导入列表支持单项移除与清空列表。
            <br />
            2）“复制当前结果”会把当前筛选结果导出到你选定目录，不会从系统中删除原记录。
            <br />
            3）超大图片若缩略图生成失败，仍可导入并打开原图。
          </Typography.Paragraph>

          <Typography.Title level={5} style={{ margin: 0 }}>
            三、视频 / 漫画管理
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            1）新增作品时选择本地文件，系统保存引用句柄与元数据。
            <br />
            2）可按分类、标签、评分、日期等条件筛选，再批量导出结果。
            <br />
            3）选择目录时若关闭系统窗口，属于“取消操作”，系统不会报错并保持当前状态。
          </Typography.Paragraph>

          <Typography.Title level={5} style={{ margin: 0 }}>
            四、数据与备份建议
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            1）建议将数据目录放在稳定磁盘路径，避免频繁变动盘符。
            <br />
            2）重要数据定期在系统配置中导出备份。
            <br />
            3）迁移电脑时，优先迁移数据目录与备份文件，再重新授权目录访问。
          </Typography.Paragraph>
        </Space>
      </Modal>
    </Layout>
  )
}
