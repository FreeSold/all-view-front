import { FolderOpenOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, Button, Space, Typography } from 'antd'
import { usePhotoStateContext } from '../../context/PhotoStateContext'

type Props = {
  onOpenImport: () => void
}

/** 图片管理：面包屑右侧工具栏（与漫画管理顶栏两侧布局一致） */
export function PhotoPageToolbar({ onOpenImport }: Props) {
  const { fs, pickRoot, reauth, needsReauth } = usePhotoStateContext()

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%', alignItems: 'flex-end' }}>
      {needsReauth && (
        <Alert
          type="warning"
          showIcon
          style={{ padding: '4px 12px', width: '100%' }}
          message={
            <Space>
              <span>
                已记住目录「{fs.rootName}」，但需重新授权才能读写（桌面端每次启动需重新授权一次）。
              </span>
              <Button
                size="small"
                type="primary"
                icon={<SafetyCertificateOutlined />}
                onClick={reauth}
              >
                重新授权
              </Button>
            </Space>
          }
        />
      )}
      <Space wrap style={{ justifyContent: 'flex-end' }}>
        <Typography.Text strong style={{ maxWidth: 220 }} ellipsis>
          {fs.rootHandle ? `数据目录：${fs.rootName}` : '未选择数据目录'}
        </Typography.Text>
        <Button type="primary" icon={<FolderOpenOutlined />} onClick={pickRoot}>
          选择数据目录
        </Button>
        <Button icon={<PlusOutlined />} disabled={!fs.rootHandle || needsReauth} onClick={onOpenImport}>
          导入图片
        </Button>
      </Space>
    </Space>
  )
}
