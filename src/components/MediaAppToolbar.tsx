import { PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'

type Props = {
  /** 主操作按钮文案，如「新增作品」「新增漫画」 */
  addLabel: string
  onAdd: () => void
}

/**
 * 视频 / 漫画管理：面包屑右侧主操作按钮。
 * 数据目录选择已统一移至顶部 Header，此处仅保留新增按钮。
 */
export function MediaAppToolbar({ addLabel, onAdd }: Props) {
  return (
    <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
      {addLabel}
    </Button>
  )
}
