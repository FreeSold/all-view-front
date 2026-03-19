export async function createThumbnailWebp(
  file: File,
  maxSize = 300
): Promise<Blob> {
  const img = await loadImage(file)
  const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, maxSize)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2d context unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

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
