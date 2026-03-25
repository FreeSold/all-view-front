/**
 * 大图 / 高分辨率 PNG 用 HTMLImageElement + decode() 常触发 EncodingError。
 * 策略：先走 Image 快路径；失败则用 createImageBitmap 配合降采样解码；仍失败则返回 null（导入仍可完成，仅无列表缩略图）。
 */

const DECODE_MAX_SIDE = 4096
const FALLBACK_RESIZE_WIDTHS = [2048, 1024] as const

export async function sniffImageDimensionsFromFile(
  file: File
): Promise<{ width: number; height: number } | null> {
  const buf = await file.slice(0, 256 * 1024).arrayBuffer()
  const u8 = new Uint8Array(buf)
  if (u8.length >= 24 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) {
    const dv = new DataView(buf)
    const width = dv.getUint32(16, false)
    const height = dv.getUint32(20, false)
    if (width > 0 && height > 0 && width < 1e9 && height < 1e9) return { width, height }
  }
  if (u8.length >= 4 && u8[0] === 0xff && u8[1] === 0xd8) {
    return sniffJpegDimensionsFromBuffer(buf)
  }
  return null
}

function sniffJpegDimensionsFromBuffer(
  buf: ArrayBuffer
): { width: number; height: number } | null {
  const u = new Uint8Array(buf)
  let i = 2
  while (i < u.length - 9) {
    if (u[i] !== 0xff) {
      i++
      continue
    }
    const m = u[i + 1]
    if (m === undefined) break
    if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2
      continue
    }
    if (m === 0xff) {
      i++
      continue
    }
    const segLen = (u[i + 2] << 8) | u[i + 3]
    if (segLen < 2 || i + 2 + segLen > u.length) break
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
      const height = (u[i + 5] << 8) | u[i + 6]
      const width = (u[i + 7] << 8) | u[i + 8]
      if (width > 0 && height > 0) return { width, height }
    }
    i += 2 + segLen
  }
  return null
}

/** 尽力生成 WebP 缩略图；大图解码失败时返回 null，不抛错。 */
export async function tryCreateThumbnailWebp(
  file: File,
  maxSize = 300
): Promise<Blob | null> {
  try {
    return await createThumbnailWebpViaImageElement(file, maxSize)
  } catch {
    try {
      return await createThumbnailWebpViaImageBitmap(file, maxSize)
    } catch {
      return null
    }
  }
}

/** @deprecated 内部优先用 tryCreateThumbnailWebp；保留供单测或外部硬需 Blob 的场景 */
export async function createThumbnailWebp(file: File, maxSize = 300): Promise<Blob> {
  const b = await tryCreateThumbnailWebp(file, maxSize)
  if (!b) throw new Error('生成缩略图失败')
  return b
}

async function createThumbnailWebpViaImageElement(
  file: File,
  maxSize: number
): Promise<Blob> {
  const img = await loadImage(file)
  return renderSourceToWebp(img, img.naturalWidth, img.naturalHeight, maxSize)
}

async function createThumbnailWebpViaImageBitmap(
  file: File,
  maxSize: number
): Promise<Blob> {
  const d = await sniffImageDimensionsFromFile(file)
  let bmp: ImageBitmap | undefined
  try {
    if (d && Math.max(d.width, d.height) > DECODE_MAX_SIDE) {
      if (d.width >= d.height) {
        bmp = await createImageBitmap(file, { resizeWidth: DECODE_MAX_SIDE })
      } else {
        bmp = await createImageBitmap(file, { resizeHeight: DECODE_MAX_SIDE })
      }
    } else {
      bmp = await createImageBitmap(file)
    }
  } catch {
    let lastErr: unknown
    for (const w of FALLBACK_RESIZE_WIDTHS) {
      try {
        bmp = await createImageBitmap(file, { resizeWidth: w })
        lastErr = undefined
        break
      } catch (e) {
        lastErr = e
      }
    }
    if (!bmp) throw lastErr ?? new Error('createImageBitmap failed')
  }

  try {
    return await renderSourceToWebp(bmp, bmp.width, bmp.height, maxSize)
  } finally {
    bmp.close()
  }
}

async function renderSourceToWebp(
  src: CanvasImageSource,
  naturalW: number,
  naturalH: number,
  maxSize: number
): Promise<Blob> {
  const { width, height } = fitSize(naturalW, naturalH, maxSize)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2d context unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.82)
  )
  if (!blob) throw new Error('生成缩略图失败')
  return blob
}

function fitSize(
  w: number,
  h: number,
  maxSize: number
): { width: number; height: number } {
  const m = Math.max(w, h)
  if (m <= maxSize) return { width: w, height: h }
  const s = maxSize / m
  return {
    width: Math.max(1, Math.round(w * s)),
    height: Math.max(1, Math.round(h * s)),
  }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}
