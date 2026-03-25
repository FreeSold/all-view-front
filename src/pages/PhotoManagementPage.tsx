import { CaretDownOutlined, CaretUpOutlined, ExportOutlined, InboxOutlined, PictureOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Image,
  Input,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppShell } from '../context/AppShellContext'
import { usePhotoFolder } from '../context/PhotoFolderContext'
import { usePhotoStateContext } from '../context/PhotoStateContext'
import { SelectAllToggleButton } from '../components/media/MediaLibraryChrome'
import { PhotoPageToolbar } from './PhotoManagement/PhotoPageToolbar'
import { buildPhotoExportTasks } from '../export/photoExport'
import { buildPhotoExportFolderName } from '../export/photoExportLabel'
import { exportFileTasksToUserFolder, isFsDirectoryPickerSupported } from '../export/fsExportCore'
import type { PhotoImportPickItem } from '../storage/photoFsRepo'
import type { PhotoImage } from '../storage/photoTypes'

type PhotoListFilterField = 'name' | 'id' | 'path' | 'tags' | 'ext'

/** 筛选卡片内：小字号、少占位 */
const FILTER_LABEL: CSSProperties = {
  fontSize: 12,
  lineHeight: '18px',
  flexShrink: 0,
}
const FILTER_TAG: CSSProperties = {
  fontSize: 11,
  lineHeight: '18px',
  marginInlineEnd: 0,
  padding: '0 5px',
  cursor: 'pointer',
}

function ThumbImage({
  img,
  size = 140,
  loadThumb,
}: {
  img: PhotoImage & { displayName?: string }
  size?: number
  loadThumb: (relPath: string | undefined) => Promise<string>
}) {
  const [src, setSrc] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    loadThumb(img.thumbRelPath).then((url) => {
      if (!cancelled && url) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [img.thumbRelPath, loadThumb])
  return (
    <div
      className="media-thumb-hover-dim"
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        background: '#f0f0f0',
      }}
    >
      {src ? (
        <Image
          src={src}
          alt={img.displayName ?? img.originalName}
          style={{ width: size, height: size, objectFit: 'cover', pointerEvents: 'none' }}
          preview={false}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PictureOutlined style={{ fontSize: 24, color: '#999' }} />
        </div>
      )}
      <div className="media-thumb-hover-dim-overlay" aria-hidden />
    </div>
  )
}

/**
 * Tooltip 的触发器必须是可直接挂 ref 的单一节点；点击打开大图也在此层处理，
 * 避免内层 stopPropagation 与 rc-trigger 事件顺序冲突导致点击无响应。
 */
function PhotoThumbWithTooltip({
  img,
  size,
  loadThumb,
  onOpenPreview,
  triggerStyle,
}: {
  img: PhotoImage & { displayName?: string }
  size: number
  loadThumb: (relPath: string | undefined) => Promise<string>
  onOpenPreview: (img: PhotoImage & { displayName?: string }) => void
  triggerStyle?: CSSProperties
}) {
  return (
    <Tooltip title={<PhotoThumbHoverTitle img={img} loadThumb={loadThumb} />} mouseEnterDelay={0.15}>
      <div
        role="button"
        tabIndex={0}
        style={{
          display: 'inline-block',
          lineHeight: 0,
          verticalAlign: 'top',
          cursor: 'pointer',
          ...triggerStyle,
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenPreview(img)
          }
        }}
        onClick={(e) => {
          e.stopPropagation()
          onOpenPreview(img)
        }}
      >
        <ThumbImage img={img} size={size} loadThumb={loadThumb} />
      </div>
    </Tooltip>
  )
}

/** 与视频/漫画封面 Tooltip 一致：悬停展示大图 + 路径信息（缩略图异步加载） */
function PhotoThumbHoverTitle({
  img,
  loadThumb,
}: {
  img: PhotoImage & { displayName?: string }
  loadThumb: (relPath: string | undefined) => Promise<string>
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setUrl(null)
    void loadThumb(img.thumbRelPath).then((u) => {
      if (!cancelled && u) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [img.thumbRelPath, loadThumb])
  const meta = `${img.displayName ?? img.originalName ?? ''}\n${img.libraryRelPath ?? ''}`
  if (!url) {
    return (
      <div
        style={{
          width: 300,
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111',
        }}
      >
        <Spin size="small" />
      </div>
    )
  }
  return (
    <div>
      <img
        src={url}
        alt=""
        style={{ width: 300, height: 300, objectFit: 'contain', background: '#111', display: 'block' }}
      />
      <pre
        style={{
          margin: 0,
          fontSize: 11,
          maxWidth: 300,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {meta}
      </pre>
    </div>
  )
}

function formatBytes(bytes: number): string {
  const b = Number(bytes ?? 0)
  const kb = 1024
  const mb = kb * 1024
  const gb = mb * 1024
  if (b >= gb) return `${(b / gb).toFixed(2)} GB`
  if (b >= mb) return `${(b / mb).toFixed(2)} MB`
  if (b >= kb) return `${(b / kb).toFixed(2)} KB`
  return `${b} B`
}

function formatModifiedTime(ms: number | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  return dayjs(ms).format('YYYY-MM-DD HH:mm')
}

/** 第一行：文件名居左；类型、大小、像素、修改时间整体靠右对齐 */
function PhotoTitleRow({ img }: { img: PhotoImage & { displayName?: string } }) {
  const name = img.displayName ?? img.originalName ?? ''
  const ext = (img.ext ?? '?').toUpperCase()
  const wh =
    img.width != null && img.height != null && img.width > 0 && img.height > 0
      ? `${img.width}×${img.height}`
      : '—'
  const meta = `${ext} · ${formatBytes(img.sizeBytes)} · ${wh} · ${formatModifiedTime(img.createdAt)}`
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, max-content)',
        alignItems: 'baseline',
        columnGap: 12,
        width: '100%',
      }}
    >
      <Typography.Text strong ellipsis={{ tooltip: name }} style={{ minWidth: 0 }}>
        {name}
      </Typography.Text>
      <Typography.Text
        type="secondary"
        ellipsis={{ tooltip: meta }}
        style={{
          fontSize: 12,
          textAlign: 'right',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        {meta}
      </Typography.Text>
    </div>
  )
}

export default function PhotoManagementPage() {
  const { message, modal } = App.useApp()
  const [searchParams] = useSearchParams()
  const photoFolder = usePhotoFolder()
  const { setContentHeaderRight } = useAppShell()
  const {
    fs,
    index,
    derived,
    setUi,
    setFilters,
    clearFilters,
    setSortRules,
    addUserTag,
    removeUserTag,
    getTagSuggestions,
    importFiles,
    removeImagesByIds,
    isSupported,
    repo,
  } = usePhotoStateContext()

  const [largePreview, setLargePreview] = useState<{ imgId: string; url: string } | null>(null)
  const largePreviewUrlRef = useRef<string | null>(null)

  /** 关键词筛选：列表与缩略图共用；分页仅列表模式生效 */
  const [listKeyword, setListKeyword] = useState('')
  const [listFilterField, setListFilterField] = useState<PhotoListFilterField>('name')
  const [listPageSize, setListPageSize] = useState(10)
  const [listPage, setListPage] = useState(1)
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importFilesList, setImportFilesList] = useState<PhotoImportPickItem[]>([])
  const [importing, setImporting] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([])
  const [exportingSelected, setExportingSelected] = useState(false)
  const [deletingSelected, setDeletingSelected] = useState(false)
  const thumbCache = useRef<Map<string, string>>(new Map())
  const lastTreeRef = useRef<string>('')

  useEffect(() => {
    const tree = derived.folderTree
    const treeStr = JSON.stringify(tree)
    if (treeStr !== lastTreeRef.current) {
      lastTreeRef.current = treeStr
      photoFolder?.setFolderTree(tree)
    }
    photoFolder?.setActiveFolderId(derived.activeFolderId)
  }, [derived.folderTree, derived.activeFolderId, photoFolder?.setFolderTree, photoFolder?.setActiveFolderId])

  useEffect(() => {
    if (photoFolder?.activeFolderId && photoFolder.activeFolderId !== derived.activeFolderId) {
      setUi({ activeFolderId: photoFolder.activeFolderId })
    }
  }, [photoFolder?.activeFolderId, derived.activeFolderId, setUi])

  const effectiveViewMode = useMemo((): 'grid' | 'list' => {
    return derived.viewMode === 'list' ? 'list' : 'grid'
  }, [derived.viewMode])

  const fileTimeRangePickerValue = useMemo((): [Dayjs, Dayjs] | null => {
    const tr = derived.activeFilters?.fileTimeRange
    if (tr == null) return null
    return [dayjs(tr.startMs), dayjs(tr.endMs)]
  }, [derived.activeFilters?.fileTimeRange])

  const largePreviewImage = useMemo(() => {
    if (!largePreview) return null
    const fromResults = derived.results.find((x) => x.id === largePreview.imgId)
    if (fromResults) return fromResults
    const raw = index.images.find((x) => x.id === largePreview.imgId)
    if (!raw) return null
    return { ...raw, displayName: raw.originalName }
  }, [largePreview, derived.results, index.images])

  const closeLargePreview = useCallback(() => {
    if (largePreviewUrlRef.current) {
      URL.revokeObjectURL(largePreviewUrlRef.current)
      largePreviewUrlRef.current = null
    }
    setLargePreview(null)
  }, [])

  const openLargePreview = useCallback(
    async (img: PhotoImage & { displayName?: string }) => {
      if (!fs.rootHandle) {
        message.warning('请先选择数据目录')
        return
      }
      try {
        if (largePreviewUrlRef.current) {
          URL.revokeObjectURL(largePreviewUrlRef.current)
          largePreviewUrlRef.current = null
        }
        const url = await repo.readPhotoImageBlobUrl(img)
        largePreviewUrlRef.current = url
        setLargePreview({ imgId: img.id, url })
      } catch (e) {
        message.error(e instanceof Error ? e.message : '无法打开原图')
      }
    },
    [fs.rootHandle, repo]
  )

  useEffect(() => {
    return () => {
      if (largePreviewUrlRef.current) {
        URL.revokeObjectURL(largePreviewUrlRef.current)
        largePreviewUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setListKeyword(q)
      setListFilterField('name')
    }
  }, [searchParams])

  useEffect(() => {
    setListPage(1)
  }, [listKeyword, listFilterField, listPageSize])

  const listFiltered = useMemo(() => {
    const rows = derived.results
    const k = listKeyword.trim().toLowerCase()
    if (!k) return rows
    const tokens = k.split(/\s+/).filter(Boolean)
    if (!tokens.length) return rows

    const match = (text: string) => {
      const low = text.toLowerCase()
      return tokens.every((t) => low.includes(t))
    }

    return rows.filter((img) => {
      switch (listFilterField) {
        case 'name':
          return match(`${img.displayName ?? ''} ${img.originalName ?? ''}`)
        case 'id':
          return match(String(img.id ?? ''))
        case 'path':
          return match(String(img.libraryRelPath ?? ''))
        case 'tags':
          return match((img.userTags ?? []).join(' '))
        case 'ext':
          return match(String(img.ext ?? ''))
        default:
          return true
      }
    })
  }, [derived.results, listKeyword, listFilterField])

  const listMaxPage = Math.max(1, Math.ceil(listFiltered.length / listPageSize) || 1)
  useEffect(() => {
    if (listPage > listMaxPage) setListPage(listMaxPage)
  }, [listPage, listMaxPage])

  const listPageItems = useMemo(() => {
    const start = (listPage - 1) * listPageSize
    return listFiltered.slice(start, start + listPageSize)
  }, [listFiltered, listPage, listPageSize])

  const selectedFilteredPhotos = useMemo(() => {
    if (!selectedPhotoIds.length) return []
    const idSet = new Set(selectedPhotoIds)
    return listFiltered.filter((x) => idSet.has(x.id))
  }, [selectedPhotoIds, listFiltered])
  const allCurrentPhotosSelected =
    listFiltered.length > 0 && selectedFilteredPhotos.length === listFiltered.length

  useEffect(() => {
    const valid = new Set(index.images.map((x) => x.id))
    setSelectedPhotoIds((prev) => prev.filter((id) => valid.has(id)))
  }, [index.images])

  const loadThumb = useCallback(
    async (relPath: string | undefined) => {
      if (!relPath || !fs.rootHandle) return ''
      if (thumbCache.current.has(relPath)) return thumbCache.current.get(relPath)!
      try {
        const url = await repo.readBlobUrl(relPath)
        thumbCache.current.set(relPath, url)
        return url
      } catch {
        return ''
      }
    },
    [fs.rootHandle, repo]
  )

  const handlePickFiles = useCallback(async () => {
    if (!isSupported) return
    try {
      const files = await repo.pickImageFiles()
      setImportFilesList((prev) => {
        const seen = new Set(prev.map((p) => `${p.file.name}:${p.file.size}:${p.file.lastModified}`))
        const added = files.filter(
          (p) => !seen.has(`${p.file.name}:${p.file.size}:${p.file.lastModified}`)
        )
        return [...prev, ...added]
      })
    } catch {
      message.error('选择文件失败')
    }
  }, [isSupported, repo])

  const handlePickFolder = useCallback(async () => {
    if (!isSupported) return
    try {
      const files = await repo.pickImageFolderRecursive()
      setImportFilesList((prev) => {
        const seen = new Set(prev.map((p) => `${p.file.name}:${p.file.size}:${p.file.lastModified}`))
        const added = files.filter(
          (p) => !seen.has(`${p.file.name}:${p.file.size}:${p.file.lastModified}`)
        )
        return [...prev, ...added]
      })
    } catch {
      message.error('选择文件夹失败')
    }
  }, [isSupported, repo])

  const handleStartImport = useCallback(async () => {
    if (!importFilesList.length) return
    setImporting(true)
    try {
      await importFiles(importFilesList)
      setImportFilesList([])
      setImportOpen(false)
      message.success(`已导入 ${importFilesList.length} 个文件`)
    } catch (e) {
      message.error(String(e))
    } finally {
      setImporting(false)
    }
  }, [importFilesList, importFiles])

  const openImport = useCallback(() => {
    setImportFilesList([])
    setImportOpen(true)
  }, [])

  const handleExportSelectedPhotos = useCallback(async () => {
    if (!selectedFilteredPhotos.length) {
      message.warning('请先选择要导出的图片')
      return
    }
    if (!fs.rootHandle) {
      message.warning('请先选择图片数据目录')
      return
    }
    if (!isFsDirectoryPickerSupported()) {
      message.info('请使用 Chrome 或 Edge，并允许选择保存文件夹')
      return
    }
    setExportingSelected(true)
    try {
      const folderName = `${buildPhotoExportFolderName(derived, listKeyword, listFilterField)}_已选`
      const tasks = buildPhotoExportTasks(selectedFilteredPhotos, repo, { move: false })
      const result = await exportFileTasksToUserFolder(tasks, folderName)
      if (result == null) return
      if (result.ok === 0 && result.errors.length) {
        message.error(result.errors[0] ?? '导出失败')
        return
      }
      const parts = [`已导出已选 ${result.ok} 个文件到「${result.folderName}」`]
      if (result.fail) parts.push(`失败 ${result.fail}`)
      message.success(parts.join('；'))
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    } finally {
      setExportingSelected(false)
    }
  }, [selectedFilteredPhotos, fs.rootHandle, derived, listKeyword, listFilterField, repo])

  const handleDeleteSelectedPhotos = useCallback(() => {
    if (!selectedFilteredPhotos.length) {
      message.warning('请先选择要删除的图片')
      return
    }
    modal.confirm({
      title: '确认删除已选图片？',
      content: `将从管理索引删除 ${selectedFilteredPhotos.length} 条记录（不删除原始文件）。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setDeletingSelected(true)
        try {
          const idSet = new Set(selectedFilteredPhotos.map((x) => x.id))
          removeImagesByIds(Array.from(idSet))
          setSelectedPhotoIds((prev) => prev.filter((id) => !idSet.has(id)))
          message.success(`已删除 ${selectedFilteredPhotos.length} 条记录`)
        } finally {
          setDeletingSelected(false)
        }
      },
    })
  }, [selectedFilteredPhotos, removeImagesByIds, modal, message])

  useLayoutEffect(() => {
    if (!isSupported) {
      setContentHeaderRight(null)
      return () => setContentHeaderRight(null)
    }
    setContentHeaderRight(() => <PhotoPageToolbar onOpenImport={openImport} />)
    return () => setContentHeaderRight(null)
  }, [isSupported, setContentHeaderRight, openImport])

  if (!isSupported) {
    return (
      <Alert
        type="warning"
        message="当前浏览器不支持 File System Access API"
        description="请使用 Chrome 或 Edge 浏览器打开此页面，以使用图片管理功能。"
        showIcon
      />
    )
  }

  const activeTagFilterCount = (derived.activeFilters?.tags ?? []).length

  /** 列表 / 缩略图均显示关键词查询（此前仅在列表模式显示，易被误认为「查询被删」） */
  const filterCardExtra = (
    <Space wrap size={[4, 4]} style={{ justifyContent: 'flex-end' }}>
      <Input
        size="small"
        placeholder="搜索"
        value={listKeyword}
        onChange={(e) => setListKeyword(e.target.value)}
        style={{ width: 168 }}
        allowClear
      />
      <Select<PhotoListFilterField>
        size="small"
        value={listFilterField}
        onChange={setListFilterField}
        options={[
          { label: '文件名', value: 'name' },
          { label: '图片 ID', value: 'id' },
          { label: '路径', value: 'path' },
          { label: '标签', value: 'tags' },
          { label: '格式', value: 'ext' },
        ]}
        style={{ width: 100 }}
      />
    </Space>
  )

  const filterCardTitle = (
    <Space wrap align="center" size={6}>
      <Typography.Text strong style={{ fontSize: 13, lineHeight: '22px' }}>
        筛选与排序
      </Typography.Text>
      <Button
        type="link"
        size="small"
        onClick={() => setFilterPanelExpanded((v) => !v)}
        style={{
          padding: '0 4px',
          height: 22,
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {filterPanelExpanded ? (
          <>
            折叠
            <CaretUpOutlined style={{ fontSize: 10 }} />
          </>
        ) : (
          <>
            展开
            <CaretDownOutlined style={{ fontSize: 10 }} />
          </>
        )}
      </Button>
      {derived.hasActiveFilters ? (
        <Tag color="processing" style={{ ...FILTER_TAG, cursor: 'default' }}>
          筛选已启用
        </Tag>
      ) : null}
    </Space>
  )

  const viewModeSelectValue: 'grid' | 'list' = derived.viewMode === 'list' ? 'list' : 'grid'

  const resultsCardExtra = (
    <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
      <SelectAllToggleButton
        total={listFiltered.length}
        selectedCount={selectedFilteredPhotos.length}
        onToggle={() =>
          setSelectedPhotoIds(allCurrentPhotosSelected ? [] : listFiltered.map((x) => x.id))
        }
      />
      <Button
        size="small"
        icon={<ExportOutlined />}
        loading={exportingSelected}
        disabled={!selectedFilteredPhotos.length}
        onClick={() => void handleExportSelectedPhotos()}
      >
        导出已选
      </Button>
      <Button
        size="small"
        danger
        loading={deletingSelected}
        disabled={!selectedFilteredPhotos.length}
        onClick={handleDeleteSelectedPhotos}
      >
        删除已选
      </Button>
      {effectiveViewMode === 'list' ? (
        <Select
          size="small"
          value={listPageSize}
          onChange={setListPageSize}
          options={[
            { label: '10 条/页', value: 10 },
            { label: '20 条/页', value: 20 },
            { label: '50 条/页', value: 50 },
          ]}
          style={{ width: 100 }}
        />
      ) : null}
      <Select
        size="small"
        value={viewModeSelectValue}
        onChange={(v) => setUi({ viewMode: v })}
        options={[
          { value: 'grid', label: '缩略图' },
          { value: 'list', label: '列表' },
        ]}
        style={{ width: 88 }}
      />
    </Space>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
      <Card
        size="small"
        title={filterCardTitle}
        extra={filterCardExtra}
        style={{ marginBottom: 8 }}
        styles={{
          body: {
            paddingBlock: filterPanelExpanded ? 6 : 0,
            paddingInline: 12,
          },
          header: {
            flexWrap: 'wrap',
            alignItems: 'center',
            rowGap: 4,
            minHeight: 36,
            paddingBlock: 6,
          },
        }}
      >
        {filterPanelExpanded ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '4px 6px',
                    }}
                  >
                    <Typography.Text type="secondary" style={FILTER_LABEL}>
                      格式
                    </Typography.Text>
                    {derived.filterOptions.formats.map((o: { id: string; label: string; count: number }) => (
                      <Tag
                        key={o.id}
                        style={FILTER_TAG}
                        color={(derived.activeFilters ?? {}).formats?.includes(o.id) ? 'blue' : 'default'}
                        onClick={() => {
                          const cur = (derived.activeFilters ?? {}).formats ?? []
                          const next = cur.includes(o.id) ? cur.filter((x: string) => x !== o.id) : [...cur, o.id]
                          setFilters({ formats: next })
                        }}
                      >
                        {o.label}（{o.count}）
                      </Tag>
                    ))}
                    <Typography.Text type="secondary" style={{ ...FILTER_LABEL, marginLeft: 6 }}>
                      大小
                    </Typography.Text>
                    {derived.filterOptions.sizes.map((o: { id: string; label: string; count: number }) => (
                      <Tag
                        key={o.id}
                        style={FILTER_TAG}
                        color={(derived.activeFilters ?? {}).sizes?.includes(o.id) ? 'blue' : 'default'}
                        onClick={() => {
                          const cur = (derived.activeFilters ?? {}).sizes ?? []
                          const next = cur.includes(o.id) ? cur.filter((x: string) => x !== o.id) : [...cur, o.id]
                          setFilters({ sizes: next })
                        }}
                      >
                        {o.label}（{o.count}）
                      </Tag>
                    ))}
                    <Typography.Text type="secondary" style={{ ...FILTER_LABEL, marginLeft: 6 }}>
                      方向
                    </Typography.Text>
                    {derived.filterOptions.orient.map((o: { id: string; label: string; count: number }) => (
                      <Tag
                        key={o.id}
                        style={FILTER_TAG}
                        color={(derived.activeFilters ?? {}).orient?.includes(o.id) ? 'blue' : 'default'}
                        onClick={() => {
                          const cur = (derived.activeFilters ?? {}).orient ?? []
                          const next = cur.includes(o.id) ? cur.filter((x: string) => x !== o.id) : [...cur, o.id]
                          setFilters({ orient: next })
                        }}
                      >
                        {o.label}（{o.count}）
                      </Tag>
                    ))}
                    <Typography.Text type="secondary" style={{ ...FILTER_LABEL, marginLeft: 6 }}>
                      文件时间
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ ...FILTER_LABEL, opacity: 0.85 }}>
                      （修改时间）
                    </Typography.Text>
                    <DatePicker.RangePicker
                      size="small"
                      allowClear
                      style={{ minWidth: 200 }}
                      value={fileTimeRangePickerValue}
                      onChange={(dates) => {
                        if (!dates?.[0] || !dates[1]) {
                          setFilters({ fileTimeRange: undefined })
                          return
                        }
                        setFilters({
                          fileTimeRange: {
                            startMs: dates[0].startOf('day').valueOf(),
                            endMs: dates[1].endOf('day').valueOf(),
                          },
                        })
                      }}
                    />
                    {derived.hasActiveFilters && (
                      <Button
                        size="small"
                        type="link"
                        onClick={clearFilters}
                        style={{ marginLeft: 4, padding: '0 4px', fontSize: 12, height: 22 }}
                      >
                        清空筛选
                      </Button>
                    )}
                  </div>
                  <div>
                    <Space size={4} wrap style={{ marginBottom: 4 }}>
                      <Typography.Text type="secondary" style={FILTER_LABEL}>
                        自定义标签
                      </Typography.Text>
                      {activeTagFilterCount > 0 ? (
                        <Tag color="processing" style={{ ...FILTER_TAG, cursor: 'default' }}>
                          已选 {activeTagFilterCount}
                        </Tag>
                      ) : null}
                    </Space>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '4px 6px',
                      }}
                    >
                      {derived.filterOptions.tags.length === 0 ? (
                        <Typography.Text type="secondary" style={{ ...FILTER_LABEL, opacity: 0.85 }}>
                          暂无可用标签，导入图片并添加自定义标签后将显示于此
                        </Typography.Text>
                      ) : (
                        derived.filterOptions.tags.slice(0, 40).map((o: { name: string; count: number }) => (
                          <Tag
                            key={o.name}
                            style={FILTER_TAG}
                            color={(derived.activeFilters ?? {}).tags?.includes(o.name) ? 'blue' : 'default'}
                            onClick={() => {
                              const cur = (derived.activeFilters ?? {}).tags ?? []
                              const next = cur.includes(o.name)
                                ? cur.filter((x: string) => x !== o.name)
                                : [...cur, o.name]
                              setFilters({ tags: next })
                            }}
                          >
                            {o.name}（{o.count}）
                          </Tag>
                        ))
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                    <Typography.Text type="secondary" style={FILTER_LABEL}>
                      排序
                    </Typography.Text>
                    {derived.sortRules.map((r: { id: string; label: string }, i: number) => (
                      <Space key={r.id} size={2} style={{ flexShrink: 0 }}>
                        <Tag color="processing" style={{ ...FILTER_TAG, cursor: 'default' }}>
                          {r.label}
                        </Tag>
                        <Button
                          size="small"
                          type="text"
                          disabled={i === 0}
                          onClick={() => {
                            const ids = derived.sortRules.map((x: { id: string }) => x.id)
                            ;[ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!]
                            setSortRules(ids)
                          }}
                        >
                          ↑
                        </Button>
                        <Button
                          size="small"
                          type="text"
                          disabled={i === derived.sortRules.length - 1}
                          onClick={() => {
                            const ids = derived.sortRules.map((x: { id: string }) => x.id)
                            ;[ids[i], ids[i + 1]] = [ids[i + 1]!, ids[i]!]
                            setSortRules(ids)
                          }}
                        >
                          ↓
                        </Button>
                        <Button
                          size="small"
                          type="text"
                          danger
                          onClick={() => {
                            const next = derived.sortRules
                              .map((x: { id: string }) => x.id)
                              .filter((_: string, j: number) => j !== i)
                            setSortRules(next.length ? next : ['importedAtDesc'])
                          }}
                        >
                          ×
                        </Button>
                      </Space>
                    ))}
                    <Select
                      size="small"
                      placeholder="添加排序规则"
                      style={{ width: 168, minWidth: 140 }}
                      allowClear
                      options={[
                        { id: 'importedAtDesc', label: '导入时间（新→旧）' },
                        { id: 'importedAtAsc', label: '导入时间（旧→新）' },
                        { id: 'sizeDesc', label: '文件大小（大→小）' },
                        { id: 'sizeAsc', label: '文件大小（小→大）' },
                        { id: 'nameAsc', label: '文件名（A→Z）' },
                        { id: 'nameDesc', label: '文件名（Z→A）' },
                        { id: 'extAsc', label: '扩展名（A→Z）' },
                      ]
                        .filter(
                          (o: { id: string; label: string }) =>
                            !derived.sortRules.some((r: { id: string }) => r.id === o.id)
                        )
                        .map((o) => ({ value: o.id, label: o.label }))}
                      onChange={(v) => {
                        if (v) setSortRules([...derived.sortRules.map((x) => x.id), v])
                      }}
                    />
                  </div>
          </div>
        ) : null}
      </Card>

      <Card
        size="small"
        title={`${listFiltered.length} 张${selectedFilteredPhotos.length ? ` · 已选 ${selectedFilteredPhotos.length}` : ''}`}
        extra={resultsCardExtra}
        style={{ flex: 1, minHeight: 0 }}
        styles={{
          header: {
            flexWrap: 'wrap',
            alignItems: 'center',
            rowGap: 4,
            minHeight: 36,
            paddingBlock: 6,
          },
        }}
      >
            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 168px)', minHeight: 280 }}>
              {derived.results.length === 0 ? (
                <Empty description="暂无图片" />
              ) : listFiltered.length === 0 ? (
                <Empty description="无匹配结果" />
              ) : effectiveViewMode === 'list' ? (
                <div>
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                    }}
                  >
                    {listPageItems.map((img: (typeof derived.results)[0]) => (
                      <li
                        key={img.id}
                        style={{
                          display: 'flex',
                          gap: 16,
                          alignItems: 'flex-start',
                          padding: '12px 0',
                          borderBlockEnd: '1px solid rgba(5, 5, 5, 0.06)',
                        }}
                      >
                        <div className="media-select-host" style={{ width: 48, height: 48, flexShrink: 0 }}>
                          <PhotoThumbWithTooltip
                            img={img}
                            size={48}
                            loadThumb={loadThumb}
                            onOpenPreview={(i) => void openLargePreview(i)}
                          />
                          <div
                            role="button"
                            aria-label={selectedPhotoIds.includes(img.id) ? '取消选择' : '选择图片'}
                            className={`media-select-dot ${selectedPhotoIds.includes(img.id) ? 'is-selected' : ''}`}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setSelectedPhotoIds((prev) =>
                                prev.includes(img.id) ? prev.filter((id) => id !== img.id) : [...prev, img.id],
                              )
                            }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ marginBottom: 8 }}>
                            <PhotoTitleRow img={img} />
                          </div>
                          <Space wrap size={[4, 4]} style={{ width: '100%' }}>
                            {(img.userTags ?? []).map((t: string) => (
                              <Tag key={t} color="blue">
                                {t}
                              </Tag>
                            ))}
                            <TagInput
                              imageId={img.id}
                              onAdd={addUserTag}
                              onSuggest={getTagSuggestions}
                            />
                          </Space>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <Pagination
                      current={listPage}
                      pageSize={listPageSize}
                      total={listFiltered.length}
                      showSizeChanger={false}
                      showTotal={(t) => `共 ${t} 条`}
                      onChange={(p) => setListPage(p)}
                    />
                  </div>
                </div>
              ) : (
                <Row gutter={[12, 12]}>
                  {listFiltered.map((img: (typeof derived.results)[0]) => (
                    <Col key={img.id} xs={12} sm={8} md={6} lg={6}>
                      <Card
                        size="small"
                        hoverable
                        cover={
                          <div className="media-select-host">
                            <PhotoThumbWithTooltip
                              img={img}
                              size={160}
                              loadThumb={loadThumb}
                              onOpenPreview={(i) => void openLargePreview(i)}
                              triggerStyle={{ display: 'block' }}
                            />
                            <div
                              role="button"
                              aria-label={selectedPhotoIds.includes(img.id) ? '取消选择' : '选择图片'}
                              className={`media-select-dot ${selectedPhotoIds.includes(img.id) ? 'is-selected' : ''}`}
                              onClick={(ev) => {
                                ev.stopPropagation()
                                setSelectedPhotoIds((prev) =>
                                  prev.includes(img.id) ? prev.filter((id) => id !== img.id) : [...prev, img.id],
                                )
                              }}
                            />
                          </div>
                        }
                        actions={[]}
                      >
                        <Card.Meta
                          title={<PhotoTitleRow img={img} />}
                          description={
                            <Space wrap size={[4, 4]} style={{ width: '100%', position: 'relative' }}>
                              {(img.userTags ?? []).map((t: string) => (
                                <Tag key={t} color="blue">
                                  {t}
                                </Tag>
                              ))}
                              <TagInput
                                imageId={img.id}
                                onAdd={addUserTag}
                                onSuggest={getTagSuggestions}
                              />
                            </Space>
                          }
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </div>
          </Card>

      <Modal
        open={!!largePreview}
        title={largePreviewImage ? (largePreviewImage.displayName ?? largePreviewImage.originalName) : '预览'}
        onCancel={closeLargePreview}
        footer={
          <Button type="primary" onClick={closeLargePreview}>
            关闭
          </Button>
        }
        width={Math.min(920, typeof window !== 'undefined' ? window.innerWidth - 32 : 920)}
        destroyOnHidden
        centered
      >
        {largePreview && largePreviewImage ? (
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <div
              style={{
                textAlign: 'center',
                background: 'rgba(0,0,0,0.04)',
                borderRadius: 8,
                padding: 8,
              }}
            >
              <img
                src={largePreview.url}
                alt=""
                style={{
                  maxWidth: '100%',
                  maxHeight: 'min(70vh, 720px)',
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
            </div>
            <PhotoTitleRow img={largePreviewImage} />
            <div>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                删除自定义标签请在本窗口内操作
              </Typography.Text>
              <Space wrap size={[4, 8]}>
                {(largePreviewImage.userTags ?? []).map((t: string) => (
                  <Tag key={t} color="blue" closable onClose={() => removeUserTag(largePreviewImage.id, t)}>
                    {t}
                  </Tag>
                ))}
                <TagInput
                  imageId={largePreviewImage.id}
                  onAdd={addUserTag}
                  onSuggest={getTagSuggestions}
                />
              </Space>
            </div>
          </Space>
        ) : largePreview ? (
          <Typography.Text type="secondary">图片已不在当前索引中</Typography.Text>
        ) : null}
      </Modal>

      <Modal
        open={importOpen}
        title="导入图片"
        width={700}
        onCancel={() => setImportOpen(false)}
        footer={
          <Button onClick={() => setImportOpen(false)}>关闭</Button>
        }
        destroyOnHidden
        centered
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <Button icon={<InboxOutlined />} onClick={handlePickFiles}>
              选择图片文件
            </Button>
            <Button onClick={handlePickFolder}>选择文件夹</Button>
            <Button
              type="primary"
              loading={importing}
              disabled={!importFilesList.length}
              onClick={handleStartImport}
            >
              开始导入 ({importFilesList.length})
            </Button>
          </Space>
          <Typography.Text type="secondary">
            {importFilesList.length
              ? `已选 ${importFilesList.length} 个文件`
              : '尚未选择文件'}
          </Typography.Text>
          <div
            style={{
              maxHeight: 300,
              overflow: 'auto',
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              padding: 8,
            }}
          >
            {importFilesList.length === 0 ? (
              <Empty description="选择文件或文件夹以预览" />
            ) : (
              importFilesList.slice(0, 100).map((p: PhotoImportPickItem, idx: number, arr: PhotoImportPickItem[]) => (
                <div
                  key={`${p.file.name}-${p.file.size}-${idx}`}
                  style={{
                    padding: '8px 0',
                    borderBottom: idx < arr.length - 1 ? '1px solid #f0f0f0' : undefined,
                  }}
                >
                  {p.file.name} — {formatBytes(p.file.size)}
                </div>
              ))
            )}
            {importFilesList.length > 100 && (
              <Typography.Text type="secondary">
                共 {importFilesList.length} 个，仅预览前 100 个
              </Typography.Text>
            )}
          </div>
        </Space>
      </Modal>

    </div>
  )
}

function TagInput({
  imageId,
  onAdd,
  onSuggest,
}: {
  imageId: string
  onAdd: (id: string, tag: string) => void
  onSuggest: (q: string) => string[]
}) {
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggest, setShowSuggest] = useState(false)

  useEffect(() => {
    const q = value.trim().replace(/^#/, '')
    if (!q) {
      setSuggestions([])
      return
    }
    setSuggestions(onSuggest(value))
  }, [value, onSuggest])

  return (
    <div style={{ marginTop: 0, position: 'relative', display: 'inline-block', minWidth: 120, verticalAlign: 'middle' }}>
      <Input
        size="small"
        placeholder="# 输入标签，回车添加"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const tag = value.trim()
            if (tag) {
              onAdd(imageId, tag)
              setValue('')
            }
          }
        }}
        onFocus={() => setShowSuggest(true)}
        onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
      />
      {showSuggest && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 10,
            maxHeight: 150,
            overflow: 'auto',
          }}
        >
          {suggestions.map((s) => (
            <div
              key={s}
              style={{ padding: '4px 8px', cursor: 'pointer' }}
              onMouseDown={() => {
                onAdd(imageId, s)
                setValue('')
                setShowSuggest(false)
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
