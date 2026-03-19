/**
 * File System Access API for PhotoManager - directory read/write, import, thumbs
 */

import { idbGet, idbSet } from './photoIdb'
import { sha256Hex } from '../util/photoHash'
import type { PhotoIndex, PhotoTags } from './photoTypes'

const IDB_KEY = 'photoManagerRootHandle'
const FILE_INDEX = 'index.json'
const FILE_TAGS = 'tags.json'
const RESERVED_NAMES = ['library', 'thumbs']

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export class PhotoFsRepo {
  rootHandle: FileSystemDirectoryHandle | null = null

  async pickRoot(): Promise<FileSystemDirectoryHandle> {
    const picker = window.showDirectoryPicker
    if (!picker) throw new Error('showDirectoryPicker not supported')
    const h = await picker({ mode: 'readwrite' })
    const name = (h.name ?? '').toLowerCase()
    if (RESERVED_NAMES.includes(name)) {
      throw new Error(
        `您选择的是 "${h.name}" 文件夹，这是数据目录的子文件夹。请选择其父级目录作为数据目录（即包含 library 和 thumbs 的上一级文件夹）。`
      )
    }
    this.rootHandle = h
    await idbSet(IDB_KEY, h)
    return h
  }

  async tryRestoreRoot(): Promise<FileSystemDirectoryHandle | null> {
    const h = await idbGet<FileSystemDirectoryHandle>(IDB_KEY)
    if (!h) return null
    this.rootHandle = h
    return h
  }

  async ensureDirs(): Promise<void> {
    await this._requireRoot()
    await this._ensureDir('library')
    await this._ensureDir('thumbs')
  }

  async loadAll(): Promise<{ index: PhotoIndex | null; tags: PhotoTags | null }> {
    await this._requireRoot()
    const index = (await this._readJson(FILE_INDEX).catch(() => null)) as PhotoIndex | null
    const tags = (await this._readJson(FILE_TAGS).catch(() => null)) as PhotoTags | null
    return { index, tags }
  }

  async saveIndex(index: PhotoIndex): Promise<void> {
    await this._requireRoot()
    await this._writeJson(FILE_INDEX, index)
  }

  async saveTags(tags: PhotoTags): Promise<void> {
    await this._requireRoot()
    await this._writeJson(FILE_TAGS, tags)
  }

  async pickImageFiles(): Promise<File[]> {
    const picker = window.showOpenFilePicker
    if (!picker) throw new Error('showOpenFilePicker not supported')
    const handles = await picker({
      multiple: true,
      types: [
        {
          description: 'Images',
          accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.heic'],
          },
        },
      ],
    })
    const files: File[] = []
    for (const h of handles) files.push(await h.getFile())
    return files.filter((f) => isImageFile(f))
  }

  async pickImageFolderRecursive(): Promise<File[]> {
    const picker = window.showDirectoryPicker
    if (!picker) throw new Error('showDirectoryPicker not supported')
    const dir = await picker({ mode: 'read' })
    const out: File[] = []
    for await (const entry of walkDirExcluding(dir, RESERVED_NAMES)) {
      if (entry.kind === 'file') {
        const file = await (entry as FileSystemFileHandle).getFile()
        if (isImageFile(file)) out.push(file)
      }
    }
    return out
  }

  async copyIntoLibrary(file: File, libraryRelPath: string): Promise<void> {
    await this._requireRoot()
    const { dirPath, fileName } = splitPath(libraryRelPath)
    const dirHandle = await this._ensureDir(dirPath)
    const fh = await dirHandle.getFileHandle(fileName, { create: true })
    const writable = await fh.createWritable()
    try {
      await writable.write(file)
    } finally {
      await writable.close()
    }
  }

  async writeBlob(relPath: string, blob: Blob): Promise<void> {
    await this._requireRoot()
    const { dirPath, fileName } = splitPath(relPath)
    const dirHandle = await this._ensureDir(dirPath)
    const fh = await dirHandle.getFileHandle(fileName, { create: true })
    const writable = await fh.createWritable()
    try {
      await writable.write(blob)
    } finally {
      await writable.close()
    }
  }

  async readBlobUrl(relPath: string): Promise<string> {
    await this._requireRoot()
    const fh = await this._getFileHandle(relPath)
    const file = await fh.getFile()
    return URL.createObjectURL(file)
  }

  async hashFile(file: File): Promise<string> {
    const buf = await file.arrayBuffer()
    return sha256Hex(buf)
  }

  private async _requireRoot(): Promise<void> {
    if (!this.rootHandle) await this.tryRestoreRoot()
    if (!this.rootHandle) throw new Error('未选择数据目录')
    const ok = await this._ensurePermission(this.rootHandle, true)
    if (!ok) throw new Error('没有目录读写权限（请重新选择数据目录）')
  }

  private async _ensurePermission(
    handle: FileSystemDirectoryHandle,
    rw: boolean
  ): Promise<boolean> {
    const opts = rw ? { mode: 'readwrite' as const } : { mode: 'read' as const }
    if (handle.queryPermission && (await handle.queryPermission(opts)) === 'granted') return true
    if (handle.requestPermission && (await handle.requestPermission(opts)) === 'granted') return true
    return false
  }

  private async _readJson<T>(relPath: string): Promise<T> {
    const fh = await this._getFileHandle(relPath)
    const file = await fh.getFile()
    const text = await file.text()
    return JSON.parse(text) as T
  }

  private async _writeJson(relPath: string, obj: unknown): Promise<void> {
    const { dirPath, fileName } = splitPath(relPath)
    const dirHandle = await this._ensureDir(dirPath)
    const fh = await dirHandle.getFileHandle(fileName, { create: true })
    const writable = await fh.createWritable()
    try {
      await writable.write(
        new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
      )
    } finally {
      await writable.close()
    }
  }

  private async _getFileHandle(relPath: string): Promise<FileSystemFileHandle> {
    const { dirPath, fileName } = splitPath(relPath)
    const dir = dirPath ? await this._ensureDir(dirPath) : this.rootHandle!
    return await dir.getFileHandle(fileName, { create: false })
  }

  private async _ensureDir(relDirPath: string): Promise<FileSystemDirectoryHandle> {
    if (!relDirPath) return this.rootHandle!
    const parts = relDirPath.split('/').filter(Boolean)
    let cur = this.rootHandle!
    for (const p of parts) {
      cur = await cur.getDirectoryHandle(p, { create: true })
    }
    return cur
  }
}

function splitPath(relPath: string): { dirPath: string; fileName: string } {
  const clean = String(relPath ?? '').replace(/^\/+/, '')
  const parts = clean.split('/').filter(Boolean)
  if (!parts.length) return { dirPath: '', fileName: '' }
  const fileName = parts.pop() ?? ''
  return { dirPath: parts.join('/'), fileName }
}

function isImageFile(file: File): boolean {
  if (!file) return false
  if (file.type?.startsWith('image/')) return true
  const name = (file.name ?? '').toLowerCase()
  return /\.(png|jpe?g|webp|gif|bmp|avif|heic)$/i.test(name)
}

async function* walkDir(
  dirHandle: FileSystemDirectoryHandle
): AsyncGenerator<FileSystemFileHandle | FileSystemDirectoryHandle> {
  for await (const entry of dirHandle.values()) {
    yield entry
    if (entry.kind === 'directory') yield* walkDir(entry as FileSystemDirectoryHandle)
  }
}

/** 遍历目录，排除指定名称的子目录（如 library、thumbs） */
async function* walkDirExcluding(
  dirHandle: FileSystemDirectoryHandle,
  excludeDirNames: string[]
): AsyncGenerator<FileSystemFileHandle | FileSystemDirectoryHandle> {
  const excludeSet = new Set(excludeDirNames.map((n) => n.toLowerCase()))
  for await (const entry of dirHandle.values()) {
    yield entry
    if (entry.kind === 'directory') {
      const name = (entry as FileSystemDirectoryHandle).name?.toLowerCase() ?? ''
      if (!excludeSet.has(name)) {
        yield* walkDirExcluding(entry as FileSystemDirectoryHandle, excludeDirNames)
      }
    }
  }
}
