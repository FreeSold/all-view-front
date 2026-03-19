import { sizeBucket, SIZE_LABELS } from '../util/photoTags'
import { applySortRules, SORT_RULE_OPTIONS } from '../util/photoSort'
import { fileNameFromRel } from '../util/photoPath'
import type { PhotoIndex, PhotoImage, PhotoUi, FolderTreeNode, FilterOptions } from './photoTypes'

export function buildFolderTree(images: PhotoImage[]): FolderTreeNode {
  const root: FolderTreeNode = {
    id: 'all',
    name: '全部',
    count: images.length,
    children: [],
    expanded: true,
  }

  const nodeMap = new Map<string, FolderTreeNode>()
  nodeMap.set('all', root)

  for (const img of images) {
    const rel = String(img.libraryRelPath ?? '')
    if (!rel.startsWith('library/')) continue
    const parts = rel.split('/').slice(0, -1)
    let curId = ''
    let parent = root
    for (const part of parts) {
      curId = curId ? `${curId}/${part}` : part
      if (!nodeMap.has(curId)) {
        const node: FolderTreeNode = {
          id: curId,
          name: part,
          count: 0,
          children: [],
          expanded: false,
        }
        nodeMap.set(curId, node)
        parent.children.push(node)
      }
      const node = nodeMap.get(curId)!
      node.count += 1
      parent = node
    }
  }

  sortTree(root)
  return root
}

function sortTree(node: FolderTreeNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name))
  for (const c of node.children) sortTree(c)
}

export type PhotoDerived = {
  folderTree: FolderTreeNode
  activeFolderId: string
  filterOptions: FilterOptions
  activeFilters: PhotoUi['filters']
  sortRules: { id: string; label: string }[]
  viewMode: string
  results: (PhotoImage & { displayName: string; sizeBucket: string })[]
  hasActiveFilters: boolean
}

export function buildDerived(state: {
  index: PhotoIndex
  tags?: { tags: { name: string }[] }
}): PhotoDerived {
  const images = state.index?.images ?? []
  const ui = state.index?.ui ?? ({} as PhotoUi)

  const folderTree = buildFolderTree(images)
  const activeFolderId = ui.activeFolderId ?? 'all'
  const activeFilters = ui.filters ?? {
    formats: [],
    sizes: [],
    orient: [],
    tags: [],
  }
  const activeSortRules = ui.sortRules ?? ['importedAtDesc']

  const filterOptions = computeFilterOptions(images)
  const sortRules = computeSortRules(activeSortRules)

  const filtered = applyFolder(images, activeFolderId)
  const filtered2 = applyFilters(filtered, activeFilters)
  const sorted = applySortRules(filtered2, activeSortRules) as PhotoImage[]

  const viewMode = ui.viewMode ?? 'auto'

  const results: (PhotoImage & { displayName: string; sizeBucket: string })[] = sorted.map(
    (img) => ({
      ...img,
      displayName: fileNameFromRel(img.libraryRelPath) || img.originalName || '',
      sizeBucket: sizeBucket(img.sizeBytes),
    })
  )

  const hasActiveFilters = Boolean(
    (activeFilters.formats ?? []).length ||
      (activeFilters.sizes ?? []).length ||
      (activeFilters.orient ?? []).length ||
      (activeFilters.tags ?? []).length ||
      activeFolderId !== 'all'
  )

  return {
    folderTree,
    activeFolderId,
    filterOptions,
    activeFilters,
    sortRules,
    viewMode,
    results,
    hasActiveFilters,
  }
}

function computeFilterOptions(images: PhotoImage[]): FilterOptions {
  const formats = new Map<string, number>()
  const sizes = new Map<string, number>()
  const orient = new Map<string, number>()
  const tags = new Map<string, number>()

  for (const img of images) {
    if (img.ext) {
      const k = img.ext.toLowerCase()
      formats.set(k, (formats.get(k) ?? 0) + 1)
    }
    const sb = sizeBucket(img.sizeBytes)
    sizes.set(sb, (sizes.get(sb) ?? 0) + 1)
    const o = String(img.orientation ?? 'unknown')
    orient.set(o, (orient.get(o) ?? 0) + 1)
    for (const t of [...(img.autoTags ?? []), ...(img.userTags ?? [])]) {
      tags.set(t, (tags.get(t) ?? 0) + 1)
    }
  }

  return {
    formats: Array.from(formats.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, label: id.toUpperCase(), count })),
    sizes: Array.from(sizes.entries())
      .map(([id, count]) => ({ id, label: SIZE_LABELS[id] ?? id, count }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    orient: Array.from(orient.entries())
      .map(([id, count]) => ({ id, label: id, count }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    tags: Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([name, count]) => ({ name, count })),
  }
}

function computeSortRules(activeOrder: string[]): { id: string; label: string }[] {
  const dict = new Map(SORT_RULE_OPTIONS.map((x) => [x.id, x.label]))
  const normalized =
    Array.isArray(activeOrder) && activeOrder.length ? activeOrder : ['importedAtDesc']
  return normalized.map((id) => ({ id, label: dict.get(id) ?? id }))
}

function applyFolder(images: PhotoImage[], folderId: string): PhotoImage[] {
  if (!folderId || folderId === 'all') return images
  const prefix = folderId.endsWith('/') ? folderId : `${folderId}/`
  return images.filter((img) => (img.libraryRelPath ?? '').startsWith(prefix))
}

function applyFilters(
  images: PhotoImage[],
  filters: NonNullable<PhotoUi['filters']>
): PhotoImage[] {
  const formats = new Set((filters.formats ?? []).map((x) => String(x).toLowerCase()))
  const sizes = new Set((filters.sizes ?? []).map((x) => String(x)))
  const orient = new Set((filters.orient ?? []).map((x) => String(x)))
  const tags = new Set((filters.tags ?? []).map((x) => String(x)))

  return images.filter((img) => {
    if (formats.size && !formats.has(String(img.ext ?? '').toLowerCase())) return false
    if (sizes.size && !sizes.has(sizeBucket(img.sizeBytes))) return false
    if (orient.size && !orient.has(String(img.orientation ?? 'unknown'))) return false
    if (tags.size) {
      const all = new Set([...(img.autoTags ?? []), ...(img.userTags ?? [])])
      for (const t of tags) if (!all.has(t)) return false
    }
    return true
  })
}
