/**
 * 统一数据目录：视频、漫画、图片的元数据都存于此
 * 使用 File System Access API，需 Chrome/Edge
 */

import { idbGet, idbSet } from './photoIdb'

const IDB_KEY = 'photoManagerRootHandle'
const FILE_APP_DATA = 'app-data.json'

let cachedRoot: FileSystemDirectoryHandle | null = null

export function isAppRootSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/** 从 IndexedDB 恢复根目录句柄 */
export async function getRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedRoot) return cachedRoot
  const h = await idbGet<FileSystemDirectoryHandle>(IDB_KEY)
  if (h) cachedRoot = h
  return h
}

const RESERVED_NAMES = ['library', 'thumbs']

/** 用户选择数据目录，保存到 IndexedDB */
export async function pickRoot(): Promise<FileSystemDirectoryHandle> {
  const picker = window.showDirectoryPicker
  if (!picker) throw new Error('showDirectoryPicker not supported')
  const h = await picker({ mode: 'readwrite' })
  const name = (h.name ?? '').toLowerCase()
  if (RESERVED_NAMES.includes(name)) {
    throw new Error(
      `您选择的是 "${h.name}" 文件夹，这是数据目录的子文件夹。请选择其父级目录作为数据目录（即包含 library 和 thumbs 的上一级文件夹）。`
    )
  }
  cachedRoot = h
  await idbSet(IDB_KEY, h)
  return h
}

/** 设置根目录（供 photoFsRepo 等复用） */
export function setCachedRoot(h: FileSystemDirectoryHandle | null): void {
  cachedRoot = h
}

/** 从数据目录读取 app-data.json */
export async function readAppData(): Promise<string | null> {
  const root = await getRoot()
  if (!root) return null
  const ok = await ensurePermission(root, true)
  if (!ok) return null
  try {
    const fh = await root.getFileHandle(FILE_APP_DATA, { create: false })
    const file = await fh.getFile()
    return await file.text()
  } catch (e) {
    if ((e as { name?: string })?.name === 'NotFoundError') return null
    throw e
  }
}

/** 写入 app-data.json 到数据目录 */
export async function writeAppData(json: string): Promise<void> {
  const root = await getRoot()
  if (!root) throw new Error('未选择数据目录')
  const ok = await ensurePermission(root, true)
  if (!ok) throw new Error('没有目录读写权限')
  const fh = await root.getFileHandle(FILE_APP_DATA, { create: true })
  const writable = await fh.createWritable()
  try {
    await writable.write(new Blob([json], { type: 'application/json' }))
  } finally {
    await writable.close()
  }
}

async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  rw: boolean
): Promise<boolean> {
  const opts = rw ? { mode: 'readwrite' as const } : { mode: 'read' as const }
  if (handle.queryPermission && (await handle.queryPermission(opts)) === 'granted') return true
  if (handle.requestPermission && (await handle.requestPermission(opts)) === 'granted') return true
  return false
}
