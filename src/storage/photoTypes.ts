export type PhotoImage = {
  id: string
  originalName: string
  sizeBytes: number
  ext?: string
  mime?: string
  width?: number
  height?: number
  orientation?: 'landscape' | 'portrait' | 'unknown'
  createdAt?: number
  importedAt?: number
  /**
   * 展示/筛选用虚拟路径（以 library/ 开头）。
   * - 新版「仅引用」：`library/ref/...`，原图在 IndexedDB 句柄 `sourceRef`
   * - 旧版：真实复制的 `library/年/月/日/...` 文件
   */
  libraryRelPath: string
  /** 若存在：原图仅保存在本地文件句柄（local-handle:photo_xxx），不复制到 library/ */
  sourceRef?: string
  thumbRelPath?: string
  hash?: string
  autoTags?: string[]
  userTags?: string[]
}

export type PhotoUi = {
  theme?: 'light' | 'dark'
  /** 存盘可为历史 `auto`，界面仅提供缩略图 / 列表 */
  viewMode?: 'auto' | 'grid' | 'list'
  activeFolderId?: string
  filters?: {
    formats?: string[]
    sizes?: string[]
    orient?: string[]
    /** 仅匹配用户自定义标签（#xxx） */
    tags?: string[]
    /** 按文件修改时间 createdAt 筛选（闭区间，毫秒） */
    fileTimeRange?: { startMs: number; endMs: number }
  }
  sortRules?: string[]
}

export type PhotoIndex = {
  version: number
  images: PhotoImage[]
  ui?: PhotoUi
}

export type PhotoTagEntry = {
  name: string
  count?: number
  lastUsedAt?: number
  type?: 'user'
}

export type PhotoTags = {
  version: number
  maxCustomTags: number
  tags: PhotoTagEntry[]
}

export type FolderTreeNode = {
  id: string
  name: string
  count: number
  children: FolderTreeNode[]
  expanded?: boolean
}

export type FilterOptions = {
  formats: { id: string; label: string; count: number }[]
  sizes: { id: string; label: string; count: number }[]
  orient: { id: string; label: string; count: number }[]
  tags: { name: string; count: number }[]
}
