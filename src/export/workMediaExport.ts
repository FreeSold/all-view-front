import type { Comic, Video } from '../storage/types'
import type { VideoSource } from '../storage/types'
import { resolveLocalHandleUrl } from '../storage/localFileStore'
import { sanitizeFileBaseName } from './fsExportCore'
import type { ExportFileTask } from './fsExportCore'

async function blobFromResolvableUrl(url: string): Promise<Blob | null> {
  const u = url.trim()
  if (!u) return null
  if (u.startsWith('local-handle:')) {
    const obj = await resolveLocalHandleUrl(u)
    if (!obj) return null
    try {
      const r = await fetch(obj)
      return await r.blob()
    } finally {
      URL.revokeObjectURL(obj)
    }
  }
  if (
    u.startsWith('data:') ||
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('blob:')
  ) {
    const r = await fetch(u)
    return r.blob()
  }
  return null
}

function pickSourceUrl(s: VideoSource, isElectron: boolean): string | undefined {
  const a = isElectron ? s.urlExe || s.urlBrowser || s.url : s.urlBrowser || s.urlExe || s.url
  return a?.trim() || undefined
}

/** 仅能通过 fetch / 句柄解析的地址（纯磁盘路径无法在此导出） */
function isUrlExportable(url: string): boolean {
  const u = url.trim()
  return (
    u.startsWith('local-handle:') ||
    u.startsWith('data:') ||
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('blob:')
  )
}

function extFromFileName(name: string): string {
  const m = name.match(/(\.[a-z0-9]{1,8})$/i)
  return m?.[1] ?? ''
}

/**
 * 为视频/漫画当前列表项构造导出任务（封面 + 可解析的源文件）
 */
export function buildWorkMediaExportTasks(
  items: (Video | Comic)[],
  isElectron: boolean,
): { tasks: ExportFileTask[]; skipMessages: string[] } {
  const tasks: ExportFileTask[] = []
  const skipMessages: string[] = []

  for (const v of items) {
    const base = sanitizeFileBaseName(v.name?.trim() || v.id || 'work', 80)

    const coverUrl = (v.coverOriginalUrl || v.coverUrl || '').trim()
    if (coverUrl && isUrlExportable(coverUrl)) {
      const url = coverUrl
      tasks.push({
        suggestedName: `${base}_封面${extFromFileName(url) || '.jpg'}`,
        getBlob: async () => {
          const b = await blobFromResolvableUrl(url)
          if (!b) throw new Error('无法读取封面')
          return b
        },
      })
    }

    for (let i = 0; i < v.sources.length; i++) {
      const s = v.sources[i]
      const url = pickSourceUrl(s, isElectron)
      if (!url) {
        skipMessages.push(`「${v.name}」某源无地址，已跳过`)
        continue
      }
      if (!isUrlExportable(url)) {
        skipMessages.push(`「${v.name}」本地磁盘路径无法在浏览器内导出，请手动复制文件`)
        continue
      }
      const labelRaw = (s.label || s.id || `源${i + 1}`).trim()
      const label = sanitizeFileBaseName(labelRaw, 60)
      const fromLabelExt = extFromFileName(labelRaw)
      tasks.push({
        suggestedName: `${base}_${label}${fromLabelExt || '.mp4'}`,
        getBlob: async () => {
          const b = await blobFromResolvableUrl(url)
          if (!b) throw new Error('无法读取源文件')
          return b
        },
      })
    }
  }

  return { tasks, skipMessages }
}
