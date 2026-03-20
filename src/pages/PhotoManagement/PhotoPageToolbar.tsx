import { FolderOpenOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Space, Typography } from 'antd'
import { usePhotoStateContext } from '../../context/PhotoStateContext'

type Props = {
  onOpenImport: () => void
}

/** 图片管理：面包屑右侧工具栏（与漫画管理顶栏两侧布局一致） */
export function PhotoPageToolbar({ onOpenImport }: Props) {
  const { fs, pickRoot } = usePhotoStateContext()

  return (
    <Space wrap style={{ justifyContent: 'flex-end' }}>
      <Typography.Text strong style={{ maxWidth: 220 }} ellipsis>
        {fs.rootHandle ? `数据目录：${fs.rootName}` : '未选择数据目录'}
      </Typography.Text>
      <Button type="primary" icon={<FolderOpenOutlined />} onClick={pickRoot}>
        选择数据目录
      </Button>
      <Button icon={<PlusOutlined />} disabled={!fs.rootHandle} onClick={onOpenImport}>
        导入图片
      </Button>
    </Space>
  )
}
