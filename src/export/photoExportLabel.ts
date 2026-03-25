import dayjs from 'dayjs'
import type { PhotoDerived } from '../storage/photoDerived'
import { sanitizeExportFolderName } from './fsExportCore'

export type PhotoListFilterField = 'name' | 'id' | 'path' | 'tags' | 'ext'

const FIELD_LABEL: Record<PhotoListFilterField, string> = {
  name: '文件名',
  id: '图片ID',
  path: '路径',
  tags: '标签',
  ext: '格式',
}

/**
 * 根据当前文件夹、面板筛选、列表关键词生成导出子文件夹名称
 */
export function buildPhotoExportFolderName(
  derived: PhotoDerived,
  listKeyword: string,
  listFilterField: PhotoListFilterField,
): string {
  const kw = listKeyword.trim()
  const usingKeyword = kw.length > 0
  const usingPanel = derived.hasActiveFilters

  if (!usingKeyword && !usingPanel) {
    return '未筛选'
  }

  const parts: string[] = []

  if (usingKeyword) {
    const short = kw.length > 40 ? `${kw.slice(0, 37)}…` : kw
    parts.push(`搜索_${short}_${FIELD_LABEL[listFilterField]}`)
  }

  if (derived.activeFolderId && derived.activeFolderId !== 'all') {
    const id = derived.activeFolderId.replace(/\//g, '_')
    parts.push(`目录_${id}`)
  }

  const af = derived.activeFilters ?? {}
  if ((af.formats ?? []).length) {
    parts.push(`格式_${(af.formats ?? []).join('+')}`)
  }
  if ((af.sizes ?? []).length) {
    parts.push(`大小_${(af.sizes ?? []).join('+')}`)
  }
  if ((af.orient ?? []).length) {
    parts.push(`方向_${(af.orient ?? []).join('+')}`)
  }
  if ((af.tags ?? []).length) {
    parts.push(`自定义标签_${(af.tags ?? []).join('+')}`)
  }
  if (af.fileTimeRange) {
    const a = dayjs(af.fileTimeRange.startMs).format('YYYYMMDD')
    const b = dayjs(af.fileTimeRange.endMs).format('YYYYMMDD')
    parts.push(`修改时间_${a}-${b}`)
  }

  return sanitizeExportFolderName(parts.join('__'), 100)
}
