export type PhotoImage = {
  importedAt?: number
  sizeBytes?: number
  originalName?: string
  ext?: string
  [key: string]: unknown
}

export function applySortRules(
  images: PhotoImage[],
  ruleIds: string[]
): PhotoImage[] {
  const rules = Array.isArray(ruleIds) && ruleIds.length ? ruleIds : ['importedAtDesc']
  const arr = images.map((x, idx) => ({ x, idx }))
  arr.sort((a, b) => compareByRules(a.x, b.x, rules) || a.idx - b.idx)
  return arr.map((p) => p.x)
}

function compareByRules(
  a: PhotoImage,
  b: PhotoImage,
  rules: string[]
): number {
  for (const r of rules) {
    const c = compareOne(a, b, r)
    if (c !== 0) return c
  }
  return 0
}

function compareOne(a: PhotoImage, b: PhotoImage, r: string): number {
  switch (r) {
    case 'importedAtDesc':
      return (b.importedAt ?? 0) - (a.importedAt ?? 0)
    case 'importedAtAsc':
      return (a.importedAt ?? 0) - (b.importedAt ?? 0)
    case 'sizeDesc':
      return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)
    case 'sizeAsc':
      return (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0)
    case 'nameAsc':
      return String(a.originalName ?? '').localeCompare(String(b.originalName ?? ''))
    case 'nameDesc':
      return String(b.originalName ?? '').localeCompare(String(a.originalName ?? ''))
    case 'extAsc':
      return String(a.ext ?? '').localeCompare(String(b.ext ?? ''))
    default:
      return 0
  }
}

export const SORT_RULE_OPTIONS = [
  { id: 'importedAtDesc', label: '导入时间（新→旧）' },
  { id: 'importedAtAsc', label: '导入时间（旧→新）' },
  { id: 'sizeDesc', label: '文件大小（大→小）' },
  { id: 'sizeAsc', label: '文件大小（小→大）' },
  { id: 'nameAsc', label: '文件名（A→Z）' },
  { id: 'nameDesc', label: '文件名（Z→A）' },
  { id: 'extAsc', label: '格式（A→Z）' },
]
