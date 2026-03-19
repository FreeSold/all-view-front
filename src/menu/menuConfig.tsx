import { AppstoreOutlined, BookOutlined, FolderOutlined, PictureOutlined, PlaySquareOutlined, SettingOutlined, ToolOutlined, UserOutlined } from '@ant-design/icons'
import type { AppMenuItem } from './menuTypes'

export const menuItems: AppMenuItem[] = [
  {
    key: 'dashboard',
    label: '首页',
    path: '/app/dashboard',
    icon: <AppstoreOutlined />,
  },
  {
    key: 'resource',
    label: '资源管理',
    icon: <FolderOutlined />,
    children: [
      {
        key: 'videos',
        label: '视频管理',
        path: '/app/videos',
        icon: <PlaySquareOutlined />,
      },
      {
        key: 'comics',
        label: '漫画管理',
        path: '/app/comics',
        icon: <BookOutlined />,
      },
      {
        key: 'photos',
        label: '图片管理',
        path: '/app/photos',
        icon: <PictureOutlined />,
      },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    icon: <SettingOutlined />,
    children: [
      {
        key: 'accounts',
        label: '账号管理',
        path: '/app/accounts',
        icon: <UserOutlined />,
      },
      {
        key: 'system-config',
        label: '系统配置',
        path: '/app/system-config',
        icon: <ToolOutlined />,
      },
    ],
  },
]
