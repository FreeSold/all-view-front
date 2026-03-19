export function nanoid(size = 10): string {
  const chars =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  let out = ''
  for (let i = 0; i < size; i++) out += chars[bytes[i]! % chars.length]
  return out
}
