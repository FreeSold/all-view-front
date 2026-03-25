import { PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, Button, Space } from 'antd'
import { usePhotoStateContext } from '../../context/PhotoStateContext'

type Props = {
  onOpenImport: () => void
}

/** 图片管理：面包屑右侧工具栏。数据目录选择已统一移至顶部 Header。 */
export function PhotoPageToolbar({ onOpenImport }: Props) {
  const { fs, reauth, needsReauth } = usePhotoStateContext()

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
      <Button icon={<PlusOutlined />} disabled={!fs.rootHandle || needsReauth} onClick={onOpenImport}>
        导入图片
      </Button>
    </Space>
  )
}
