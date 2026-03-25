/**
 * 统一存储层：
 * - Electron：app-data.json 在用户目录
 * - 浏览器：优先使用用户选择的数据目录（app-data.json），否则 localStorage
 */
import type { AppData, AppConfig, Comic, Video } from './types'
import {
  clearPersistedRootHandle,
  getRoot,
  readAppData,
  removeKnownJsonFromDataDir,
  removeAppDataDirFromDataDir,
  removeLibraryAndThumbsFromDataDir,
  writeAppData,
} from './appRoot'
import { clearAllLocalVideoHandles } from './localFileStore'

const BROWSER_STORAGE_KEY = 'all-view-front/app-data'
const LEGACY_STORAGE_KEY = 'all-view-front/mock-db'

const defaultConfig: AppConfig = {
  videoPlayerPath: '',
  videoFilePath: '',
}

const SAMPLE_COVERS = [
  'https://picsum.photos/seed/v1/200/280',
  'https://picsum.photos/seed/v2/200/280',
  'https://picsum.photos/seed/v3/200/280',
  'https://picsum.photos/seed/v4/200/280',
  'https://picsum.photos/seed/v5/200/280',
]

function getDefaultData(): AppData {
  const now = () => new Date().toISOString()
  const vid = (i: number) => `vid_${i}`
  const sid = (v: number, i: number) => `src_${v}_${i}`
  const videos: Video[] = [
    {
      id: vid(1),
      name: '示例作品一',
      category: '默认分类',
      tags: ['示例', '推荐'],
      description: '这里是作品描述示例。你可以在作品详情中编辑它，用于补充背景、亮点或备注信息。',
      coverUrl: SAMPLE_COVERS[0],
      actorNames: ['演员A', '演员B'],
      defaultSourceId: sid(1, 0),
      sources: [{ id: sid(1, 0), urlExe: 'https://example.com/v1.mp4', urlBrowser: 'https://example.com/v1.mp4', label: '源1' }],
      playCount: 0,
      playHistory: [],
      createdAt: now(),
    },
    {
      id: vid(2),
      name: '示例作品二',
      category: '默认分类',
      tags: ['示例'],
      description: '',
      coverUrl: SAMPLE_COVERS[1],
      actorNames: ['演员C'],
      defaultSourceId: sid(2, 0),
      sources: [{ id: sid(2, 0), urlExe: 'https://example.com/v2.mp4', urlBrowser: 'https://example.com/v2.mp4' }],
      playCount: 0,
      playHistory: [],
      createdAt: now(),
    },
    {
      id: vid(3),
      name: '示例作品三',
      category: '默认分类',
      tags: [],
      description: '',
      coverUrl: SAMPLE_COVERS[2],
      actorNames: ['演员D', '演员E', '演员F'],
      defaultSourceId: sid(3, 0),
      sources: [
        { id: sid(3, 0), urlExe: 'https://example.com/v3a.mp4', urlBrowser: 'https://example.com/v3a.mp4' },
        { id: sid(3, 1), urlExe: 'https://example.com/v3b.mp4', urlBrowser: 'https://example.com/v3b.mp4', label: '备用' },
      ],
      playCount: 0,
      playHistory: [],
      createdAt: now(),
    },
  ]
  const cid = (i: number) => `cid_${i}`
  const csid = (v: number, i: number) => `csrc_${v}_${i}`
  const comics: Comic[] = [
    {
      id: cid(1),
      name: '示例漫画一',
      category: '默认分类',
      tags: ['示例', '漫画'],
      description: '这是漫画示例作品。你可以在漫画管理中新增、编辑与统计观看次数。',
      coverUrl: SAMPLE_COVERS[3],
      actorNames: ['作者A'],
      defaultSourceId: csid(1, 0),
      sources: [{ id: csid(1, 0), urlBrowser: 'https://example.com/comic-1', label: '在线地址' }],
      playCount: 0,
      playHistory: [],
      createdAt: now(),
    },
  ]
  return {
    mediaUi: {},
    roles: [
      { id: 'r_admin', name: '管理员', code: 'admin', description: '系统全权限（Demo）', createdAt: now() },
      { id: 'r_operator', name: '运营', code: 'operator', description: '部分功能可见（Demo）', createdAt: now() },
    ],
    accounts: [
      {
        id: 'u_admin',
        username: 'admin',
        displayName: '系统管理员',
        roleId: 'r_admin',
        status: 'active',
        // Demo password (kept as plain text for local demo).
        password: 'admin@123',
        createdAt: now(),
      },
      {
        id: 'u_operator',
        username: 'operator',
        displayName: '运营同学',
        roleId: 'r_operator',
        status: 'active',
        // Demo password (kept as plain text for local demo).
        password: 'operator123',
        createdAt: now(),
      },
    ],
    videos,
    comics,
    config: { ...defaultConfig },
  }
}

function migrateVideoSource(s: { id: string; url?: string; urlExe?: string; urlBrowser?: string; label?: string }) {
  const next = { ...s }
  if (next.url) {
    const u = next.url
    if (u.startsWith('http://') || u.startsWith('https://')) {
      next.urlExe = u
      next.urlBrowser = u
    } else if (u.startsWith('local-handle:')) {
      next.urlBrowser = u
    } else {
      next.urlExe = u
    }
    delete (next as { url?: string }).url
  }
  return next
}

function parseData(raw: string): AppData | null {
  try {
    const data = JSON.parse(raw) as Partial<AppData>
    if (!data || !Array.isArray(data.roles) || !Array.isArray(data.accounts)) return null
    data.config = { ...defaultConfig, ...data.config }
    // Backward compatibility for old data without password.
    data.accounts = (data.accounts ?? []).map((a) => {
      const acc = a as { username?: unknown; password?: unknown }
      if (typeof acc.password === 'string') return a
      const username = typeof acc.username === 'string' ? acc.username : ''
      if (username.toLowerCase() === 'admin') return { ...a, password: 'admin@123' }
      if (username.toLowerCase() === 'operator') return { ...a, password: 'operator123' }
      return a
    })
    if (!Array.isArray(data.videos)) data.videos = []
    if (!Array.isArray((data as Partial<AppData>).comics)) (data as Partial<AppData>).comics = []
    if (!(data as Partial<AppData>).mediaUi || typeof (data as Partial<AppData>).mediaUi !== 'object') {
      ;(data as Partial<AppData>).mediaUi = {}
    }
    // 迁移旧数据：补齐视频的分类字段
    data.videos = data.videos.map((v) => {
      const playCount = v.playCount ?? 0
      let playHistory = Array.isArray(v.playHistory) ? v.playHistory : []
      // 历史数据有 playCount 但无 playHistory 时，按过去一年均匀分布回填，以便周/月/年统计可用
      if (playCount > 0 && playHistory.length === 0) {
        const now = Date.now()
        const yearMs = 365 * 24 * 60 * 60 * 1000
        playHistory = Array.from({ length: playCount }, (_, i) =>
          now - ((playCount - 1 - i) / Math.max(1, playCount - 1)) * yearMs,
        )
      }
      const tags = Array.isArray((v as Partial<Video>).tags) ? (v as Partial<Video>).tags!.filter((t) => typeof t === 'string') : []
      const description = typeof (v as Partial<Video>).description === 'string' ? (v as Partial<Video>).description! : ''
      return { ...v, category: v.category ?? '', tags, description, playCount, playHistory }
    })
    // 迁移播放地址：url -> urlExe / urlBrowser
    data.videos = data.videos.map((v) => ({
      ...v,
      sources: (v.sources || []).map((s) => migrateVideoSource(s)),
    }))

    // 迁移漫画数据：结构与视频一致
    ;(data as Partial<AppData>).comics = ((data as Partial<AppData>).comics || []).map((c) => {
      const playCount = (c as Partial<Comic>).playCount ?? 0
      let playHistory = Array.isArray((c as Partial<Comic>).playHistory) ? (c as Partial<Comic>).playHistory! : []
      if (playCount > 0 && playHistory.length === 0) {
        const now = Date.now()
        const yearMs = 365 * 24 * 60 * 60 * 1000
        playHistory = Array.from({ length: playCount }, (_, i) =>
          now - ((playCount - 1 - i) / Math.max(1, playCount - 1)) * yearMs,
        )
      }
      const tags = Array.isArray((c as Partial<Comic>).tags)
        ? (c as Partial<Comic>).tags!.filter((t) => typeof t === 'string')
        : []
      const description = typeof (c as Partial<Comic>).description === 'string' ? (c as Partial<Comic>).description! : ''
      const category = (c as Partial<Comic>).category ?? ''
      const sources = (((c as Partial<Comic>).sources as unknown[]) || []).map((s) =>
        migrateVideoSource(s as { id: string; url?: string; urlExe?: string; urlBrowser?: string; label?: string }),
      )
      const defaultSourceId = typeof (c as Partial<Comic>).defaultSourceId === 'string' ? (c as Partial<Comic>).defaultSourceId! : ''
      return { ...c, category, tags, description, playCount, playHistory, sources, defaultSourceId } as Comic
    })
    return data as AppData
  } catch {
    return null
  }
}

/** 浏览器：从 localStorage 读取（兼容旧版 mock-db） */
function loadFromBrowser(): AppData {
  let raw = localStorage.getItem(BROWSER_STORAGE_KEY)
  if (!raw) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      try {
        const old = JSON.parse(legacy) as { roles?: unknown[]; accounts?: unknown[] }
        if (Array.isArray(old.roles) && Array.isArray(old.accounts)) {
          raw = JSON.stringify({
            roles: old.roles,
            accounts: old.accounts,
            videos: [],
            comics: [],
            config: defaultConfig,
            mediaUi: {},
          })
          localStorage.setItem(BROWSER_STORAGE_KEY, raw)
          localStorage.removeItem(LEGACY_STORAGE_KEY)
        }
      } catch {
        // ignore
      }
    }
  }
  let data = raw ? parseData(raw) : null
  if (!data) return getDefaultData()
  // 迁移旧版独立存储的路径配置
  const oldPlayer = localStorage.getItem('all-view-front/video-player-path')
  const oldVideo = localStorage.getItem('all-view-front/video-file-path')
  if (oldPlayer || oldVideo) {
    data.config.videoPlayerPath = oldPlayer || data.config.videoPlayerPath
    data.config.videoFilePath = oldVideo || data.config.videoFilePath
    saveToBrowser(data)
    localStorage.removeItem('all-view-front/video-player-path')
    localStorage.removeItem('all-view-front/video-file-path')
  }
  return data
}

/** 浏览器：写入 localStorage */
function saveToBrowser(data: AppData): void {
  try {
    localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('appStore: save failed', e)
  }
}

let cached: AppData = getDefaultData()
let saveTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 150

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    saveTimer = null
    if (typeof window !== 'undefined' && window.electronAPI?.storageWrite) {
      window.electronAPI.storageWrite(JSON.stringify(cached)).catch(console.warn)
    } else {
      const root = await getRoot()
      if (root) {
        try {
          await writeAppData(JSON.stringify(cached), false)
        } catch (e) {
          console.warn('appStore: save to data dir failed', e)
          saveToBrowser(cached)
        }
      } else {
        saveToBrowser(cached)
      }
    }
  }, SAVE_DEBOUNCE_MS)
}

/** 加载数据（Electron 异步，浏览器优先数据目录） */
export async function loadAppData(): Promise<AppData> {
  if (typeof window !== 'undefined' && window.electronAPI?.storageRead) {
    const raw = await window.electronAPI.storageRead()
    const data = raw ? parseData(raw) : null
    cached = data || getDefaultData()
  } else {
    const raw = await readAppData()
    if (raw) {
      const data = parseData(raw)
      cached = data || loadFromBrowser()
    } else {
      cached = loadFromBrowser()
    }
  }
  return cached
}

/** 获取当前数据（同步） */
export function getAppData(): AppData {
  return cached
}

/** 更新数据并持久化 */
export function updateAppData(updater: (d: AppData) => void): void {
  updater(cached)
  debouncedSave()
}

/** 导出为 JSON 字符串（用于备份） */
export function exportAppData(): string {
  return JSON.stringify(cached, null, 2)
}

/** 从 JSON 导入（用于恢复） */
export function importAppData(json: string): AppData | null {
  const data = parseData(json)
  if (!data) return null
  cached = data
  debouncedSave()
  return cached
}

/** 将当前数据迁移到数据目录（选择数据目录后调用，需用户手势后 allowRequest） */
export async function migrateToDataDir(): Promise<boolean> {
  try {
    await writeAppData(JSON.stringify(cached), true)
    return true
  } catch {
    return false
  }
}

/**
 * 用户刚通过「选择数据目录」授权后：读取该目录下已有 app-data.json（若存在）并载入内存，
 * 同时写入 Electron 侧 app-data.json，便于 exe 与浏览器共用同一数据文件夹。
 */
export async function mergeAppDataFromDataDirAfterPick(): Promise<boolean> {
  try {
    const raw = await readAppData(true)
    if (!raw) return false
    const data = parseData(raw)
    if (!data) return false
    cached = data
    if (typeof window !== 'undefined' && window.electronAPI?.storageWrite) {
      await window.electronAPI.storageWrite(JSON.stringify(cached))
    }
    debouncedSave()
    return true
  } catch {
    return false
  }
}

/**
 * Electron 启动：exe 旁先读了 app-data.json 后，若 IndexedDB 里仍有上次选过的数据目录，
 * 尝试读取目录内 app-data.json 并写回 exe，使视频/漫画等与便携文件夹一致（无需先点「选择目录」）。
 */
export async function trySyncAppDataFromPersistedRootOnElectronStartup(): Promise<void> {
  if (typeof window === 'undefined' || !window.electronAPI?.storageWrite) return
  try {
    const raw = await readAppData(false)
    if (!raw) return
    const data = parseData(raw)
    if (!data) return
    cached = data
    await window.electronAPI.storageWrite(JSON.stringify(cached))
  } catch {
    // 无权限或目录不可读时忽略，用户可再选目录
  }
}

/**
 * 清除所有本地持久化数据：数据目录内 JSON、**library/ 与 thumbs/ 整棵子树**（递归删除）、
 * 浏览器 localStorage、IndexedDB 中的目录句柄与本地视频句柄、Electron 侧 app-data.json；
 * 内存中的缓存重置为默认数据。调用后建议 `location.reload()`。
 */
export async function resetAllApplicationData(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }

  await removeKnownJsonFromDataDir(true)
  await removeAppDataDirFromDataDir(true)
  await removeLibraryAndThumbsFromDataDir(true)
  await clearPersistedRootHandle()

  try {
    localStorage.removeItem(BROWSER_STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.removeItem('all-view-front/video-player-path')
    localStorage.removeItem('all-view-front/video-file-path')
  } catch {
    // ignore
  }

  try {
    await clearAllLocalVideoHandles()
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined' && window.electronAPI?.storageDelete) {
    try {
      await window.electronAPI.storageDelete()
    } catch (e) {
      console.warn('appStore: storageDelete failed', e)
    }
  }

  cached = getDefaultData()
}
