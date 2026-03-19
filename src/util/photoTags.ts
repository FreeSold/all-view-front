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

export const SIZE_LABELS: Record<string, string> = {
  small: '小 (<2MB)',
  medium: '中 (2-8MB)',
  large: '大 (8-25MB)',
  xlarge: '超大 (>25MB)',
}

export function computeAutoTags(params: {
  ext?: string
  sizeBytes?: number
  width?: number
  height?: number
  createdAt?: number
}): string[] {
  const tags: string[] = []
  if (params.ext) tags.push(`#format:${String(params.ext).toLowerCase()}`)
  tags.push(`#size:${sizeBucket(params.sizeBytes)}`)

  if (params.width != null && params.height != null) {
    tags.push(
      `#orientation:${params.width >= params.height ? 'landscape' : 'portrait'}`
    )
    const g = gcd(params.width, params.height)
    const rw = Math.round(params.width / g)
    const rh = Math.round(params.height / g)
    tags.push(`#ratio:${rw}:${rh}`)
  }
  if (params.createdAt != null) {
    const d = new Date(params.createdAt)
    if (!Number.isNaN(d.getTime())) tags.push(`#createdYear:${d.getFullYear()}`)
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
