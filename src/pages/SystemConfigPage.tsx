import {
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Alert, App, Button, Card, Input, Modal, Space, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { exportAppData, importAppData, migrateToDataDir, resetAllApplicationData } from '../storage/appStore'
import { getRoot, isAppRootSupported, pickRoot } from '../storage/appRoot'
import { useAppConfig } from '../storage/useAppConfig'

export function SystemConfigPage() {
  const { message } = App.useApp()
  const [config, updateConfig] = useAppConfig()
  const { videoPlayerPath: playerPath, videoFilePath: videoPath } = config
  const [selectingPlayer, setSelectingPlayer] = useState(false)
  const [selectingVideo, setSelectingVideo] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [dataDirName, setDataDirName] = useState<string>('')
  const [selectingDataDir, setSelectingDataDir] = useState(false)
  const [clearingData, setClearingData] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI

  useEffect(() => {
    if (isAppRootSupported()) {
      getRoot().then((h) => setDataDirName(h?.name ?? ''))
    }
  }, [])

  const setPlayerPath = useCallback(
    (v: string) => updateConfig((c) => (c.videoPlayerPath = v)),
    [updateConfig],
  )
  const setVideoPath = useCallback(
    (v: string) => updateConfig((c) => (c.videoFilePath = v)),
    [updateConfig],
  )

  const handleSelectPlayer = useCallback(async () => {
    if (isElectron) {
      setSelectingPlayer(true)
      try {
        const path = await window.electronAPI!.selectVideoPlayer()
        if (path) {
          setPlayerPath(path)
          message.success('已选择视频播放器')
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : '选择失败')
      } finally {
        setSelectingPlayer(false)
      }
    } else {
      message.info('请使用桌面端应用（exe）以从资源管理器选择程序，或手动输入路径')
    }
  }, [isElectron, setPlayerPath])

  const handleSelectVideo = useCallback(async () => {
    if (isElectron) {
      setSelectingVideo(true)
      try {
        const path = await window.electronAPI!.selectVideoFile()
        if (path) {
          setVideoPath(path)
          message.success('已选择视频文件')
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : '选择失败')
      } finally {
        setSelectingVideo(false)
      }
    } else {
      message.info('请使用桌面端应用（exe）以从资源管理器选择视频文件，或手动输入路径')
    }
  }, [isElectron, setVideoPath])

  const handlePlay = useCallback(async () => {
    if (!playerPath.trim()) {
      message.warning('请先配置视频播放器路径')
      return
    }
    if (!videoPath.trim()) {
      message.warning('请先选择要播放的视频文件')
      return
    }
    if (isElectron) {
      setPlaying(true)
      try {
        await window.electronAPI!.playVideo(playerPath.trim(), videoPath.trim())
        message.success('已启动播放器')
      } catch (e) {
        message.error(e instanceof Error ? e.message : '播放失败')
      } finally {
        setPlaying(false)
      }
    } else {
      message.info('播放功能需在桌面端应用（exe）中使用')
    }
  }, [isElectron, playerPath, videoPath])

  const handleExport = useCallback(() => {
    const json = exportAppData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `all-view-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已导出备份文件')
  }, [])

  const handleImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleSelectDataDir = useCallback(async () => {
    if (!isAppRootSupported()) {
      message.info('请使用 Chrome 或 Edge 浏览器以选择数据目录')
      return
    }
    setSelectingDataDir(true)
    try {
      const h = await pickRoot()
      if (!h) return
      setDataDirName(h.name)
      const ok = await migrateToDataDir()
      if (ok) {
        message.success('已选择数据目录，数据已迁移。视频、漫画、图片将统一存储于此。')
      } else {
        message.warning('选择成功，但迁移数据失败')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '选择失败')
    } finally {
      setSelectingDataDir(false)
    }
  }, [])

  const handleClearSavedData = useCallback(() => {
    Modal.confirm({
      title: '清除保存数据？',
      content:
        '将删除：浏览器/Electron 内的应用数据；已选数据目录下的 app-data.json、index.json、tags.json；**整个 library/ 与 thumbs/ 文件夹（含其中所有文件）**；本地视频/图片句柄；并重置「已选目录」。数据目录内其它自建文件/文件夹会保留。此操作不可撤销，请先导出备份。',
      okText: '清除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setClearingData(true)
        try {
          await resetAllApplicationData()
          setDataDirName('')
          message.success('已清除，页面将刷新')
          window.location.reload()
        } catch (e) {
          message.error(e instanceof Error ? e.message : '清除失败')
        } finally {
          setClearingData(false)
        }
      },
    })
  }, [])

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const json = String(reader.result)
          const data = importAppData(json)
          if (data) {
            message.success('已恢复备份')
            window.location.reload()
          } else {
            message.error('备份文件格式无效')
          }
        } catch {
          message.error('备份文件格式无效')
        }
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [],
  )

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        系统配置
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        配置本地视频播放器，可在桌面端应用中通过资源管理器选择程序，并播放本地视频文件。
      </Typography.Paragraph>

      {!isElectron && (
        <Alert
          type="info"
          showIcon
          message="浏览器环境限制"
          description="从资源管理器选择程序、选择视频文件及播放功能需在桌面端应用（打包为 exe 后）中使用。当前可手动输入路径进行配置。数据可导出备份，清除网站数据后可通过导入恢复。"
          style={{ marginBottom: 16 }}
        />
      )}

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {isAppRootSupported() && (
          <Card title="数据目录（便携存储）" size="small">
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<FolderOpenOutlined />}
                  onClick={handleSelectDataDir}
                  loading={selectingDataDir}
                >
                  选择数据目录
                </Button>
                {dataDirName && (
                  <Typography.Text type="secondary">
                    当前：{dataDirName}
                  </Typography.Text>
                )}
              </Space>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                选择后，视频、漫画、图片的元数据将统一存于此目录的 app-data.json、index.json 等。
                可将整个目录放在移动硬盘，插到任意电脑使用。
              </Typography.Text>
            </Space>
          </Card>
        )}

        <Card title="数据备份与恢复" size="small">
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出备份
            </Button>
            <Button icon={<UploadOutlined />} onClick={handleImport}>
              导入恢复
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleClearSavedData} loading={clearingData}>
              清除保存数据
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </Space>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
            导出为 JSON 文件保存到本地。已选择数据目录时，数据存于目录内 app-data.json，可整体备份目录。
            「清除保存数据」会删除 JSON、清空 library/ 与 thumbs/、清除已选目录记录并刷新页面，请先导出备份。
          </Typography.Text>
        </Card>

        <Card title="视频播放器配置" size="small">
          <Space.Compact style={{ width: '100%', maxWidth: 560 }}>
            <Input
              placeholder="例如 C:\Program Files\VideoLAN\VLC\vlc.exe"
              value={playerPath}
              onChange={(e) => setPlayerPath(e.target.value)}
              addonBefore={<VideoCameraOutlined />}
            />
            <Button type="primary" onClick={handleSelectPlayer} loading={selectingPlayer}>
              选择程序
            </Button>
          </Space.Compact>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
            点击「选择程序」在资源管理器中选择已安装的视频播放器可执行文件（桌面端应用支持）
          </Typography.Text>
        </Card>

        <Card title="视频文件与播放" size="small">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Space.Compact style={{ width: '100%', maxWidth: 560 }}>
              <Input
                placeholder="例如 D:\Videos\movie.mp4"
                value={videoPath}
                onChange={(e) => setVideoPath(e.target.value)}
                addonBefore={<PlayCircleOutlined />}
              />
              <Button onClick={handleSelectVideo} loading={selectingVideo}>
                选择视频
              </Button>
            </Space.Compact>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePlay} loading={playing}>
              播放
            </Button>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              配置好播放器路径后，选择本地视频文件，点击播放即可用配置的播放器打开视频（桌面端应用支持）
            </Typography.Text>
          </Space>
        </Card>
      </Space>
    </div>
  )
}
