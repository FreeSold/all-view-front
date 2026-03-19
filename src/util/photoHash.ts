export async function sha256Hex(arrayBuffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', arrayBuffer)
  return bufToHex(hash)
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}
