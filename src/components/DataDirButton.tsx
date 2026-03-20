import { FolderOpenOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { useCallback, useState } from 'react'
import { migrateToDataDir } from '../storage/appStore'
import { isAppRootSupported, pickRoot } from '../storage/appRoot'

type DataDirButtonProps = {
  /** 选择目录并成功迁移后调用（用于刷新顶栏「数据目录」展示等） */
  onAfterPick?: () => void
}

export function DataDirButton({ onAfterPick }: DataDirButtonProps = {}) {
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(async () => {
    if (!isAppRootSupported()) {
      message.info('请使用 Chrome 或 Edge 浏览器以选择数据目录')
      return
    }
    setLoading(true)
    try {
      await pickRoot()
      const ok = await migrateToDataDir()
      if (ok) {
        message.success('已选择数据目录，数据已迁移')
        onAfterPick?.()
      } else {
        message.warning('选择成功，但迁移数据失败')
        onAfterPick?.()
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '选择失败')
    } finally {
      setLoading(false)
    }
  }, [onAfterPick])

  if (!isAppRootSupported()) return null

  return (
    <Button icon={<FolderOpenOutlined />} onClick={handleClick} loading={loading}>
      选择数据目录
    </Button>
  )
}
