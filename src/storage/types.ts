export type AccountStatus = 'active' | 'disabled'

export type Account = {
  id: string
  username: string
  displayName: string
  roleId: string
  status: AccountStatus
  createdAt: string
}

export type Role = {
  id: string
  name: string
  code: string
  description?: string
  createdAt: string
}

export type AppConfig = {
  videoPlayerPath: string
  videoFilePath: string
  /** 预留：未来可扩展更多路径配置 */
  customPaths?: Record<string, string>
}

export type VideoSource = {
  id: string
  /** 桌面端 exe 使用的地址：文件路径或 http/https */
  urlExe?: string
  /** 浏览器使用的地址：http/https 或 local-handle:xxx */
  urlBrowser?: string
  /** @deprecated 兼容旧数据，迁移后不再使用 */
  url?: string
  label?: string
}

export type ComicSource = VideoSource

export type Video = {
  id: string
  name: string
  category: string
  /** 标签列表：用于检索与展示（多个标签） */
  tags: string[]
  /** 作品描述：用于详情展示 */
  description: string
  coverUrl: string
  /** 封面原图，点击放大预览时使用 */
  coverOriginalUrl?: string
  actorNames: string[]
  defaultSourceId: string
  sources: VideoSource[]
  createdAt: string
  /** 播放次数统计（全部时间） */
  playCount?: number
  /** 播放时间戳（用于按周/月/年统计） */
  playHistory?: number[]
}

export type Comic = {
  id: string
  name: string
  category: string
  tags: string[]
  description: string
  coverUrl: string
  coverOriginalUrl?: string
  actorNames: string[]
  defaultSourceId: string
  sources: ComicSource[]
  createdAt: string
  playCount?: number
  playHistory?: number[]
}

export type AppData = {
  roles: Role[]
  accounts: Account[]
  videos: Video[]
  comics: Comic[]
  config: AppConfig
}
