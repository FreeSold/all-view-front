import type { PhotoImage } from '../storage/photoTypes'
import type { PhotoFsRepo } from '../storage/photoFsRepo'
import { sanitizeFileBaseName } from './fsExportCore'
import type { ExportFileTask } from './fsExportCore'
import { fileNameFromRel } from '../util/photoPath'

export type PhotoRow = PhotoImage & { displayName?: string }

function suggestedExportName(img: PhotoRow): string {
  const fromDisplay = (img.displayName ?? '').trim()
  const fromOriginal = (img.originalName ?? '').trim()
  const fromPath = fileNameFromRel(img.libraryRelPath)
  const base = fromDisplay || fromOriginal || fromPath || img.id || 'image'
  return sanitizeFileBaseName(base, 160)
}

export function buildPhotoExportTasks(
  rows: PhotoRow[],
  repo: PhotoFsRepo,
  options?: {
    /** 移动：导出成功后删除数据目录内原图/句柄与缩略图 */
    move?: boolean
    onSourceRemoved?: (img: PhotoRow) => void
  },
): ExportFileTask[] {
  return rows.map((img) => ({
    suggestedName: suggestedExportName(img),
    getBlob: async () => repo.readPhotoImageFile(img),
    removeSource:
      options?.move === true
        ? async () => {
            await repo.deletePhotoSource(img)
            options.onSourceRemoved?.(img)
          }
        : undefined,
  }))
}
