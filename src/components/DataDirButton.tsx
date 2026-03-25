import { FolderOpenOutlined } from '@ant-design/icons'
import { App, Button } from 'antd'
import { useCallback, useState } from 'react'
import { mergeAppDataFromDataDirAfterPick, migrateToDataDir } from '../storage/appStore'
import { isAppRootSupported, pickRoot } from '../storage/appRoot'

type DataDirButtonProps = {
  /** 选择目录并成功迁移后调用（用于刷新顶栏「数据目录」展示等） */
  onAfterPick?: () => void
}

export function DataDirButton({ onAfterPick }: DataDirButtonProps = {}) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(async () => {
    if (!isAppRootSupported()) {
      message.info('请使用 Chrome 或 Edge 浏览器以选择数据目录')
      return
    }
    setLoading(true)
    try {
      const picked = await pickRoot()
      if (!picked) return
      const merged = await mergeAppDataFromDataDirAfterPick()
      const ok = await migrateToDataDir()
      if (merged && ok) {
        message.success('已选择数据目录，已加载 app-data.json 并同步到本地，即将刷新页面')
        onAfterPick?.()
        window.location.reload()
        return
      }
      if (merged) {
        message.success('已加载文件夹中的 app-data.json，即将刷新页面')
        onAfterPick?.()
        window.location.reload()
        return
      }
      if (ok) {
        message.success('已选择数据目录，当前数据已写入文件夹')
        onAfterPick?.()
      } else {
        message.warning('选择成功，但写入 app-data.json 失败')
        onAfterPick?.()
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '选择失败')
    } finally {
      setLoading(false)
    }
  }, [onAfterPick, message])

  if (!isAppRootSupported()) return null

  return (
    <Button icon={<FolderOpenOutlined />} onClick={handleClick} loading={loading}>
      选择数据目录
    </Button>
  )
}
