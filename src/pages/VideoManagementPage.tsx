import {
  DeleteFilled,
  EditOutlined,
  ExportOutlined,
  EyeFilled,
  PlayCircleFilled,
  PlusOutlined,
  StarFilled,
  SwapOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Image,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { Resizable } from 'react-resizable'
import { theme } from 'antd'
import { CoverCropModal } from '../components/CoverCropModal'
import { MediaAppToolbar } from '../components/MediaAppToolbar'
import { MediaFilterSortCard, MediaResultsCard, SelectAllToggleButton } from '../components/media/MediaLibraryChrome'
import { useAppShell } from '../context/AppShellContext'
import { buildMediaLibraryExportFolderName } from '../export/mediaExportLabel'
import { exportFileTasksToUserFolder, isFsDirectoryPickerSupported } from '../export/fsExportCore'
import { buildWorkMediaExportTasks } from '../export/workMediaExport'
import {
  collectCategories,
  collectTags,
  filterMediaList,
  mergeMediaUi,
  sortMediaList,
  type MediaListSearchField,
} from '../media/mediaLibraryModel'
import { getAppData, updateAppData } from '../storage/appStore'
import {
  isFileSystemAccessSupported,
  removeLocalVideoHandle,
  resolveLocalHandleUrl,
  saveLocalVideoHandle,
  showVideoFilePicker,
} from '../storage/localFileStore'
import type { MediaLibraryUiState, MediaLibraryViewMode, Video, VideoSource } from '../storage/types'

function uid() {
  return `s_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

/** 根据运行环境获取播放地址 */
function getSourcePlayUrl(s: VideoSource, isElectron: boolean): string | undefined {
  return isElectron ? s.urlExe : s.urlBrowser
}

/** 获取默认播放地址（当前环境可用） */
function getDefaultPlayUrl(v: Video, isElectron: boolean): string | undefined {
  const def = v.sources.find((s) => s.id === v.defaultSourceId) ?? v.sources[0]
  if (!def) return undefined
  let url = getSourcePlayUrl(def, isElectron)
  if (!url && v.sources.length > 1) {
    url = v.sources.map((s) => getSourcePlayUrl(s, isElectron)).find(Boolean)
  }
  return url
}

/** 获取地址展示文本（根据环境） */
function getSourceDisplayText(s: VideoSource, isElectron: boolean): string {
  const url = getSourcePlayUrl(s, isElectron)
  if (url) {
    if (url.startsWith('local-handle:')) return '本地文件（浏览器引用）'
    return url
  }
  return isElectron ? '（仅浏览器可用）' : '（仅桌面端可用）'
}

type ResizeableTitleProps = {
  onResize: (e: React.SyntheticEvent, data: { size: { width: number } }) => void
  width: number
  [key: string]: unknown
}

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

function ResizeableTitle(props: ResizeableTitleProps) {
  const { onResize, width, ...restProps } = props
  return (
    <Resizable
      width={width}
      height={0}
      axis="x"
      handle={(h, ref) => (
        <span
          ref={ref}
          className={`react-resizable-handle react-resizable-handle-${h}`}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
      resizeHandles={['e']}
    >
      <th {...restProps} />
    </Resizable>
  )
}

function CoverCell({
  coverUrl,
  coverOriginalUrl,
  name,
  selected,
  onToggleSelect,
}: {
  coverUrl: string
  coverOriginalUrl?: string
  name: string
  selected?: boolean
  onToggleSelect?: () => void
}) {
  return (
    <div className="media-select-host" style={{ width: 56, height: 78 }}>
      <Tooltip
        title={
          <img
            src={coverOriginalUrl || coverUrl}
            alt={name}
            style={{ width: 300, height: 300, objectFit: 'contain', background: '#111' }}
          />
        }
      >
        <Image
          src={coverUrl}
          alt={name}
          width={56}
          height={78}
          style={{ objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
          preview={{ mask: '点击放大', src: coverOriginalUrl || coverUrl }}
        />
      </Tooltip>
      {onToggleSelect ? (
        <div
          role="button"
          aria-label={selected ? '取消选择' : '选择作品'}
          className={`media-select-dot ${selected ? 'is-selected' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
        />
      ) : null}
    </div>
  )
}

function PillText({
  text,
  title,
  background,
  color,
}: {
  text: string
  title?: string
  background: string
  color: string
}) {
  const shown = text.trim() ? text : '—'
  const tooltip = title ?? (text.trim() ? text : undefined)
  return (
    <Tooltip title={tooltip} placement="topLeft">
      <Typography.Text
        ellipsis
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          padding: '2px 10px',
          borderRadius: 999,
          background,
          color,
          cursor: 'default',
          lineHeight: '20px',
          whiteSpace: 'nowrap',
        }}
      >
        {shown}
      </Typography.Text>
    </Tooltip>
  )
}

function PillList({
  items,
  background,
  color,
  emptyText = '—',
}: {
  items: string[]
  background: string
  color: string
  emptyText?: string
}) {
  const cleaned = items.map((s) => s.trim()).filter(Boolean)
  const tooltip = cleaned.length ? cleaned.join(' ') : undefined
  if (!cleaned.length) {
    return <PillText text={emptyText} background={background} color={color} />
  }

  const GAP = 6
  const containerRef = useRef<HTMLDivElement | null>(null)
  const overflowRef = useRef<HTMLSpanElement | null>(null)
  const pillRefs = useRef<Array<HTMLSpanElement | null>>([])
  const [visibleCount, setVisibleCount] = useState<number>(cleaned.length)

  // Keep ref array length aligned.
  pillRefs.current = cleaned.map((_, i) => pillRefs.current[i] ?? null)

  const recompute = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const available = el.clientWidth
    if (!available) return

    const widths = pillRefs.current.map((n) => (n ? n.offsetWidth : 0))
    const overflowW = overflowRef.current ? overflowRef.current.offsetWidth : 0
    if (!widths.length) {
      setVisibleCount(0)
      return
    }

    // Fast path: all fit (including gaps).
    const totalAll = widths.reduce((sum, w) => sum + w, 0) + GAP * Math.max(0, widths.length - 1)
    if (totalAll <= available) {
      setVisibleCount(widths.length)
      return
    }

    // Need overflow indicator. Reserve its width (+gap if there is at least one visible pill).
    // Find maximum count that fits with ".." pill.
    let sum = 0
    let count = 0
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i]
      const nextSum = count === 0 ? w : sum + GAP + w
      const needed = nextSum + GAP + overflowW
      if (needed <= available) {
        sum = nextSum
        count++
      } else {
        break
      }
    }

    // If even the first pill + ".." doesn't fit, show only "..".
    if (count === 0) {
      setVisibleCount(0)
      return
    }
    setVisibleCount(count)
  }, [])

  // Measure after layout, and when width changes (including column resize).
  useLayoutEffect(() => {
    recompute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleaned.join('\u0000')])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => recompute())
    ro.observe(el)
    return () => ro.disconnect()
  }, [recompute])

  const hasOverflow = visibleCount < cleaned.length
  const visibleItems = cleaned.slice(0, visibleCount)

  // Render a hidden measurement row with all pills + ".." so we always know widths.
  return (
    <Tooltip title={tooltip} placement="topLeft">
      <div style={{ position: 'relative', maxWidth: '100%', cursor: 'default' }}>
        <div
          ref={containerRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: GAP,
            maxWidth: '100%',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {visibleItems.map((t, i) => (
            <Typography.Text
              key={`${t}-${i}`}
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 999,
                background,
                color,
                lineHeight: '20px',
                flex: '0 0 auto',
              }}
            >
              {t}
            </Typography.Text>
          ))}
          {hasOverflow && (
            <Typography.Text
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 999,
                background,
                color,
                lineHeight: '20px',
                flex: '0 0 auto',
              }}
            >
              ..
            </Typography.Text>
          )}
        </div>

        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: 0,
            overflow: 'hidden',
            visibility: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
            {cleaned.map((t, i) => (
              <span
                key={`${t}-${i}-m`}
                ref={(n) => {
                  pillRefs.current[i] = n
                }}
                style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: 999,
                  background,
                  color,
                  lineHeight: '20px',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                {t}
              </span>
            ))}
            <span
              ref={overflowRef}
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 999,
                background,
                color,
                lineHeight: '20px',
                fontSize: 'inherit',
                fontFamily: 'inherit',
              }}
            >
              ..
            </span>
          </div>
        </div>
      </div>
    </Tooltip>
  )
}

export function VideoManagementPage() {
  const { token } = theme.useToken()
  const { setContentHeaderRight } = useAppShell()
  const { TextArea } = Input
  const [searchParams] = useSearchParams()
  const [uiTick, setUiTick] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState<Video | null>(null)
  const [sourceForm, setSourceForm] = useState<{ url: string; label: string }>({ url: '', label: '' })
  const [addingSource, setAddingSource] = useState(false)
  const [selectingLocalFile, setSelectingLocalFile] = useState(false)
  const [actorText, setActorText] = useState('')
  const [categoryText, setCategoryText] = useState('')
  const [tagText, setTagText] = useState('')
  const [descriptionText, setDescriptionText] = useState('')
  const [detailMode, setDetailMode] = useState<'create' | 'edit'>('edit')
  const [originalId, setOriginalId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [exportSelectedLoading, setExportSelectedLoading] = useState(false)

  const videoUi = useMemo(
    () => mergeMediaUi(getAppData().mediaUi?.video),
    [refreshKey, uiTick],
  )

  const patchVideoUi = useCallback((patch: Partial<MediaLibraryUiState>) => {
    updateAppData((d) => {
      d.mediaUi = d.mediaUi ?? {}
      d.mediaUi.video = mergeMediaUi({ ...d.mediaUi.video, ...patch })
    })
    setUiTick((t) => t + 1)
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      patchVideoUi({ searchKeyword: q, searchField: 'name' })
    }
  }, [searchParams, patchVideoUi])
  const [colWidths, setColWidths] = useState({
    cover: 100,
    name: 180,
    id: 140,
    actors: 200,
    category: 140,
    tags: 200,
    actions: 160,
  })
  const [playingVideo, setPlayingVideo] = useState<{ url: string; name: string } | null>(null)
  const [hoveringSourceId, setHoveringSourceId] = useState<string | null>(null)
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
  const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null)
  const coverFileInputRef = useRef<HTMLInputElement | null>(null)

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI

  const colOrder: Array<keyof typeof colWidths> = useMemo(
    () => ['cover', 'name', 'id', 'actors', 'category', 'tags', 'actions'],
    [],
  )

  const minColWidth: Record<keyof typeof colWidths, number> = useMemo(
    () => ({
      cover: 90,
      name: 120,
      id: 120,
      actors: 160,
      category: 120,
      tags: 140,
      actions: 140,
    }),
    [],
  )

  const handleResize = useCallback(
    (key: keyof typeof colWidths) =>
      (_: React.SyntheticEvent, { size }: { size: { width: number } }) => {
        const nextW = Math.round(size.width)
        setColWidths((prev) => {
          const idx = colOrder.indexOf(key)
          if (idx < 0) return prev

          // Resize should keep overall table width stable by adjusting a neighbor column.
          const neighbor =
            idx < colOrder.length - 1 ? colOrder[idx + 1] : colOrder[idx - 1]
          if (!neighbor || neighbor === key) return prev

          const curMin = minColWidth[key]
          const nbMin = minColWidth[neighbor]

          const curOld = prev[key]
          const nbOld = prev[neighbor]

          let curNew = Math.max(curMin, nextW)
          const delta = curNew - curOld

          // Compensate neighbor in opposite direction.
          let nbNew = nbOld - delta
          if (nbNew < nbMin) {
            nbNew = nbMin
            // If neighbor hits min, limit how far current column can grow.
            curNew = curOld + (nbOld - nbNew)
          }

          // If user drags to shrink current below min, we already clamp it; neighbor expands accordingly.
          // Ensure integers.
          curNew = Math.round(curNew)
          nbNew = Math.round(nbNew)

          if (curNew === curOld && nbNew === nbOld) return prev
          return { ...prev, [key]: curNew, [neighbor]: nbNew }
        })
      },
    [colOrder, minColWidth],
  )

  const videos = useMemo(() => getAppData().videos, [refreshKey])
  const categoryOptions = useMemo(() => collectCategories(videos), [videos])
  const tagOptions = useMemo(() => collectTags(videos), [videos])

  const filtered = useMemo(() => {
    const base = filterMediaList(videos, {
      keyword: videoUi.searchKeyword ?? '',
      searchField: (videoUi.searchField ?? 'name') as MediaListSearchField,
      categoryFilters: videoUi.categoryFilters ?? [],
      tagFilters: videoUi.tagFilters ?? [],
      createdRange: videoUi.createdRange ?? null,
    })
    return sortMediaList(
      base,
      videoUi.sortBy ?? 'createdAt',
      videoUi.sortOrder ?? 'desc',
    )
  }, [videos, videoUi])
  const selectedFilteredVideos = useMemo(() => {
    if (!selectedIds.length) return []
    const idSet = new Set(selectedIds)
    return filtered.filter((v) => idSet.has(v.id))
  }, [selectedIds, filtered])
  const allCurrentVideosSelected =
    filtered.length > 0 && selectedFilteredVideos.length === filtered.length

  useEffect(() => {
    const idSet = new Set(videos.map((v) => v.id))
    setSelectedIds((prev) => prev.filter((id) => idSet.has(id)))
  }, [videos])

  const hasPanelFilters = Boolean(
    (videoUi.categoryFilters ?? []).length ||
      (videoUi.tagFilters ?? []).length ||
      videoUi.createdRange != null,
  )

  const clearPanelFilters = useCallback(() => {
    patchVideoUi({
      categoryFilters: [],
      tagFilters: [],
      createdRange: undefined,
    })
  }, [patchVideoUi])

  const toggleCategoryFilter = useCallback(
    (cat: string) => {
      const cur = new Set(videoUi.categoryFilters ?? [])
      if (cur.has(cat)) cur.delete(cat)
      else cur.add(cat)
      patchVideoUi({ categoryFilters: Array.from(cur) })
    },
    [patchVideoUi, videoUi.categoryFilters],
  )

  const toggleTagFilter = useCallback(
    (tag: string) => {
      const cur = new Set(videoUi.tagFilters ?? [])
      if (cur.has(tag)) cur.delete(tag)
      else cur.add(tag)
      patchVideoUi({ tagFilters: Array.from(cur) })
    },
    [patchVideoUi, videoUi.tagFilters],
  )

  const createdRangeValue = useMemo((): [Dayjs, Dayjs] | null => {
    const r = videoUi.createdRange
    if (r == null) return null
    return [dayjs(r.startMs), dayjs(r.endMs)]
  }, [videoUi.createdRange])

  const toFileUrl = useCallback((path: string): string => {
    const normalized = path.replace(/\\/g, '/')
    if (normalized.startsWith('/')) return `file://${normalized}`
    return `file:///${normalized}`
  }, [])

  const handlePlay = useCallback(
    async (v: Video) => {
      const url = getDefaultPlayUrl(v, isElectron)
      if (!url) {
        message.warning('当前环境暂无可用播放地址，请添加对应环境的地址')
        return
      }
      const doPlay = (playUrl: string) => {
        updateAppData((d) => {
          const vid = d.videos.find((x) => x.id === v.id)
          if (vid) {
            vid.playCount = (vid.playCount ?? 0) + 1
            vid.playHistory = vid.playHistory ?? []
            vid.playHistory.push(Date.now())
          }
        })
        setPlayingVideo({ url: playUrl, name: v.name })
      }
      if (isElectron) {
        const isLocalPath = !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('local-handle:')
        if (isLocalPath) {
          doPlay(toFileUrl(url))
        } else {
          const playUrl = url.startsWith('local-handle:')
            ? await resolveLocalHandleUrl(url)
            : url
          if (playUrl) doPlay(playUrl)
        }
      } else {
        const isNetworkUrl = url.startsWith('http://') || url.startsWith('https://')
        const isLocalHandle = url.startsWith('local-handle:')
        if (isNetworkUrl) {
          doPlay(url)
        } else if (isLocalHandle) {
          const playUrl = await resolveLocalHandleUrl(url)
          if (playUrl) doPlay(playUrl)
          else message.error('本地文件引用已失效，请重新选择')
        } else {
          message.info('该地址为桌面端路径，请在 exe 中播放')
        }
      }
    },
    [isElectron, toFileUrl],
  )

  const handlePlaySource = useCallback(
    async (video: { id: string; name: string }, source: VideoSource) => {
      const url = getSourcePlayUrl(source, isElectron)
      if (!url) {
        message.warning(isElectron ? '该播放地址无桌面端路径，请添加' : '该播放地址无浏览器可用地址，请添加')
        return
      }
      const doPlay = (playUrl: string) => {
        updateAppData((d) => {
          const vid = d.videos.find((x) => x.id === video.id)
          if (vid) {
            vid.playCount = (vid.playCount ?? 0) + 1
            vid.playHistory = vid.playHistory ?? []
            vid.playHistory.push(Date.now())
          }
        })
        setPlayingVideo({ url: playUrl, name: video.name })
      }
      if (isElectron) {
        const isLocalPath = !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('local-handle:')
        if (isLocalPath) {
          doPlay(toFileUrl(url))
        } else {
          const playUrl = url.startsWith('local-handle:') ? await resolveLocalHandleUrl(url) : url
          if (playUrl) doPlay(playUrl)
        }
      } else {
        const isNetworkUrl = url.startsWith('http://') || url.startsWith('https://')
        const isLocalHandle = url.startsWith('local-handle:')
        if (isNetworkUrl) {
          doPlay(url)
        } else if (isLocalHandle) {
          const playUrl = await resolveLocalHandleUrl(url)
          if (playUrl) doPlay(playUrl)
          else message.error('本地文件引用已失效，请重新选择')
        } else {
          message.info('该地址为桌面端路径，请在 exe 中播放')
        }
      }
    },
    [isElectron, toFileUrl],
  )

  const handleDelete = useCallback((v: Video) => {
    Modal.confirm({
      title: '确认删除？',
      content: `将删除作品：${v.name}`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        updateAppData((d) => {
          d.videos = d.videos.filter((x) => x.id !== v.id)
        })
        setRefreshKey((k) => k + 1)
        message.success('已删除')
      },
    })
  }, [])

  const handleExportSelectedVideos = useCallback(async () => {
    if (!selectedFilteredVideos.length) {
      message.warning('请先选择要导出的作品')
      return
    }
    if (!isFsDirectoryPickerSupported()) {
      message.info('请使用 Chrome 或 Edge，并允许选择保存文件夹')
      return
    }
    setExportSelectedLoading(true)
    try {
      const folderName = `${buildMediaLibraryExportFolderName(videoUi, 'video')}_已选`
      const { tasks, skipMessages } = buildWorkMediaExportTasks(selectedFilteredVideos, isElectron)
      if (!tasks.length) {
        message.warning(skipMessages[0] ?? '没有可导出的文件')
        return
      }
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
      setExportSelectedLoading(false)
    }
  }, [selectedFilteredVideos, videoUi, isElectron])

  const handleDeleteSelectedVideos = useCallback(() => {
    if (!selectedFilteredVideos.length) {
      message.warning('请先选择要删除的作品')
      return
    }
    Modal.confirm({
      title: '确认删除已选作品？',
      content: `将删除 ${selectedFilteredVideos.length} 条作品记录。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        const idSet = new Set(selectedFilteredVideos.map((x) => x.id))
        updateAppData((d) => {
          d.videos = d.videos.filter((x) => !idSet.has(x.id))
        })
        setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)))
        setRefreshKey((k) => k + 1)
        message.success(`已删除 ${selectedFilteredVideos.length} 条记录`)
      },
    })
  }, [selectedFilteredVideos])

  const parseActors = useCallback((text: string): string[] => {
    return text
      .split(/[、，,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }, [])

  const openDetail = useCallback((v: Video) => {
    let copy = { ...v, sources: [...v.sources] }
    if (copy.sources.length > 0 && !copy.sources.some((s) => s.id === copy.defaultSourceId)) {
      copy.defaultSourceId = copy.sources[0].id
    }
    setDetailMode('edit')
    setOriginalId(v.id)
    setEditingVideo(copy)
    setActorText(copy.actorNames.join('、'))
    setCategoryText(copy.category || '')
    setTagText((copy.tags || []).join(' '))
    setDescriptionText(copy.description || '')
    setDetailOpen(true)
    setAddingSource(false)
    setSourceForm({ url: '', label: '' })
  }, [setActorText])

  const handleCreateVideo = useCallback(() => {
    const now = new Date().toISOString()
    const blank: Video = {
      id: '',
      name: '',
      category: '',
      tags: [],
      description: '',
      coverUrl: '',
      actorNames: [],
      defaultSourceId: '',
      sources: [],
      createdAt: now,
    }
    setDetailMode('create')
    setOriginalId(null)
    setEditingVideo(blank)
    setActorText('')
    setCategoryText('')
    setTagText('')
    setDescriptionText('')
    setDetailOpen(true)
    setAddingSource(false)
    setSourceForm({ url: '', label: '' })
  }, [])

  useLayoutEffect(() => {
    setContentHeaderRight(() => (
      <MediaAppToolbar addLabel="新增作品" onAdd={handleCreateVideo} />
    ))
    return () => setContentHeaderRight(null)
  }, [setContentHeaderRight, handleCreateVideo])

  const saveDetail = useCallback(() => {
    if (!editingVideo) return
    const names = parseActors(actorText)
    const tags = tagText
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const uniqTags = Array.from(new Set(tags))
    const nextVideo: Video = {
      ...editingVideo,
      actorNames: names,
      category: categoryText.trim(),
      tags: uniqTags,
      description: descriptionText.trim(),
    }
    if (!nextVideo.id.trim()) {
      message.warning('请填写作品 ID')
      return
    }
    if (!nextVideo.name.trim()) {
      message.warning('请填写作品名称')
      return
    }
    updateAppData((d) => {
      if (detailMode === 'create') {
        d.videos = [{ ...nextVideo }, ...d.videos]
      } else {
        const key = originalId ?? editingVideo.id
        const idx = d.videos.findIndex((x) => x.id === key)
        if (idx >= 0) d.videos[idx] = nextVideo
      }
    })
    setRefreshKey((k) => k + 1)
    setDetailOpen(false)
    setEditingVideo(null)
    message.success('已保存')
  }, [editingVideo, actorText, categoryText, tagText, descriptionText, detailMode, originalId, parseActors])

  const addSource = useCallback(() => {
    if (!editingVideo || !sourceForm.url.trim()) return
    const u = sourceForm.url.trim()
    if (!isElectron && !u.startsWith('http://') && !u.startsWith('https://')) {
      message.warning('浏览器模式下请输入网络地址，或使用「选择本地文件」添加')
      return
    }
    const id = uid()
    const label = sourceForm.label.trim() || undefined
    const newSource: VideoSource = {
      id,
      label,
      ...(u.startsWith('http://') || u.startsWith('https://')
        ? { urlExe: u, urlBrowser: u }
        : { urlExe: u }),
    }
    setEditingVideo((prev) => {
      if (!prev) return null
      const next = { ...prev, sources: [...prev.sources, newSource] }
      if (!next.defaultSourceId && next.sources.length > 0) {
        next.defaultSourceId = next.sources[0].id
      }
      return next
    })
    setSourceForm({ url: '', label: '' })
    setAddingSource(false)
  }, [editingVideo, sourceForm, isElectron])

  const getFileNameFromPath = useCallback((path: string) => {
    const parts = path.replace(/\//g, '\\').split('\\')
    return parts[parts.length - 1] || '本地文件'
  }, [])

  const handleSelectLocalFileExe = useCallback(async () => {
    if (!isElectron || !window.electronAPI?.selectVideoFile) return
    setSelectingLocalFile(true)
    try {
      const path = await window.electronAPI.selectVideoFile()
      if (path && editingVideo) {
        const id = uid()
        const newSource: VideoSource = { id, urlExe: path, label: getFileNameFromPath(path) }
        setEditingVideo((prev) => {
          if (!prev) return null
          const next = { ...prev, sources: [...prev.sources, newSource] }
          if (!next.defaultSourceId && next.sources.length > 0) {
            next.defaultSourceId = next.sources[0].id
          }
          return next
        })
        message.success('已添加（桌面端路径）')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '选择失败')
    } finally {
      setSelectingLocalFile(false)
    }
  }, [isElectron, editingVideo, getFileNameFromPath])

  const handleSelectLocalFileBrowser = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      message.info('请使用 Chrome 或 Edge 浏览器以选择本地文件')
      return
    }
    setSelectingLocalFile(true)
    try {
      const handle = await showVideoFilePicker()
      if (handle && editingVideo) {
        const id = uid()
        const urlBrowser = await saveLocalVideoHandle(id, handle)
        const newSource: VideoSource = { id, urlBrowser, label: handle.name || '本地文件' }
        setEditingVideo((prev) => {
          if (!prev) return null
          const next = { ...prev, sources: [...prev.sources, newSource] }
          if (!next.defaultSourceId && next.sources.length > 0) {
            next.defaultSourceId = next.sources[0].id
          }
          return next
        })
        message.success('已添加（浏览器引用）')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '选择失败')
    } finally {
      setSelectingLocalFile(false)
    }
  }, [editingVideo])

  const handleReplaceExePath = useCallback(
    async (sourceId: string) => {
      if (!isElectron || !window.electronAPI?.selectVideoFile) return
      setSelectingLocalFile(true)
      try {
        const path = await window.electronAPI.selectVideoFile()
        if (path && editingVideo) {
          setEditingVideo((prev) => {
            if (!prev) return null
            return {
              ...prev,
              sources: prev.sources.map((s) =>
                s.id === sourceId ? { ...s, urlExe: path, label: getFileNameFromPath(path) } : s,
              ),
            }
          })
          message.success('已更新桌面端路径')
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : '选择失败')
      } finally {
        setSelectingLocalFile(false)
      }
    },
    [isElectron, editingVideo, getFileNameFromPath],
  )

  const handleReplaceBrowserRef = useCallback(
    async (sourceId: string) => {
      if (!isFileSystemAccessSupported()) {
        message.info('请使用 Chrome 或 Edge 浏览器以更换')
        return
      }
      setSelectingLocalFile(true)
      try {
        const handle = await showVideoFilePicker()
        if (handle && editingVideo) {
          const urlBrowser = await saveLocalVideoHandle(sourceId, handle)
          setEditingVideo((prev) => {
            if (!prev) return null
            return {
              ...prev,
              sources: prev.sources.map((s) =>
                s.id === sourceId ? { ...s, urlBrowser, label: handle.name || s.label } : s,
              ),
            }
          })
          message.success('已更新浏览器引用')
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : '更换失败')
      } finally {
        setSelectingLocalFile(false)
      }
    },
    [editingVideo],
  )

  const handleSupplementBrowserRef = useCallback(
    async (sourceId: string) => {
      if (!isFileSystemAccessSupported()) {
        message.info('请使用 Chrome 或 Edge 浏览器')
        return
      }
      setSelectingLocalFile(true)
      try {
        const handle = await showVideoFilePicker()
        if (handle && editingVideo) {
          const urlBrowser = await saveLocalVideoHandle(sourceId, handle)
          setEditingVideo((prev) => {
            if (!prev) return null
            return {
              ...prev,
              sources: prev.sources.map((s) =>
                s.id === sourceId ? { ...s, urlBrowser, label: handle.name || s.label } : s,
              ),
            }
          })
          message.success('已补充浏览器引用')
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : '补充失败')
      } finally {
        setSelectingLocalFile(false)
      }
    },
    [editingVideo],
  )

  const handleSupplementExePath = useCallback(
    async (sourceId: string) => {
      if (!isElectron || !window.electronAPI?.selectVideoFile) return
      setSelectingLocalFile(true)
      try {
        const path = await window.electronAPI.selectVideoFile()
        if (path && editingVideo) {
          setEditingVideo((prev) => {
            if (!prev) return null
            return {
              ...prev,
              sources: prev.sources.map((s) =>
                s.id === sourceId ? { ...s, urlExe: path, label: getFileNameFromPath(path) } : s,
              ),
            }
          })
          message.success('已补充桌面端路径')
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : '选择失败')
      } finally {
        setSelectingLocalFile(false)
      }
    },
    [isElectron, editingVideo, getFileNameFromPath],
  )

  const handleSelectCover = useCallback(() => {
    coverFileInputRef.current?.click()
  }, [])

  const handleCoverFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editingVideo) return
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setCoverCropSrc(dataUrl)
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [editingVideo],
  )

  const handleCoverCropConfirm = useCallback(
    (croppedUrl: string, originalUrl: string) => {
      setEditingVideo((prev) =>
        prev ? { ...prev, coverUrl: croppedUrl, coverOriginalUrl: originalUrl } : prev,
      )
      setCoverCropSrc(null)
    },
    [],
  )

  const removeSource = useCallback((sourceId: string, s?: VideoSource) => {
    if (s?.urlBrowser?.startsWith('local-handle:')) {
      const id = s.urlBrowser.slice('local-handle:'.length)
      removeLocalVideoHandle(id).catch(console.warn)
    }
    setEditingVideo((prev) => {
      if (!prev) return null
      const next = { ...prev, sources: prev.sources.filter((x) => x.id !== sourceId) }
      if (next.defaultSourceId === sourceId) {
        next.defaultSourceId = next.sources[0]?.id || ''
      }
      return next
    })
  }, [])

  const setDefaultSource = useCallback((sourceId: string) => {
    setEditingVideo((prev) => (prev ? { ...prev, defaultSourceId: sourceId } : null))
  }, [])

  const updateSourceLabel = useCallback((sourceId: string, label: string) => {
    setEditingVideo((prev) => {
      if (!prev) return null
      return {
        ...prev,
        sources: prev.sources.map((s) =>
          s.id === sourceId ? { ...s, label: label.trim() || undefined } : s,
        ),
      }
    })
  }, [])

  const primaryColor = token.colorPrimary

  const columns: ColumnsType<Video> = [
    {
      title: '作品封面',
      dataIndex: 'coverUrl',
      width: colWidths.cover,
      onHeaderCell: () => ({
        width: colWidths.cover,
        onResize: handleResize('cover'),
      }),
      render: (_: string, r) => (
        <CoverCell
          coverUrl={r.coverUrl}
          coverOriginalUrl={r.coverOriginalUrl}
          name={r.name}
          selected={selectedIds.includes(r.id)}
          onToggleSelect={() =>
            setSelectedIds((prev) => (prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id]))
          }
        />
      ),
    },
    {
      title: '作品名称',
      dataIndex: 'name',
      key: 'name',
      width: colWidths.name,
      ellipsis: true,
      onHeaderCell: () => ({
        width: colWidths.name,
        onResize: handleResize('name'),
      }),
      render: (name: string) => (
        <Tooltip title={name} placement="topLeft">
          <span style={{ cursor: 'default' }}>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: '作品ID',
      dataIndex: 'id',
      key: 'id',
      width: colWidths.id,
      ellipsis: true,
      onHeaderCell: () => ({
        width: colWidths.id,
        onResize: handleResize('id'),
      }),
      render: (id: string) => (
        <Tooltip title={id} placement="topLeft">
          <span style={{ cursor: 'default' }}>{id}</span>
        </Tooltip>
      ),
    },
    {
      title: '演员列表',
      dataIndex: 'actorNames',
      key: 'actorNames',
      width: colWidths.actors,
      ellipsis: true,
      onHeaderCell: () => ({
        width: colWidths.actors,
        onResize: handleResize('actors'),
      }),
      render: (arr: string[]) => {
        return (
          <PillList
            items={Array.isArray(arr) ? arr : []}
            background={token.colorFillSecondary}
            color={token.colorText}
            emptyText="—"
          />
        )
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: colWidths.category,
      ellipsis: true,
      onHeaderCell: () => ({
        width: colWidths.category,
        onResize: handleResize('category'),
      }),
      render: (cat: string | undefined) => {
        const text = cat?.trim() ? cat.trim() : '未分类'
        return (
          <PillText
            text={text}
            background={token.colorFillSecondary}
            color={token.colorText}
          />
        )
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: colWidths.tags,
      onHeaderCell: () => ({
        width: colWidths.tags,
        onResize: handleResize('tags'),
      }),
      render: (tags: string[] | undefined) => {
        return (
          <PillList
            items={Array.isArray(tags) ? tags : []}
            background={token.colorFillSecondary}
            color={token.colorText}
            emptyText="—"
          />
        )
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: colWidths.actions,
      onHeaderCell: () => ({
        width: colWidths.actions,
        onResize: handleResize('actions'),
      }),
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="详情">
            <Button
              type="text"
              size="middle"
              icon={<EyeFilled style={{ fontSize: 18, color: primaryColor }} />}
              onClick={() => openDetail(record)}
              style={{ background: 'transparent' }}
            />
          </Tooltip>
          <Tooltip title="播放">
            <Button
              type="text"
              size="middle"
              icon={<PlayCircleFilled style={{ fontSize: 18, color: primaryColor }} />}
              onClick={() => handlePlay(record)}
              style={{ background: 'transparent' }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              size="middle"
              danger
              icon={<DeleteFilled style={{ fontSize: 18 }} />}
              onClick={() => handleDelete(record)}
              style={{ background: 'transparent' }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const viewMode = videoUi.viewMode === 'grid' ? 'grid' : 'list'
  const pageSize = videoUi.listPageSize ?? 10

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
      <MediaFilterSortCard
        filterExpanded={videoUi.filterExpanded ?? false}
        onFilterExpandedChange={(v) => patchVideoUi({ filterExpanded: v })}
        hasActiveFilters={hasPanelFilters}
        extra={
          <Space wrap size={[4, 4]} style={{ justifyContent: 'flex-end' }}>
            <Input
              size="small"
              placeholder="搜索"
              value={videoUi.searchKeyword ?? ''}
              onChange={(e) => patchVideoUi({ searchKeyword: e.target.value })}
              style={{ width: 168 }}
              allowClear
            />
            <Select<MediaListSearchField>
              size="small"
              value={(videoUi.searchField ?? 'name') as MediaListSearchField}
              onChange={(v) => patchVideoUi({ searchField: v })}
              options={[
                { label: '作品名称', value: 'name' },
                { label: '作品ID', value: 'id' },
                { label: '演员', value: 'actors' },
                { label: '分类', value: 'category' },
                { label: '标签', value: 'tags' },
              ]}
              style={{ width: 100 }}
            />
          </Space>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 6px' }}>
            <Typography.Text type="secondary" style={FILTER_LABEL}>
              分类
            </Typography.Text>
            {categoryOptions.map((c) => (
              <Tag
                key={c}
                style={FILTER_TAG}
                color={(videoUi.categoryFilters ?? []).includes(c) ? 'blue' : 'default'}
                onClick={() => toggleCategoryFilter(c)}
              >
                {c}
              </Tag>
            ))}
            <Typography.Text type="secondary" style={{ ...FILTER_LABEL, marginLeft: 6 }}>
              标签
            </Typography.Text>
            {tagOptions.slice(0, 40).map((t) => (
              <Tag
                key={t}
                style={FILTER_TAG}
                color={(videoUi.tagFilters ?? []).includes(t) ? 'blue' : 'default'}
                onClick={() => toggleTagFilter(t)}
              >
                {t}
              </Tag>
            ))}
            <Typography.Text type="secondary" style={{ ...FILTER_LABEL, marginLeft: 6 }}>
              创建时间
            </Typography.Text>
            <DatePicker.RangePicker
              size="small"
              allowClear
              style={{ minWidth: 200 }}
              value={createdRangeValue}
              onChange={(dates) => {
                if (!dates?.[0] || !dates[1]) {
                  patchVideoUi({ createdRange: undefined })
                  return
                }
                patchVideoUi({
                  createdRange: {
                    startMs: dates[0].startOf('day').valueOf(),
                    endMs: dates[1].endOf('day').valueOf(),
                  },
                })
              }}
            />
            <Typography.Text type="secondary" style={{ ...FILTER_LABEL, marginLeft: 6 }}>
              排序
            </Typography.Text>
            <Select
              size="small"
              value={videoUi.sortBy ?? 'createdAt'}
              onChange={(v) => patchVideoUi({ sortBy: v })}
              options={[
                { value: 'createdAt', label: '创建时间' },
                { value: 'name', label: '名称' },
                { value: 'playCount', label: '播放次数' },
              ]}
              style={{ width: 110 }}
            />
            <Select
              size="small"
              value={videoUi.sortOrder ?? 'desc'}
              onChange={(v) => patchVideoUi({ sortOrder: v })}
              options={[
                { value: 'asc', label: '升序' },
                { value: 'desc', label: '降序' },
              ]}
              style={{ width: 88 }}
            />
            {hasPanelFilters && (
              <Button
                size="small"
                type="link"
                onClick={clearPanelFilters}
                style={{ marginLeft: 4, padding: '0 4px', fontSize: 12, height: 22 }}
              >
                清空面板筛选
              </Button>
            )}
          </div>
        </div>
      </MediaFilterSortCard>

      <MediaResultsCard
        title={`${filtered.length} 部${selectedFilteredVideos.length ? ` · 已选 ${selectedFilteredVideos.length}` : ''}`}
        extra={
          <Space wrap size={4} style={{ justifyContent: 'flex-end' }}>
            <SelectAllToggleButton
              total={filtered.length}
              selectedCount={selectedFilteredVideos.length}
              onToggle={() =>
                setSelectedIds(allCurrentVideosSelected ? [] : filtered.map((v) => v.id))
              }
            />
            <Button
              size="small"
              icon={<ExportOutlined />}
              loading={exportSelectedLoading}
              disabled={!selectedFilteredVideos.length}
              onClick={() => void handleExportSelectedVideos()}
            >
              导出已选
            </Button>
            <Button size="small" danger disabled={!selectedFilteredVideos.length} onClick={handleDeleteSelectedVideos}>
              删除已选
            </Button>
            {viewMode === 'list' ? (
              <Select
                size="small"
                value={pageSize}
                onChange={(n) => patchVideoUi({ listPageSize: n })}
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
              value={viewMode}
              onChange={(v) => patchVideoUi({ viewMode: v as MediaLibraryViewMode })}
              options={[
                { value: 'grid', label: '缩略图' },
                { value: 'list', label: '列表' },
              ]}
              style={{ width: 88 }}
            />
          </Space>
        }
      >
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 168px)', minHeight: 280 }}>
          {videos.length === 0 ? (
            <Empty description="暂无作品" />
          ) : filtered.length === 0 ? (
            <Empty description="无匹配结果" />
          ) : viewMode === 'list' ? (
            <Table
              rowKey="id"
              dataSource={filtered}
              columns={columns}
              tableLayout="fixed"
              style={{ width: '100%' }}
              components={{
                header: {
                  cell: ResizeableTitle,
                },
              }}
              pagination={{
                pageSize,
                showSizeChanger: false,
                showTotal: (t) => `共 ${t} 条`,
              }}
            />
          ) : (
            <Row gutter={[12, 12]}>
              {filtered.map((v) => (
                <Col key={v.id} xs={12} sm={8} md={6} lg={6}>
                  <Card
                    size="small"
                    hoverable
                    cover={
                      <div className="media-select-host">
                        <Tooltip
                          title={
                            <img
                              src={v.coverOriginalUrl || v.coverUrl}
                              alt={v.name}
                              style={{ width: 300, height: 300, objectFit: 'contain', background: '#111' }}
                            />
                          }
                        >
                          <Image
                            src={v.coverUrl}
                            alt={v.name}
                            style={{ height: 200, objectFit: 'cover' }}
                            preview={{ mask: '放大' }}
                          />
                        </Tooltip>
                        <div
                          role="button"
                          aria-label={selectedIds.includes(v.id) ? '取消选择' : '选择作品'}
                          className={`media-select-dot ${selectedIds.includes(v.id) ? 'is-selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedIds((prev) =>
                              prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id],
                            )
                          }}
                        />
                      </div>
                    }
                  >
                    <Card.Meta
                      title={
                        <Typography.Text ellipsis style={{ maxWidth: '100%' }}>
                          {v.name}
                        </Typography.Text>
                      }
                      description={
                        <Space wrap size={4}>
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeFilled style={{ fontSize: 16, color: primaryColor }} />}
                            onClick={() => openDetail(v)}
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<PlayCircleFilled style={{ fontSize: 16, color: primaryColor }} />}
                            onClick={() => handlePlay(v)}
                          />
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteFilled style={{ fontSize: 16 }} />}
                            onClick={() => handleDelete(v)}
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
      </MediaResultsCard>

      <Modal
        open={detailOpen}
        title="作品详情"
        width={560}
        okText="保存"
        cancelText="取消"
        onCancel={() => setDetailOpen(false)}
        onOk={saveDetail}
      >
        {editingVideo && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0 }}>
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleCoverFileChange}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleSelectCover}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectCover()}
                  style={{
                    width: 120,
                    height: 168,
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: token.colorFillTertiary,
                    border: `1px dashed ${token.colorBorder}`,
                  }}
                >
                  {editingVideo.coverUrl ? (
                    <Image
                      src={editingVideo.coverUrl}
                      alt={editingVideo.name}
                      width={120}
                      height={168}
                      style={{ objectFit: 'cover', borderRadius: 8 }}
                      preview={false}
                    />
                  ) : (
                    <Typography.Text type="secondary" style={{ textAlign: 'center', padding: 8 }}>
                      请选择作品封面图片
                    </Typography.Text>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text strong>作品名称：</Typography.Text>
                  <Input
                    value={editingVideo.name}
                    onChange={(e) =>
                      setEditingVideo((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                    placeholder="请输入作品名称"
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text strong>作品ID：</Typography.Text>
                  <Input
                    value={editingVideo.id}
                    onChange={(e) =>
                      setEditingVideo((prev) => (prev ? { ...prev, id: e.target.value } : prev))
                    }
                    placeholder="请输入作品ID"
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text strong>分类：</Typography.Text>
                  <Input
                    value={categoryText}
                    onChange={(e) => setCategoryText(e.target.value)}
                    placeholder="请输入分类，如：动作、爱情、纪录片..."
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text strong>标签：</Typography.Text>
                  <Input
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="多个标签用空格分隔，如：高分 经典 4K"
                  />
                </div>
                <div style={{ marginBottom: 0 }}>
                  <Typography.Text strong>演员：</Typography.Text>
                  <Input
                    value={actorText}
                    onChange={(e) => setActorText(e.target.value)}
                    placeholder="多个演员用空格 / 逗号 / 顿号分隔"
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <Typography.Text strong>作品描述：</Typography.Text>
                  <TextArea
                    value={descriptionText}
                    onChange={(e) => setDescriptionText(e.target.value)}
                    placeholder="请输入作品描述（可选）"
                    autoSize={{ minRows: 3, maxRows: 6 }}
                  />
                </div>
              </div>
            </div>
            <div>
              <Space style={{ marginBottom: 8 }} wrap>
                <Typography.Text strong>播放地址列表</Typography.Text>
                <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setAddingSource(true)}>
                  手动输入
                </Button>
                {isElectron ? (
                  <>
                    <Button
                      type="link"
                      size="small"
                      icon={<PlusOutlined />}
                      loading={selectingLocalFile}
                      onClick={handleSelectLocalFileExe}
                    >
                      选择本地文件（桌面端路径）
                    </Button>
                    {isFileSystemAccessSupported() && (
                      <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        loading={selectingLocalFile}
                        onClick={handleSelectLocalFileBrowser}
                      >
                        选择本地文件（浏览器引用）
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    loading={selectingLocalFile}
                    onClick={handleSelectLocalFileBrowser}
                  >
                    选择本地文件
                  </Button>
                )}
              </Space>
              {addingSource && (
                <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                  <Input
                    placeholder="播放地址"
                    value={sourceForm.url}
                    onChange={(e) => setSourceForm((s) => ({ ...s, url: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <Input
                    placeholder="标签（可选）"
                    value={sourceForm.label}
                    onChange={(e) => setSourceForm((s) => ({ ...s, label: e.target.value }))}
                    style={{ width: 100 }}
                  />
                  <Button type="primary" onClick={addSource}>
                    添加
                  </Button>
                  <Button onClick={() => setAddingSource(false)}>取消</Button>
                </Space.Compact>
              )}
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                {editingVideo.sources.map((s) => (
                  <div
                    key={s.id}
                    onMouseEnter={() => setHoveringSourceId(s.id)}
                    onMouseLeave={() => setHoveringSourceId(null)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: 8,
                      background: token.colorFillTertiary,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {editingSourceId === s.id ? (
                        <Input
                          autoFocus
                          value={s.label ?? ''}
                          onChange={(e) => updateSourceLabel(s.id, e.target.value)}
                          onBlur={() => setEditingSourceId(null)}
                          onPressEnter={() => setEditingSourceId(null)}
                          placeholder="播放地址名称"
                          style={{ flex: 1, minWidth: 120, fontWeight: 600 }}
                          size="small"
                        />
                      ) : (
                        <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography.Text strong>{s.label || '播放地址'}</Typography.Text>
                          {hoveringSourceId === s.id && (
                            <Tooltip title="重命名">
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined style={{ fontSize: 12 }} />}
                                onClick={() => setEditingSourceId(s.id)}
                                style={{ padding: '0 2px', minWidth: 20 }}
                              />
                            </Tooltip>
                          )}
                        </div>
                      )}
                      <Space size="small">
                        {editingVideo.defaultSourceId === s.id ? (
                          <Tooltip title="默认播放地址">
                            <StarFilled style={{ color: primaryColor, flexShrink: 0 }} />
                          </Tooltip>
                        ) : (
                          <Tooltip title="设为默认播放地址">
                            <Button
                              type="text"
                              size="small"
                              icon={<StarFilled style={{ color: token.colorTextDisabled }} />}
                              onClick={() => setDefaultSource(s.id)}
                            />
                          </Tooltip>
                        )}
                        {getSourcePlayUrl(s, isElectron) && (
                          <Tooltip title="播放">
                            <Button
                              type="text"
                              size="small"
                              icon={<PlayCircleFilled />}
                              onClick={() => handlePlaySource(editingVideo, s)}
                            />
                          </Tooltip>
                        )}
                        {s.urlExe && isElectron && (
                          <Tooltip title="更换桌面端路径">
                            <Button
                              type="text"
                              size="small"
                              icon={<SwapOutlined />}
                              loading={selectingLocalFile}
                              onClick={() => handleReplaceExePath(s.id)}
                            />
                          </Tooltip>
                        )}
                        {s.urlBrowser && isFileSystemAccessSupported() && (
                          <Tooltip title="更换浏览器引用">
                            <Button
                              type="text"
                              size="small"
                              icon={<SwapOutlined />}
                              loading={selectingLocalFile}
                              onClick={() => handleReplaceBrowserRef(s.id)}
                            />
                          </Tooltip>
                        )}
                        {s.urlExe && !s.urlBrowser && isFileSystemAccessSupported() && (
                          <Tooltip title="补充浏览器引用">
                            <Button
                              type="link"
                              size="small"
                              onClick={() => handleSupplementBrowserRef(s.id)}
                              loading={selectingLocalFile}
                            >
                              补充浏览器
                            </Button>
                          </Tooltip>
                        )}
                        {s.urlBrowser && !s.urlExe && isElectron && (
                          <Tooltip title="补充桌面端路径">
                            <Button
                              type="link"
                              size="small"
                              onClick={() => handleSupplementExePath(s.id)}
                              loading={selectingLocalFile}
                            >
                              补充桌面端
                            </Button>
                          </Tooltip>
                        )}
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteFilled />}
                          onClick={() => removeSource(s.id, s)}
                        />
                      </Space>
                    </div>
                    <Space orientation="vertical" size={0} style={{ fontSize: 12 }}>
                      {s.urlExe && (
                        <Tooltip title={s.urlExe} placement="topLeft">
                          <Typography.Text type="secondary" ellipsis style={{ display: 'block' }}>
                            桌面端: {getSourceDisplayText(s, true)}
                          </Typography.Text>
                        </Tooltip>
                      )}
                      {s.urlBrowser && (
                        <Tooltip
                          title={s.urlBrowser.startsWith('local-handle:') ? '浏览器引用' : s.urlBrowser}
                          placement="topLeft"
                        >
                          <Typography.Text type="secondary" ellipsis style={{ display: 'block' }}>
                            浏览器: {getSourceDisplayText(s, false)}
                          </Typography.Text>
                        </Tooltip>
                      )}
                      {!s.urlExe && !s.urlBrowser && (
                        <Typography.Text type="secondary">（无地址）</Typography.Text>
                      )}
                    </Space>
                  </div>
                ))}
                {editingVideo.sources.length === 0 && (
                  <Typography.Text type="secondary">暂无播放地址，点击「新增」添加</Typography.Text>
                )}
              </Space>
            </div>
          </Space>
        )}
      </Modal>

      <CoverCropModal
        open={!!coverCropSrc}
        imageSrc={coverCropSrc || ''}
        onConfirm={handleCoverCropConfirm}
        onCancel={() => setCoverCropSrc(null)}
      />

      <Modal
        open={!!playingVideo}
        title={playingVideo ? `播放：${playingVideo.name}` : ''}
        width={720}
        footer={null}
        destroyOnHidden
        onCancel={() => setPlayingVideo(null)}
      >
        {playingVideo && (
          <video
            src={playingVideo.url}
            controls
            autoPlay
            style={{ width: '100%', maxHeight: '70vh' }}
          />
        )}
      </Modal>
    </div>
  )
}
