import { useCallback, useEffect, useRef, useState } from 'react'
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Modal } from 'antd'

const COVER_ASPECT = 56 / 78

function getCroppedCanvas(
  image: HTMLImageElement,
  crop: PixelCrop,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  canvas.width = Math.floor(crop.width * scaleX)
  canvas.height = Math.floor(crop.height * scaleY)

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas
}

export type CoverCropModalProps = {
  open: boolean
  imageSrc: string
  onConfirm: (croppedUrl: string, originalUrl: string) => void
  onCancel: () => void
}

export function CoverCropModal({ open, imageSrc, onConfirm, onCancel }: CoverCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !imageSrc) return
    setCrop(undefined)
    setCompletedCrop(undefined)
  }, [open, imageSrc])

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    const percentCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, COVER_ASPECT, width, height),
      width,
      height,
    )
    const pixelCrop = convertToPixelCrop(percentCrop, width, height)
    setCrop(percentCrop)
    setCompletedCrop(pixelCrop)
  }, [])

  const handleConfirm = useCallback(() => {
    if (!imgRef.current || !completedCrop) return
    setLoading(true)
    try {
      const canvas = getCroppedCanvas(imgRef.current, completedCrop)
      const croppedUrl = canvas.toDataURL('image/jpeg', 0.9)
      onConfirm(croppedUrl, imageSrc)
      onCancel()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [completedCrop, imageSrc, onConfirm, onCancel])

  return (
    <Modal
      open={open}
      title="选择封面范围"
      width={560}
      okText="确定"
      cancelText="取消"
      onOk={handleConfirm}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={COVER_ASPECT}
          style={{ maxWidth: '100%' }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="选择范围"
            style={{ maxWidth: '100%', display: 'block' }}
            onLoad={onImageLoad}
          />
        </ReactCrop>
      </div>
      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
        拖动选择封面范围，比例与列表封面一致。点击确定后，列表显示裁剪图，预览时显示原图。
      </p>
    </Modal>
  )
}
