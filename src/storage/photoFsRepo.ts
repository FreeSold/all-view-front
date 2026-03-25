/**
 * File System Access API for PhotoManager - directory read/write, import, thumbs
 */

import { sha256Hex } from '../util/photoHash'
import { nanoid } from '../util/photoId'
import { computeAutoTags, extOf } from '../util/photoTags'
import { ensureDirectoryPermission, getRoot, pickRoot as pickPersistedDataRoot } from './appRoot'
import type { PhotoImage, PhotoIndex, PhotoTags } from './photoTypes'

/** 导入时从文件选择器得到的项：保留句柄以便仅引用、不复制原图 */
export type PhotoImportPickItem = {
  file: File
  handle: FileSystemFileHandle
  /** 虚拟路径（library/ref/...），用于文件夹树与检索 */
  virtualLibraryRelPath: string
}

const FILE_INDEX = 'index.json'
const FILE_TAGS = 'tags.json'
const RESERVED_NAMES = ['library', 'thumbs']

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export class PhotoFsRepo {
  rootHandle: FileSystemDirectoryHandle | null = null

  /** 与 appRoot.pickRoot 一致；用户取消选择器时返回 null */
  async pickRoot(): Promise<FileSystemDirectoryHandle | null> {
    const h = await pickPersistedDataRoot()
    if (h) this.rootHandle = h
    return h
  }

  /** 与 appRoot.getRoot 一致：Electron 下会探测 IDB 句柄是否仍可写，失效则清除持久化 */
  async tryRestoreRoot(): Promise<FileSystemDirectoryHandle | null> {
    const h = await getRoot()
    this.rootHandle = h
    return h
  }

  /** 仅在用户手势流程中调用（选择目录、导入等），以便 requestPermission 可用 */
  async ensureDirs(): Promise<void> {
    await this._requireRoot(true)
    await this._ensureDir('library')
    await this._ensureDir('thumbs')
  }

  /**
   * 加载 index/tags。不在此处因 queryPermission=prompt 直接放弃：启动时无用户手势，
   * Electron/Chrome 常仍可读文件；读失败由 catch 处理。
   */
  async loadAll(): Promise<{ index: PhotoIndex | null; tags: PhotoTags | null }> {
    if (!this.rootHandle) await this.tryRestoreRoot()
    if (!this.rootHandle) return { index: null, tags: null }
    try {
      const index = (await this._readJson(FILE_INDEX).catch(() => null)) as PhotoIndex | null
      const tags = (await this._readJson(FILE_TAGS).catch(() => null)) as PhotoTags | null
      return { index, tags }
    } catch {
      return { index: null, tags: null }
    }
  }

  async saveIndex(index: PhotoIndex): Promise<void> {
    await this._requireRoot()
    await this._writeJson(FILE_INDEX, index)
  }

  async saveTags(tags: PhotoTags): Promise<void> {
    await this._requireRoot()
    await this._writeJson(FILE_TAGS, tags)
  }

  async pickImageFiles(): Promise<PhotoImportPickItem[]> {
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
    const out: PhotoImportPickItem[] = []
    const now = new Date()
    const yyyy = String(now.getFullYear())
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    for (const h of handles) {
      const file = await h.getFile()
      if (!isImageFile(file)) continue
      const ext = extOf(file.name) || 'bin'
      const base = (file.name.replace(/\.[^.]+$/, '') || 'img')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .slice(0, 80) || 'img'
      const virtualLibraryRelPath = `library/ref/${yyyy}/${mm}/${dd}/${base}__${nanoid()}.${ext}`
      out.push({ file, handle: h, virtualLibraryRelPath })
    }
    return out
  }

  async pickImageFolderRecursive(): Promise<PhotoImportPickItem[]> {
    const picker = window.showDirectoryPicker
    if (!picker) throw new Error('showDirectoryPicker not supported')
    const dir = await picker({ mode: 'read' })
    const out: PhotoImportPickItem[] = []
    await collectFolderImageHandles(dir, '', RESERVED_NAMES, out)
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
    await this._requireRoot(true)
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

  /** 读取库内文件的原始 File（用于导出等） */
  async readLibraryFile(relPath: string): Promise<File> {
    await this._requireRoot()
    const fh = await this._getFileHandle(relPath)
    return fh.getFile()
  }

  /** 读取原图：仅引用模式走 IndexedDB 句柄，旧版走 library 内文件 */
  async readPhotoImageFile(img: PhotoImage): Promise<File> {
    const ref = img.sourceRef?.trim()
    if (ref?.startsWith('local-handle:')) {
      const { getFileFromLocalHandleRef } = await import('./localFileStore')
      const f = await getFileFromLocalHandleRef(ref)
      if (f) return f
      throw new Error('无法读取本地文件句柄（可能已失效，请重新导入或选择目录）')
    }
    return this.readLibraryFile(img.libraryRelPath)
  }

  async readPhotoImageBlobUrl(img: PhotoImage): Promise<string> {
    const file = await this.readPhotoImageFile(img)
    return URL.createObjectURL(file)
  }

  /**
   * 删除图片源（句柄或 library 文件）及缩略图；不修改 index.json。
   * 用于「移动导出」成功后清理。
   */
  async deletePhotoSource(img: PhotoImage): Promise<void> {
    const ref = img.sourceRef?.trim()
    if (ref?.startsWith('local-handle:')) {
      const sourceId = ref.slice('local-handle:'.length)
      const { removeLocalVideoHandle } = await import('./localFileStore')
      await removeLocalVideoHandle(sourceId)
    } else {
      await this._deleteFileIfExists(img.libraryRelPath)
    }
    if (img.thumbRelPath) {
      await this._deleteFileIfExists(img.thumbRelPath)
    }
  }

  private async _deleteFileIfExists(relPath: string): Promise<void> {
    if (!relPath) return
    if (!this.rootHandle) await this.tryRestoreRoot()
    if (!this.rootHandle) return
    const ok = await this._ensurePermission(this.rootHandle, true, true)
    if (!ok) throw new Error('无权限删除源文件')
    const { dirPath, fileName } = splitPath(relPath)
    let cur = this.rootHandle
    if (dirPath) {
      for (const part of dirPath.split('/').filter(Boolean)) {
        try {
          cur = await cur.getDirectoryHandle(part, { create: false })
        } catch {
          return
        }
      }
    }
    try {
      await cur.removeEntry(fileName)
    } catch {
      // 不存在则忽略
    }
  }

  async hashFile(file: File): Promise<string> {
    const buf = await file.arrayBuffer()
    return sha256Hex(buf)
  }

  /**
   * index.json 缺失或为空时，扫描 library/ 下已有图片并生成索引（尽力匹配 thumbs/{id}.webp）
   */
  async rebuildIndexFromLibraryFiles(): Promise<PhotoImage[]> {
    if (!this.rootHandle) await this.tryRestoreRoot()
    if (!this.rootHandle) return []
    let lib: FileSystemDirectoryHandle
    try {
      lib = await this.rootHandle.getDirectoryHandle('library', { create: false })
    } catch {
      return []
    }
    const list = await this._collectLibraryImageEntries(lib, '')
    const images: PhotoImage[] = []
    for (const { libraryRelPath, fh } of list) {
      try {
        const file = await fh.getFile()
        const name = file.name
        const ext = extOf(name)
        const base = name.replace(/\.[^.]+$/, '') || 'img'
        let id = ''
        const u = base.lastIndexOf('__')
        if (u >= 0) id = base.slice(u + 2).trim()
        if (!id || id.length < 4) id = nanoid()

        let thumbRelPath: string | undefined
        const thumbById = await this._tryGetFileReadOnly(`thumbs/${id}.webp`)
        if (thumbById) thumbRelPath = `thumbs/${id}.webp`
        else {
          const hash = await this.hashFile(file)
          const thumbByHash = await this._tryGetFileReadOnly(`thumbs/${hash}.webp`)
          if (thumbByHash) thumbRelPath = `thumbs/${hash}.webp`
        }

        const createdAt = file.lastModified ?? Date.now()
        images.push({
          id,
          originalName: name,
          sizeBytes: file.size,
          ext,
          createdAt,
          importedAt: createdAt,
          libraryRelPath,
          thumbRelPath,
          autoTags: computeAutoTags({ width: 0, height: 0 }),
          userTags: [],
        })
      } catch {
        // skip broken entry
      }
    }
    return images
  }

  private async _collectLibraryImageEntries(
    dir: FileSystemDirectoryHandle,
    prefix: string
  ): Promise<{ libraryRelPath: string; fh: FileSystemFileHandle }[]> {
    const out: { libraryRelPath: string; fh: FileSystemFileHandle }[] = []
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        const fh = entry as FileSystemFileHandle
        const file = await fh.getFile()
        if (isImageFile(file)) {
          out.push({ libraryRelPath: `library/${prefix}${entry.name}`, fh })
        }
      } else if (entry.kind === 'directory') {
        const sub = entry as FileSystemDirectoryHandle
        out.push(...(await this._collectLibraryImageEntries(sub, `${prefix}${entry.name}/`)))
      }
    }
    return out
  }

  private async _tryGetFileReadOnly(relPath: string): Promise<FileSystemFileHandle | null> {
    const { dirPath, fileName } = splitPath(relPath)
    let cur = this.rootHandle
    if (!cur) return null
    if (dirPath) {
      for (const part of dirPath.split('/').filter(Boolean)) {
        try {
          cur = await cur.getDirectoryHandle(part, { create: false })
        } catch {
          return null
        }
      }
    }
    try {
      return await cur.getFileHandle(fileName, { create: false })
    } catch {
      return null
    }
  }

  /**
   * @param allowRequestPermission 为 true 时可在用户手势（如导入、选目录）下调用 requestPermission。
   * 后台自动保存（saveIndex 等）须传 false，避免 SecurityError。
   */
  private async _requireRoot(allowRequestPermission = false): Promise<void> {
    if (!this.rootHandle) await this.tryRestoreRoot()
    if (!this.rootHandle) throw new Error('未选择数据目录')
    const ok = await this._ensurePermission(this.rootHandle, true, allowRequestPermission)
    if (!ok) throw new Error('没有目录读写权限（请重新选择数据目录）')
  }

  private async _ensurePermission(
    handle: FileSystemDirectoryHandle,
    rw: boolean,
    allowRequest = false,
  ): Promise<boolean> {
    return ensureDirectoryPermission(handle, rw, allowRequest)
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

/** 递归收集图片及句柄，排除 library/thumbs 等目录 */
async function collectFolderImageHandles(
  dirHandle: FileSystemDirectoryHandle,
  relPrefix: string,
  excludeDirNames: string[],
  out: PhotoImportPickItem[],
): Promise<void> {
  const excludeSet = new Set(excludeDirNames.map((n) => n.toLowerCase()))
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const h = entry as FileSystemFileHandle
      const file = await h.getFile()
      if (!isImageFile(file)) continue
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name
      out.push({
        file,
        handle: h,
        virtualLibraryRelPath: `library/ref/${rel.replace(/\\/g, '/')}`,
      })
    } else if (entry.kind === 'directory') {
      const name = (entry as FileSystemDirectoryHandle).name?.toLowerCase() ?? ''
      if (excludeSet.has(name)) continue
      const sub = entry as FileSystemDirectoryHandle
      const nextPrefix = relPrefix ? `${relPrefix}/${entry.name}` : entry.name
      await collectFolderImageHandles(sub, nextPrefix, excludeDirNames, out)
    }
  }
}
