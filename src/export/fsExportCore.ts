/**
 * 使用 File System Access API：选择导出父目录、创建子文件夹、写入文件（去重命名）
 */

const WIN_INVALID = /[<>:"/\\|?*\u0000-\u001f]/g

/** 用作文件夹名：去掉 Windows 非法字符，压缩空白，限制长度 */
export function sanitizeExportFolderName(raw: string, maxLen = 100): string {
  let s = String(raw ?? '')
    .replace(WIN_INVALID, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  if (!s) s = '未筛选'
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/[. ]+$/g, '') || 'export'
  return s
}

/** 用作文件名主体（不含路径） */
export function sanitizeFileBaseName(raw: string, maxLen = 120): string {
  let s = String(raw ?? '')
    .replace(WIN_INVALID, '_')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) s = 'file'
  if (s.length > maxLen) {
    const ext = s.match(/\.[a-z0-9]{1,8}$/i)
    const e = ext?.[0] ?? ''
    const base = e ? s.slice(0, -e.length) : s
    const cut = base.slice(0, Math.max(1, maxLen - e.length))
    s = cut + e
  }
  return s
}

export function isFsDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/** 用户选择导出目标父目录（需可写） */
export async function pickExportParentDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = window.showDirectoryPicker
  if (!picker) return null
  try {
    return await picker({ mode: 'readwrite' })
  } catch {
    return null
  }
}

/**
 * 在 parent 下创建或打开子目录（create: true；已存在则复用，文件级用唯一命名避免覆盖）
 */
export async function getOrCreateUniqueSubdirectory(
  parent: FileSystemDirectoryHandle,
  baseName: string,
): Promise<{ dir: FileSystemDirectoryHandle; usedName: string }> {
  const clean = sanitizeExportFolderName(baseName, 100)
  const dir = await parent.getDirectoryHandle(clean, { create: true })
  return { dir, usedName: clean }
}

function splitFileName(name: string): { stem: string; ext: string } {
  const n = name.trim()
  const i = n.lastIndexOf('.')
  if (i <= 0 || i >= n.length - 1) return { stem: n || 'file', ext: '' }
  return { stem: n.slice(0, i), ext: n.slice(i) }
}

/**
 * 在 dir 中写入文件；若重名则 stem_1.ext、stem_2.ext …
 */
export async function writeBlobToDirectoryUnique(
  dir: FileSystemDirectoryHandle,
  desiredFileName: string,
  blob: Blob,
): Promise<string> {
  const sanitized = sanitizeFileBaseName(desiredFileName, 180)
  const { stem, ext } = splitFileName(sanitized)
  const extPart = ext || ''

  for (let n = 0; n < 5000; n++) {
    const fname = n === 0 ? `${stem}${extPart}` : `${stem}_${n}${extPart}`
    try {
      await dir.getFileHandle(fname, { create: false })
      continue
    } catch {
      const fh = await dir.getFileHandle(fname, { create: true })
      const w = await fh.createWritable()
      try {
        await w.write(blob)
      } finally {
        await w.close()
      }
      return fname
    }
  }
  throw new Error('无法生成唯一文件名')
}

export type ExportFileTask = {
  suggestedName: string
  getBlob: () => Promise<Blob>
  /**
   * 成功写入目标目录后调用（移动语义：删除源文件/句柄）。
   * 若中途失败，已成功的会已执行 removeSource，请注意与 UI 状态一致。
   */
  removeSource?: () => Promise<void>
}

export type ExportBatchResult = {
  folderName: string
  ok: number
  fail: number
  errors: string[]
}

/** 选择父目录 → 创建子文件夹 → 依次写入 */
export async function exportFileTasksToUserFolder(
  tasks: ExportFileTask[],
  subfolderBaseName: string,
): Promise<ExportBatchResult | null> {
  if (!tasks.length) {
    return { folderName: '', ok: 0, fail: 0, errors: ['没有可导出的文件'] }
  }
  const parent = await pickExportParentDirectory()
  if (!parent) return null

  const { dir, usedName } = await getOrCreateUniqueSubdirectory(parent, subfolderBaseName)
  let ok = 0
  let fail = 0
  const errors: string[] = []

  for (const t of tasks) {
    try {
      const blob = await t.getBlob()
      await writeBlobToDirectoryUnique(dir, t.suggestedName, blob)
      await t.removeSource?.()
      ok += 1
    } catch (e) {
      fail += 1
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return { folderName: usedName, ok, fail, errors }
}
