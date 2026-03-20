import { PlusOutlined } from '@ant-design/icons'
import { Button, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { getRoot } from '../storage/appRoot'
import { DataDirButton } from './DataDirButton'

type Props = {
  /** 主操作按钮文案，如「新增作品」「新增漫画」 */
  addLabel: string
  onAdd: () => void
  /** 数据变更后传入（如 refreshKey）以便刷新「数据目录：xxx」展示 */
  rootRefreshKey?: number
  /** 选择数据目录成功后由父组件 bump key 时也可不传；与 rootRefreshKey 二选一或共用 */
  onDirPicked?: () => void
}

/**
 * 视频 / 漫画管理：面包屑右侧工具栏，与图片管理「数据目录 + 选择目录 + 主操作」分布一致
 */
export function MediaAppToolbar({ addLabel, onAdd, rootRefreshKey = 0, onDirPicked }: Props) {
  const [dirName, setDirName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getRoot()
      .then((h) => {
        if (!cancelled) setDirName(h?.name ? String(h.name) : null)
      })
      .catch(() => {
        if (!cancelled) setDirName(null)
      })
    return () => {
      cancelled = true
    }
  }, [rootRefreshKey])

  const handleDirPicked = () => {
    onDirPicked?.()
    getRoot()
      .then((h) => setDirName(h?.name ? String(h.name) : null))
      .catch(() => setDirName(null))
  }

  return (
    <Space wrap style={{ justifyContent: 'flex-end' }}>
      <Typography.Text strong style={{ maxWidth: 220 }} ellipsis>
        {dirName ? `数据目录：${dirName}` : '未选择数据目录'}
      </Typography.Text>
      <DataDirButton onAfterPick={handleDirPicked} />
      <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
        {addLabel}
      </Button>
    </Space>
  )
}
