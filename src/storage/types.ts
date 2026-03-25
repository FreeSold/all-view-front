export type AccountStatus = 'active' | 'disabled'

export type Account = {
  id: string
  username: string
  displayName: string
  roleId: string
  status: AccountStatus
  /** 登录口令（Demo：明文存储，仅用于本地演示；真实场景建议改为 hash） */
  password?: string
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

/** 视频/漫画列表页 UI 与筛选偏好（存 app-data.json，与作品数组分离便于复用） */
export type MediaLibraryViewMode = 'grid' | 'list'

export type MediaLibraryUiState = {
  viewMode?: MediaLibraryViewMode
  filterExpanded?: boolean
  listPageSize?: number
  /** 列表工具栏搜索 */
  searchKeyword?: string
  searchField?: 'name' | 'id' | 'actors' | 'category' | 'tags'
  /** 面板内：精确分类多选（作品 category 需命中其一） */
  categoryFilters?: string[]
  /** 面板内：标签多选（作品需包含全部所选标签） */
  tagFilters?: string[]
  /** 创建时间闭区间（ms） */
  createdRange?: { startMs: number; endMs: number }
  sortBy?: 'createdAt' | 'name' | 'playCount'
  sortOrder?: 'asc' | 'desc'
}

export type AppData = {
  roles: Role[]
  accounts: Account[]
  videos: Video[]
  comics: Comic[]
  config: AppConfig
  /** 各模块列表 UI，键与业务模块对应 */
  mediaUi?: {
    video?: MediaLibraryUiState
    comic?: MediaLibraryUiState
  }
}
