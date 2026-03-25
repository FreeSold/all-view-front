import dayjs from 'dayjs'
import type { MediaLibraryUiState } from '../storage/types'
import { sanitizeExportFolderName } from './fsExportCore'

/** 是否与「未筛选」导出条件一致：无任何关键词 + 无面板筛选 */
export function hasMediaLibraryActiveFilter(ui: MediaLibraryUiState): boolean {
  const kw = (ui.searchKeyword ?? '').trim()
  if (kw.length > 0) return true
  if ((ui.categoryFilters ?? []).length) return true
  if ((ui.tagFilters ?? []).length) return true
  if (ui.createdRange != null) return true
  return false
}

export function buildMediaLibraryExportFolderName(
  ui: MediaLibraryUiState,
  kind: 'video' | 'comic',
): string {
  if (!hasMediaLibraryActiveFilter(ui)) {
    return '未筛选'
  }

  const parts: string[] = []
  const kw = (ui.searchKeyword ?? '').trim()
  if (kw.length > 0) {
    const f = ui.searchField ?? 'name'
    const videoLabels: Record<string, string> = {
      name: '作品名称',
      id: '作品ID',
      actors: '演员',
      category: '分类',
      tags: '标签',
    }
    const comicLabels: Record<string, string> = {
      name: '漫画名称',
      id: '漫画ID',
      actors: '作者',
      category: '分类',
      tags: '标签',
    }
    const labels = kind === 'video' ? videoLabels : comicLabels
    const short = kw.length > 40 ? `${kw.slice(0, 37)}…` : kw
    parts.push(`搜索_${short}_${labels[f] ?? f}`)
  }

  if ((ui.categoryFilters ?? []).length) {
    parts.push(`分类_${(ui.categoryFilters ?? []).join('+')}`)
  }
  if ((ui.tagFilters ?? []).length) {
    parts.push(`标签_${(ui.tagFilters ?? []).join('+')}`)
  }
  if (ui.createdRange) {
    const a = dayjs(ui.createdRange.startMs).format('YYYYMMDD')
    const b = dayjs(ui.createdRange.endMs).format('YYYYMMDD')
    parts.push(`创建时间_${a}-${b}`)
  }

  return sanitizeExportFolderName(parts.join('__'), 100)
}
