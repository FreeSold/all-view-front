import { useCallback, useEffect, useRef, useState } from 'react'
import { useGlobalLog } from '../../context/GlobalLogContext'
import { ensureDirectoryPermission, isElectronShell } from '../../storage/appRoot'
import { mergeAppDataFromDataDirAfterPick, migrateToDataDir } from '../../storage/appStore'
import { removeLocalVideoHandle, saveLocalVideoHandle } from '../../storage/localFileStore'
import { PhotoFsRepo, isFileSystemAccessSupported, type PhotoImportPickItem } from '../../storage/photoFsRepo'
import { buildDerived } from '../../storage/photoDerived'
import { sniffImageDimensionsFromFile, tryCreateThumbnailWebp } from '../../util/photoThumb'
import { extOf, computeAutoTags } from '../../util/photoTags'
import { nanoid } from '../../util/photoId'
import type {
  PhotoIndex,
  PhotoImage,
  PhotoTags,
  PhotoTagEntry,
  PhotoUi,
} from '../../storage/photoTypes'

const DEFAULT_INDEX: PhotoIndex = {
  version: 1,
  images: [],
  ui: {
    viewMode: 'grid',
    activeFolderId: 'all',
    filters: { formats: [], sizes: [], orient: [], tags: [], fileTimeRange: undefined },
    sortRules: ['importedAtDesc'],
  },
}

const DEFAULT_TAGS: PhotoTags = {
  version: 1,
  maxCustomTags: 100,
  tags: [],
}

function normalizeIndex(index: PhotoIndex | null): PhotoIndex {
  if (!index) return structuredClone(DEFAULT_INDEX)
  return {
    version: index.version ?? 1,
    images: index.images ?? [],
    ui: {
      ...DEFAULT_INDEX.ui,
      ...index.ui,
      filters: {
        ...DEFAULT_INDEX.ui!.filters,
        ...index.ui?.filters,
      },
      sortRules: index.ui?.sortRules ?? ['importedAtDesc'],
    },
  }
}

function normalizeTags(tags: PhotoTags | null): PhotoTags {
  if (!tags) return structuredClone(DEFAULT_TAGS)
  return {
    version: tags.version ?? 1,
    maxCustomTags: tags.maxCustomTags ?? 100,
    tags: tags.tags ?? [],
  }
}

export function usePhotoState() {
  const { append: appendGlobalLog } = useGlobalLog()
  const repo = useRef(new PhotoFsRepo()).current
  const [fs, setFs] = useState<{ rootHandle: FileSystemDirectoryHandle | null; rootName: string }>({
    rootHandle: null,
    rootName: '',
  })
  const [index, setIndex] = useState<PhotoIndex>(DEFAULT_INDEX)
  const [tags, setTags] = useState<PhotoTags>(DEFAULT_TAGS)
  /**
   * Electron 下重启后目录句柄权限会重置为 prompt，需用户手势 requestPermission。
   * needsReauth=true 时工具栏显示「重新授权」按钮，用户点击即可恢复访问。
   */
  const [needsReauth, setNeedsReauth] = useState(false)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const indexRef = useRef(index)
  const tagsRef = useRef(tags)
  const fsRef = useRef(fs)

  useEffect(() => { indexRef.current = index }, [index])
  useEffect(() => { tagsRef.current = tags }, [tags])
  useEffect(() => { fsRef.current = fs }, [fs])

  const derived = buildDerived({ index, tags })

  const log = useCallback(
    (msg: string) => { appendGlobalLog(msg) },
    [appendGlobalLog]
  )

  const persistSoon = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(async () => {
      const root = fsRef.current.rootHandle
      if (!root) return
      const idx = indexRef.current
      const tgs = tagsRef.current
      try {
        await repo.saveIndex(idx)
        await repo.saveTags(tgs)
      } catch (e) {
        log(`保存失败：${String(e)}`)
      }
      persistTimer.current = null
    }, 250)
  }, [repo, log])

  const applyLoadedIndexAndTags = useCallback(
    async (loadedIndex: PhotoIndex | null, loadedTags: PhotoTags | null) => {
      let nextIndex = normalizeIndex(loadedIndex)
      const nextTags = normalizeTags(loadedTags)
      if (nextIndex.images.length === 0) {
        const rebuilt = await repo.rebuildIndexFromLibraryFiles()
        if (rebuilt.length > 0) {
          nextIndex = {
            ...nextIndex,
            version: nextIndex.version ?? 1,
            images: rebuilt,
          }
          log(`已从 library 目录识别 ${rebuilt.length} 张图片（原 index.json 为空或缺失）`)
        }
      }
      setIndex(nextIndex)
      setTags(nextTags)
      persistSoon()
    },
    [repo, log, persistSoon]
  )

  const loadAll = useCallback(async () => {
    const handle = await repo.tryRestoreRoot()
    if (!handle) return
    setFs({ rootHandle: handle, rootName: handle.name })
    const canAccess = await ensureDirectoryPermission(handle, true, false)
    if (!canAccess) {
      /**
       * Electron 重启后句柄权限会重置为 prompt；浏览器通常持久化权限不受此影响。
       * 无用户手势时不能调用 requestPermission，只能提示用户点击「重新授权」按钮。
       */
      setNeedsReauth(true)
      log(
        isElectronShell()
          ? '已记住数据目录，但 Electron 重启后目录权限需要重新授权。请点击「重新授权」按钮恢复访问。'
          : '已记住数据目录，但需重新授权：请点击「选择数据目录」并再次选择同一文件夹。',
      )
      return
    }
    setNeedsReauth(false)
    try {
      const { index: loadedIndex, tags: loadedTags } = await repo.loadAll()
      await applyLoadedIndexAndTags(loadedIndex, loadedTags)
    } catch (e) {
      log(`加载失败：${String(e)}。请点击「选择数据目录」重新选择同一文件夹以授权访问。`)
    }
  }, [repo, log, applyLoadedIndexAndTags])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  /**
   * 在 Electron 下用户点击「重新授权」按钮时调用（需要用户手势才能 requestPermission）。
   * 成功后直接加载目录内容，无需重新选择文件夹。
   */
  const reauth = useCallback(async () => {
    const handle = repo.rootHandle
    if (!handle) {
      log('未找到已记住的数据目录，请重新选择。')
      return
    }
    try {
      const granted = await ensureDirectoryPermission(handle, true, true)
      if (granted) {
        setNeedsReauth(false)
        const { index: loadedIndex, tags: loadedTags } = await repo.loadAll()
        await applyLoadedIndexAndTags(loadedIndex, loadedTags)
        log(`已恢复对「${handle.name}」的访问权限。`)
      } else {
        log('授权被拒绝，请尝试重新选择数据目录。')
      }
    } catch (e) {
      log(`授权出错：${String(e)}，请尝试重新选择数据目录。`)
    }
  }, [repo, log, applyLoadedIndexAndTags])

  const pickRoot = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      log('当前浏览器不支持 File System Access API。请使用 Chrome/Edge。')
      return
    }
    try {
      const handle = await repo.pickRoot()
      if (!handle) return
      setFs({ rootHandle: handle, rootName: handle.name })
      setNeedsReauth(false)
      await repo.ensureDirs()
      const merged = await mergeAppDataFromDataDirAfterPick()
      await migrateToDataDir()
      if (merged) {
        if (isElectronShell()) {
          /**
           * Electron：window.location.reload() 会让渲染进程重新初始化，
           * 导致刚刚授权的句柄权限再次重置为 prompt，从而陷入死循环。
           * 直接更新照片状态即可；视频/漫画等的 appStore.cached 已由
           * mergeAppDataFromDataDirAfterPick 写入，导航到对应页面时会读取最新数据。
           */
          const { index: loadedIndex, tags: loadedTags } = await repo.loadAll()
          await applyLoadedIndexAndTags(loadedIndex, loadedTags)
          log('已从数据目录同步应用数据，已加载图片索引。')
        } else {
          log('已从数据目录加载应用数据，正在刷新页面以同步作品库…')
          window.location.reload()
        }
        return
      }
      const { index: loadedIndex, tags: loadedTags } = await repo.loadAll()
      await applyLoadedIndexAndTags(loadedIndex, loadedTags)
      log('已选择数据目录')
    } catch (e) {
      log(`选择目录失败：${String(e)}`)
    }
  }, [repo, log, applyLoadedIndexAndTags])

  const setUi = useCallback(
    (patch: Partial<PhotoUi>) => {
      setIndex((prev: PhotoIndex) => ({
        ...prev,
        ui: { ...prev.ui, ...patch },
      }))
      persistSoon()
    },
    [persistSoon]
  )

  const setFilters = useCallback(
    (patch: Partial<NonNullable<PhotoUi['filters']>>) => {
      setIndex((prev: PhotoIndex) => ({
        ...prev,
        ui: {
          ...prev.ui,
          filters: { ...prev.ui?.filters, ...patch },
        },
      }))
      persistSoon()
    },
    [persistSoon]
  )

  const clearFilters = useCallback(() => {
    setIndex((prev: PhotoIndex) => ({
      ...prev,
      ui: {
        ...prev.ui,
        activeFolderId: 'all',
        filters: { formats: [], sizes: [], orient: [], tags: [], fileTimeRange: undefined },
      },
    }))
    persistSoon()
  }, [persistSoon])

  const setSortRules = useCallback(
    (nextRules: string[]) => {
      setIndex((prev: PhotoIndex) => ({
        ...prev,
        ui: { ...prev.ui, sortRules: nextRules.length ? nextRules : ['importedAtDesc'] },
      }))
      persistSoon()
    },
    [persistSoon]
  )

  const addUserTag = useCallback(
    (imageId: string, rawTag: string) => {
      const tag = rawTag.trim()
      if (!tag) return
      const name = tag.startsWith('#') ? tag : `#${tag}`

      setIndex((prev: PhotoIndex) => {
        const img = prev.images.find((x: PhotoImage) => x.id === imageId)
        if (!img) return prev
        const userTags = img.userTags ?? []
        if (userTags.includes(name)) return prev

        const customCount = tags.tags.length
        const isNew = !tags.tags.some((t: PhotoTagEntry) => t.name === name)
        if (isNew && customCount >= tags.maxCustomTags) {
          log(`自定义标签已达上限 ${tags.maxCustomTags}，无法新增：${name}`)
          return prev
        }

        const nextImages = prev.images.map((x: PhotoImage) =>
          x.id === imageId ? { ...x, userTags: [...userTags, name] } : x
        )
        return { ...prev, images: nextImages }
      })

      setTags((prev: PhotoTags) => {
        const t = prev.tags.find((x: PhotoTagEntry) => x.name === name)
        const now = Date.now()
        if (t) {
          return {
            ...prev,
            tags: prev.tags.map((x: PhotoTagEntry) =>
              x.name === name ? { ...x, count: (x.count ?? 0) + 1, lastUsedAt: now } : x
            ),
          }
        }
        return {
          ...prev,
          tags: [...prev.tags, { name, count: 1, lastUsedAt: now, type: 'user' }],
        }
      })
      persistSoon()
    },
    [tags, log, persistSoon]
  )

  const removeUserTag = useCallback(
    (imageId: string, tagName: string) => {
      setIndex((prev: PhotoIndex) => ({
        ...prev,
        images: prev.images.map((x: PhotoImage) =>
          x.id === imageId
            ? { ...x, userTags: (x.userTags ?? []).filter((t: string) => t !== tagName) }
            : x
        ),
      }))
      persistSoon()
    },
    [persistSoon]
  )

  const getTagSuggestions = useCallback(
    (query: string): string[] => {
      const q = (query ?? '').trim().toLowerCase().replace(/^#/, '')
      if (!q) return []
      return tags.tags
        .map((t: PhotoTagEntry) => t.name)
        .filter((name: string) => name.toLowerCase().replace(/^#/, '').includes(q))
        .slice(0, 10)
    },
    [tags]
  )

  /** 移动导出等：从索引中移除条目 */
  const removeImagesByIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) return
      const idSet = new Set(ids)
      setIndex((prev: PhotoIndex) => ({
        ...prev,
        images: prev.images.filter((x) => !idSet.has(x.id)),
      }))
      persistSoon()
    },
    [persistSoon]
  )

  /**
   * 仅保存文件句柄与索引（不写 library 原图），缩略图写入 thumbs/ 以便列表流畅。
   * 若有成功导入，会把文件夹视图切回「全部」：否则新图在 library/ref/... 下，若仍停留在旧路径子文件夹会看不到。
   */
  const importFiles = useCallback(
    async (
      items: PhotoImportPickItem[],
      options?: { userTagsByVirtualPath?: Record<string, string[]> }
    ): Promise<{ ok: number; skipped: number; fail: number }> => {
      const empty = { ok: 0, skipped: 0, fail: 0 }
      if (!fs.rootHandle || !items.length) return empty
      await repo.ensureDirs()

      const byHash = new Map(
        index.images
          .map((x: PhotoImage) => [x.hash, x] as const)
          .filter(([, x]) => x != null)
      )

      let ok = 0
      let skipped = 0
      let fail = 0

      for (const item of items) {
        const file = item.file
        let savedSourceId: string | undefined
        try {
          const hash = await repo.hashFile(file)
          if (hash && byHash.has(hash)) {
            skipped += 1
            log(`跳过重复：${file.name}`)
            continue
          }

          const ext = extOf(file.name)
          const createdAt = file.lastModified ?? Date.now()
          const id = nanoid()
          const sourceId = `photo_${id}`
          const sourceRef = `local-handle:${sourceId}`

          const thumbBlob = await tryCreateThumbnailWebp(file, 300)
          if (!thumbBlob) {
            log(`缩略图未生成（大图解码限制），仍可打开原图：${file.name}`)
          }

          await saveLocalVideoHandle(sourceId, item.handle)
          savedSourceId = sourceId

          let thumbRelPath: string | undefined
          if (thumbBlob) {
            thumbRelPath = `thumbs/${hash || id}.webp`
            await repo.writeBlob(thumbRelPath, thumbBlob)
          }

          const dims = await getImageDims(file).catch(() => ({ width: 0, height: 0 }))
          const orient =
            dims.width && dims.height
              ? dims.width >= dims.height
                ? 'landscape'
                : 'portrait'
              : 'unknown'

          const img: PhotoImage = {
            id,
            originalName: file.name,
            sizeBytes: file.size,
            ext,
            width: dims.width,
            height: dims.height,
            orientation: orient as 'landscape' | 'portrait' | 'unknown',
            createdAt,
            importedAt: Date.now(),
            libraryRelPath: item.virtualLibraryRelPath,
            sourceRef,
            ...(thumbRelPath ? { thumbRelPath } : {}),
            hash,
            autoTags: computeAutoTags({
              width: dims.width,
              height: dims.height,
            }),
            userTags: normalizeImportTags(options?.userTagsByVirtualPath?.[item.virtualLibraryRelPath] ?? []),
          }
          byHash.set(hash, img)
          setIndex((prev) => ({ ...prev, images: [...prev.images, img] }))
          ok += 1
          log(`已导入：${file.name}`)
        } catch (e) {
          if (savedSourceId) await removeLocalVideoHandle(savedSourceId).catch(() => {})
          fail += 1
          log(`导入失败 ${file.name}：${String(e)}`)
        }
      }

      if (ok > 0) {
        setUi({ activeFolderId: 'all' })
      }

      persistSoon()
      return { ok, skipped, fail }
    },
    [fs.rootHandle, index.images, repo, log, persistSoon, setUi]
  )

  return {
    fs,
    index,
    tags,
    derived,
    repo,
    loadAll,
    pickRoot,
    reauth,
    needsReauth,
    setUi,
    setFilters,
    clearFilters,
    setSortRules,
    addUserTag,
    removeUserTag,
    getTagSuggestions,
    importFiles,
    removeImagesByIds,
    isSupported: isFileSystemAccessSupported(),
  }
}

async function getImageDims(file: File): Promise<{ width: number; height: number }> {
  const sniffed = await sniffImageDimensionsFromFile(file)
  if (sniffed) return sniffed
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function normalizeImportTags(tags: string[]): string[] {
  const cleaned = tags
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}
