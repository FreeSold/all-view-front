import { useCallback, useEffect, useRef, useState } from 'react'
import { migrateToDataDir } from '../../storage/appStore'
import { PhotoFsRepo, isFileSystemAccessSupported } from '../../storage/photoFsRepo'
import { buildDerived } from '../../storage/photoDerived'
import { createThumbnailWebp } from '../../util/photoThumb'
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
    viewMode: 'auto',
    activeFolderId: 'all',
    filters: { formats: [], sizes: [], orient: [], tags: [] },
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
  const repo = useRef(new PhotoFsRepo()).current
  const [fs, setFs] = useState<{ rootHandle: FileSystemDirectoryHandle | null; rootName: string }>({
    rootHandle: null,
    rootName: '',
  })
  const [index, setIndex] = useState<PhotoIndex>(DEFAULT_INDEX)
  const [tags, setTags] = useState<PhotoTags>(DEFAULT_TAGS)
  const [logLines, setLogLines] = useState<string[]>([])
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const derived = buildDerived({ index, tags })

  const log = useCallback((msg: string) => {
    setLogLines((prev) => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  const loadAll = useCallback(async () => {
    const handle = await repo.tryRestoreRoot()
    if (handle) {
      setFs({ rootHandle: handle, rootName: handle.name })
      try {
        const { index: loadedIndex, tags: loadedTags } = await repo.loadAll()
        setIndex(normalizeIndex(loadedIndex))
        setTags(normalizeTags(loadedTags))
      } catch (e) {
        log(`加载失败：${String(e)}`)
      }
    }
  }, [repo, log])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const persistSoon = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(async () => {
      if (!fs.rootHandle) return
      try {
        await repo.saveIndex(index)
        await repo.saveTags(tags)
      } catch (e) {
        log(`保存失败：${String(e)}`)
      }
      persistTimer.current = null
    }, 250)
  }, [fs.rootHandle, index, tags, repo, log])

  const pickRoot = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      log('当前浏览器不支持 File System Access API。请使用 Chrome/Edge。')
      return
    }
    try {
      const handle = await repo.pickRoot()
      setFs({ rootHandle: handle, rootName: handle.name })
      await repo.ensureDirs()
      await migrateToDataDir()
      const { index: loadedIndex, tags: loadedTags } = await repo.loadAll()
      setIndex(normalizeIndex(loadedIndex))
      setTags(normalizeTags(loadedTags))
      log('已选择数据目录')
    } catch (e) {
      log(`选择目录失败：${String(e)}`)
    }
  }, [repo, log])

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
        filters: { formats: [], sizes: [], orient: [], tags: [] },
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

  const importFiles = useCallback(
    async (files: File[]) => {
      if (!fs.rootHandle || !files.length) return
      await repo.ensureDirs()

      const byHash = new Map(
        index.images
          .map((x: PhotoImage) => [x.hash, x] as const)
          .filter(([, x]) => x != null)
      )

      for (const file of files) {
        try {
          const hash = await repo.hashFile(file)
          if (hash && byHash.has(hash)) {
            log(`跳过重复：${file.name}`)
            continue
          }

          const ext = extOf(file.name)
          const createdAt = file.lastModified ?? Date.now()
          const date = new Date(createdAt)
          const yyyy = String(date.getFullYear())
          const mm = String(date.getMonth() + 1).padStart(2, '0')
          const dd = String(date.getDate()).padStart(2, '0')
          const baseName = (file.name.replace(/\.[^.]+$/, '') || 'img')
            .replace(/[\\/:*?"<>|]+/g, '_')
            .slice(0, 80) || 'img'
          const id = nanoid()
          const fileName = `${baseName}__${id}.${ext || 'bin'}`
          const libraryRelPath = `library/${yyyy}/${mm}/${dd}/${fileName}`

          await repo.copyIntoLibrary(file, libraryRelPath)

          const thumbRel = `thumbs/${hash || id}.webp`
          const thumbBlob = await createThumbnailWebp(file, 300)
          await repo.writeBlob(thumbRel, thumbBlob)

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
            libraryRelPath,
            thumbRelPath: thumbRel,
            hash,
            autoTags: computeAutoTags({
              ext,
              sizeBytes: file.size,
              width: dims.width,
              height: dims.height,
              createdAt,
            }),
            userTags: [],
          }
          byHash.set(hash, img)
          setIndex((prev) => ({ ...prev, images: [...prev.images, img] }))
          log(`已导入：${file.name}`)
        } catch (e) {
          log(`导入失败 ${file.name}：${String(e)}`)
        }
      }

      persistSoon()
    },
    [fs.rootHandle, index.images, repo, log, persistSoon]
  )

  return {
    fs,
    index,
    tags,
    derived,
    logLines,
    repo,
    loadAll,
    pickRoot,
    setUi,
    setFilters,
    clearFilters,
    setSortRules,
    addUserTag,
    removeUserTag,
    getTagSuggestions,
    importFiles,
    isSupported: isFileSystemAccessSupported(),
  }
}

async function getImageDims(file: File): Promise<{ width: number; height: number }> {
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
