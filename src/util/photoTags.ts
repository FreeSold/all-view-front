export function extOf(name: string | undefined): string {
  const m = String(name ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] ?? '' : ''
}

export function sizeBucket(sizeBytes: number | undefined): 'small' | 'medium' | 'large' | 'xlarge' {
  const b = Number(sizeBytes ?? 0)
  const mb = 1024 * 1024
  if (b < 2 * mb) return 'small'
  if (b < 8 * mb) return 'medium'
  if (b < 25 * mb) return 'large'
  return 'xlarge'
}

/** 与筛选「大小」选项文案一致 */
export const SIZE_LABELS: Record<string, string> = {
  small: '小于约 2MB',
  medium: '约 2MB～8MB',
  large: '约 8MB～25MB',
  xlarge: '大于约 25MB',
}

/**
 * 自动标签：不再生成与「格式 / 大小 / 方向 / 时间」筛选重复的标签，
 * 仅保留宽高比（比例），便于快速浏览；分类请用左侧目录与筛选区。
 */
export function computeAutoTags(params: { width?: number; height?: number }): string[] {
  const tags: string[] = []
  if (params.width != null && params.height != null && params.width > 0 && params.height > 0) {
    const g = gcd(params.width, params.height)
    const rw = Math.round(params.width / g)
    const rh = Math.round(params.height / g)
    tags.push(`比例 ${rw}∶${rh}`)
  }
  return tags
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}
