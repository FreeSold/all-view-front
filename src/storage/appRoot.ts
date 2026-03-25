/**
 * 统一数据目录：视频、漫画、图片的元数据都存于此
 * 使用 File System Access API，需 Chrome/Edge
 *
 * 注意：从 IndexedDB 恢复的句柄在页面加载时调用 requestPermission 会触发
 * SecurityError（需要用户手势）。仅 queryPermission；真正授权在「选择目录」后或显式 allowRequest。
 */

import { idbDelete, idbGet, idbSet } from './photoIdb'

const IDB_KEY = 'photoManagerRootHandle'
// Legacy: kept for backward compatibility (read-only).
const FILE_APP_DATA = 'app-data.json'
// New unified "multi-file" format (written by this project).
// To reduce clutter, application JSON files are stored in a sub-folder under the data root.
const APP_DATA_DIR = 'app'
const FILE_ROLES = 'roles.json'
const FILE_ACCOUNTS = 'accounts.json'
const FILE_VIDEOS = 'videos.json'
const FILE_COMICS = 'comics.json'
const FILE_CONFIG = 'config.json'
const FILE_MEDIA_UI = 'media-ui.json'

/** 数据目录根下由本应用写入的 JSON（清除保存数据时一并删除） */
const KNOWN_JSON_FILES = [
  FILE_APP_DATA,
  'index.json',
  'tags.json',
] as const

async function getAppDataDirHandle(
  root: FileSystemDirectoryHandle,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  // The caller should already hold read/write permission for the root.
  return await root.getDirectoryHandle(APP_DATA_DIR, { create })
}

/** 清除数据时递归删除的子目录（图片库与缩略图） */
const MANAGED_SUBDIRS = ['library', 'thumbs'] as const

let cachedRoot: FileSystemDirectoryHandle | null = null

export function isAppRootSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/** 用户在系统目录选择器中点「取消」或关闭窗口时，Chromium 会抛 DOMException（非业务错误） */
export function isDirectoryPickerUserAbort(error: unknown): boolean {
  if (error == null) return false
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name: string }).name)
      : ''
  if (name === 'AbortError') return true
  const message = error instanceof Error ? error.message : String(error)
  return /user aborted|aborted a request/i.test(message)
}

/** 从 IndexedDB 恢复根目录句柄 */
export async function getRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedRoot) return cachedRoot
  const h = await idbGet<FileSystemDirectoryHandle>(IDB_KEY)
  if (h) cachedRoot = h
  return h
}

export function isElectronShell(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

// If user picks a sub-folder as "data root", internal paths would become app/app/... for new format.
// Reserve both legacy folders and the new "app/" folder to force selecting the parent directory.
const RESERVED_NAMES = ['library', 'thumbs', 'app']

/**
 * 检查目录权限。allowRequest=false 时绝不调用 requestPermission（避免无手势 SecurityError）。
 *
 * Electron 内置 Chromium 有时未实现 queryPermission，或句柄从 IDB 恢复后 query 长期为 prompt；
 * 无 query API 且无需弹窗时视为可尝试访问（具体读写失败再由底层报错）。
 */
export async function ensureDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  rw: boolean,
  allowRequest = false,
): Promise<boolean> {
  const opts = rw ? { mode: 'readwrite' as const } : { mode: 'read' as const }
  try {
    const queryPermission = handle.queryPermission
    const hasQuery = typeof queryPermission === 'function'
    if (hasQuery) {
      const q = await queryPermission.call(handle, opts)
      if (q === 'granted') return true
      if (!allowRequest) return false
    } else {
      if (!allowRequest) return true
    }

    if (allowRequest && typeof handle.requestPermission === 'function') {
      const r = await handle.requestPermission(opts)
      return r === 'granted'
    }

    // 无 queryPermission 且调用方允许弹窗，但环境未提供 requestPermission
    if (!hasQuery && allowRequest) {
      return true
    }
  } catch {
    return false
  }
  return false
}

/**
 * 用户选择数据目录，保存到 IndexedDB；刚选完可带手势，立即尝试拿到读写权限。
 * 若用户取消或关闭选择器，返回 null（不抛错）。
 */
export async function pickRoot(): Promise<FileSystemDirectoryHandle | null> {
  const picker = window.showDirectoryPicker
  if (!picker) throw new Error('showDirectoryPicker not supported')
  let h: FileSystemDirectoryHandle
  try {
    h = await picker({ mode: 'readwrite' })
  } catch (e) {
    if (isDirectoryPickerUserAbort(e)) return null
    throw e
  }
  const name = (h.name ?? '').toLowerCase()
  if (RESERVED_NAMES.includes(name)) {
    throw new Error(
      `您选择的是 "${h.name}" 文件夹，这是数据目录的子文件夹。请选择其父级目录作为数据目录（即包含 library 和 thumbs 的上一级文件夹）。`,
    )
  }
  cachedRoot = h
  await idbSet(IDB_KEY, h)
  await ensureDirectoryPermission(h, true, true)
  return h
}

/** 设置根目录（供 photoFsRepo 等复用） */
export function setCachedRoot(h: FileSystemDirectoryHandle | null): void {
  cachedRoot = h
}

/**
 * 删除当前已选数据目录下的已知 JSON（需已有读写权限；按钮点击时可传 allowRequest=true）
 * 应在清除 IndexedDB 目录句柄之前调用。
 */
export async function removeKnownJsonFromDataDir(allowRequest: boolean): Promise<void> {
  const root = await getRoot()
  if (!root) return
  const ok = await ensureDirectoryPermission(root, true, allowRequest)
  if (!ok) return
  for (const name of KNOWN_JSON_FILES) {
    try {
      await root.removeEntry(name)
    } catch {
      // 不存在或无权限时忽略
    }
  }
}

/**
 * 递归删除数据目录下的 library/、thumbs/（清除保存数据时调用，与 JSON 一并清空应用占用的文件夹内容）
 */
export async function removeLibraryAndThumbsFromDataDir(allowRequest: boolean): Promise<void> {
  const root = await getRoot()
  if (!root) return
  const ok = await ensureDirectoryPermission(root, true, allowRequest)
  if (!ok) return
  for (const name of MANAGED_SUBDIRS) {
    try {
      await root.removeEntry(name, { recursive: true })
    } catch {
      // 不存在或无权限时忽略
    }
  }
}

/** 清除应用数据子文件夹（包含 roles/accounts/videos/comics/config/media-ui 等） */
export async function removeAppDataDirFromDataDir(allowRequest: boolean): Promise<void> {
  const root = await getRoot()
  if (!root) return
  const ok = await ensureDirectoryPermission(root, true, allowRequest)
  if (!ok) return
  try {
    await root.removeEntry(APP_DATA_DIR, { recursive: true })
  } catch {
    // ignore
  }
}

/** 清除 IndexedDB 中保存的目录句柄并重置内存缓存（「未选择目录」状态） */
export async function clearPersistedRootHandle(): Promise<void> {
  await idbDelete(IDB_KEY)
  cachedRoot = null
}

/** 从数据目录读取 app-data.json（默认不 requestPermission，仅 query） */
export async function readAppData(allowRequest = false): Promise<string | null> {
  const root = await getRoot()
  if (!root) return null
  const ok = await ensureDirectoryPermission(root, true, allowRequest)
  if (!ok) return null
  try {
    // 1) Try legacy unified file first.
    try {
      const fh = await root.getFileHandle(FILE_APP_DATA, { create: false })
      const file = await fh.getFile()
      return await file.text()
    } catch (e) {
      if ((e as { name?: string })?.name !== 'NotFoundError') throw e
    }

    // 2) Multi-file format (stored under APP_DATA_DIR).
    const readText = async (fileName: string): Promise<string | null> => {
      try {
        const appDir = await getAppDataDirHandle(root, false)
        const fh = await appDir.getFileHandle(fileName, { create: false })
        const file = await fh.getFile()
        return await file.text()
      } catch (e) {
        // Backward compatible: earlier versions wrote these JSON directly under root.
        if ((e as { name?: string })?.name === 'NotFoundError') {
          try {
            const fh = await root.getFileHandle(fileName, { create: false })
            const file = await fh.getFile()
            return await file.text()
          } catch (e2) {
            if ((e2 as { name?: string })?.name === 'NotFoundError') return null
            throw e2
          }
        }
        throw e
      }
    }

    const rolesRaw = await readText(FILE_ROLES)
    const accountsRaw = await readText(FILE_ACCOUNTS)
    const videosRaw = await readText(FILE_VIDEOS)
    const comicsRaw = await readText(FILE_COMICS)
    const configRaw = await readText(FILE_CONFIG)
    if (!rolesRaw || !accountsRaw || !videosRaw || !comicsRaw || !configRaw) return null

    const mediaUiRaw = await readText(FILE_MEDIA_UI)

    const assembled = {
      roles: JSON.parse(rolesRaw),
      accounts: JSON.parse(accountsRaw),
      videos: JSON.parse(videosRaw),
      comics: JSON.parse(comicsRaw),
      config: JSON.parse(configRaw),
      mediaUi: mediaUiRaw ? JSON.parse(mediaUiRaw) : {},
    }

    return JSON.stringify(assembled)
  } catch (e) {
    if ((e as { name?: string })?.name === 'NotFoundError') return null
    throw e
  }
}

/** 写入 app-data.json；无手势场景请 allowRequest=false，若未授权会抛错由上层降级 */
export async function writeAppData(json: string, allowRequest = false): Promise<void> {
  const root = await getRoot()
  if (!root) throw new Error('未选择数据目录')
  const ok = await ensureDirectoryPermission(root, true, allowRequest)
  if (!ok) throw new Error('没有目录读写权限')
  const data = JSON.parse(json) as {
    roles?: unknown
    accounts?: unknown
    videos?: unknown
    comics?: unknown
    config?: unknown
    mediaUi?: unknown
  }

  const appDir = await getAppDataDirHandle(root, true)

  const writeJson = async (fileName: string, value: unknown): Promise<void> => {
    const fh = await appDir.getFileHandle(fileName, { create: true })
    const writable = await fh.createWritable()
    try {
      await writable.write(new Blob([JSON.stringify(value)], { type: 'application/json' }))
    } finally {
      await writable.close()
    }
  }

  await writeJson(FILE_ROLES, data.roles ?? [])
  await writeJson(FILE_ACCOUNTS, data.accounts ?? [])
  await writeJson(FILE_VIDEOS, data.videos ?? [])
  await writeJson(FILE_COMICS, data.comics ?? [])
  await writeJson(FILE_CONFIG, data.config ?? {})
  await writeJson(FILE_MEDIA_UI, data.mediaUi ?? {})
}
