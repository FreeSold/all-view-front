export function fileNameFromRel(rel: string | undefined): string {
  const s = String(rel || '')
  const parts = s.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] ?? '' : ''
}
