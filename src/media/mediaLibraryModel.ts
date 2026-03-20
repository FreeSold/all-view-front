/**
 * 视频 / 漫画等「作品库」列表的通用筛选、排序与 UI 状态（与 app-data.json 中 mediaUi 对应）
 */
import type { MediaLibraryUiState } from '../storage/types'

/** 与 Video / Comic 共有的可筛选字段 */
export type MediaListItem = {
  id: string
  name: string
  category: string
  tags: string[]
  actorNames: string[]
  createdAt: string
  playCount?: number
}

export type MediaListSearchField = 'name' | 'id' | 'actors' | 'category' | 'tags'

export const defaultMediaLibraryUi = (): MediaLibraryUiState => ({
  viewMode: 'list',
  filterExpanded: false,
  listPageSize: 10,
  searchKeyword: '',
  searchField: 'name',
  categoryFilters: [],
  tagFilters: [],
  sortBy: 'createdAt',
  sortOrder: 'desc',
})

export function mergeMediaUi(partial?: Partial<MediaLibraryUiState> | null): MediaLibraryUiState {
  return { ...defaultMediaLibraryUi(), ...partial }
}

export function filterMediaList<T extends MediaListItem>(
  items: T[],
  opts: {
    keyword: string
    searchField: MediaListSearchField
    categoryFilters: string[]
    tagFilters: string[]
    createdRange?: { startMs: number; endMs: number } | null
  },
): T[] {
  const { keyword, searchField, categoryFilters, tagFilters, createdRange } = opts
  const catSet = new Set((categoryFilters ?? []).map((c) => String(c)))
  const tagNeed = new Set((tagFilters ?? []).map((t) => String(t)))

  let out = items.filter((v) => {
    if (catSet.size && !catSet.has(String(v.category ?? ''))) return false
    if (tagNeed.size) {
      const vt = new Set((v.tags ?? []).map((x) => String(x)))
      for (const t of tagNeed) {
        if (!vt.has(t)) return false
      }
    }
    if (createdRange != null) {
      const ms = Date.parse(v.createdAt)
      if (Number.isNaN(ms)) return false
      if (ms < createdRange.startMs || ms > createdRange.endMs) return false
    }
    return true
  })

  const k = keyword.trim().toLowerCase()
  if (!k) return out
  const tokens = k.split(/\s+/).filter(Boolean)
  if (!tokens.length) return out

  out = out.filter((v) => {
    if (searchField === 'name') {
      const name = v.name.toLowerCase()
      return tokens.every((t) => name.includes(t))
    }
    if (searchField === 'id') {
      const id = v.id.toLowerCase()
      return tokens.every((t) => id.includes(t))
    }
    if (searchField === 'actors') {
      const actorJoined = v.actorNames.join(' ').toLowerCase()
      return tokens.every((t) => actorJoined.includes(t))
    }
    if (searchField === 'category') {
      const cat = (v.category || '').toLowerCase()
      return tokens.every((t) => cat.includes(t))
    }
    if (searchField === 'tags') {
      const tags = (v.tags || []).map((x) => String(x).toLowerCase())
      if (tags.length === 0) return false
      return tokens.every((t) => tags.some((tag) => tag.includes(t)))
    }
    return true
  })

  return out
}

export function sortMediaList<T extends MediaListItem>(
  items: T[],
  sortBy: NonNullable<MediaLibraryUiState['sortBy']>,
  sortOrder: NonNullable<MediaLibraryUiState['sortOrder']>,
): T[] {
  const mul = sortOrder === 'asc' ? 1 : -1
  const copy = [...items]
  copy.sort((a, b) => {
    if (sortBy === 'name') return mul * a.name.localeCompare(b.name, 'zh-CN')
    if (sortBy === 'playCount') return mul * ((a.playCount ?? 0) - (b.playCount ?? 0))
    const ta = Date.parse(a.createdAt) || 0
    const tb = Date.parse(b.createdAt) || 0
    return mul * (ta - tb)
  })
  return copy
}

/** 从作品列表收集分类、标签（去重排序） */
export function collectCategories<T extends MediaListItem>(items: T[]): string[] {
  const s = new Set<string>()
  for (const v of items) {
    const c = String(v.category ?? '').trim()
    if (c) s.add(c)
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function collectTags<T extends MediaListItem>(items: T[]): string[] {
  const s = new Set<string>()
  for (const v of items) {
    for (const t of v.tags ?? []) {
      const x = String(t).trim()
      if (x) s.add(x)
    }
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'zh-CN'))
}
