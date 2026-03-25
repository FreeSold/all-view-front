/**
 * 浏览器模式下本地视频文件的存储
 * 使用 File System Access API 存储文件句柄（轻量引用），不存储视频内容
 * 需 Chrome / Edge 等支持该 API 的浏览器
 */

const DB_NAME = 'all-view-local-files'
const STORE_NAME = 'video-handles'

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/** 打开文件选择器，返回 FileSystemFileHandle（轻量引用） */
export async function showVideoFilePicker(): Promise<FileSystemFileHandle | null> {
  const picker = window.showOpenFilePicker
  if (!picker) return null
  try {
    const handles = await picker.call(window, {
      types: [
        {
          description: '视频文件',
          accept: {
            'video/*': ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'],
          },
        },
      ],
      multiple: false,
    })
    return handles[0] ?? null
  } catch {
    return null
  }
}

/** 存储文件句柄（仅引用，不存视频内容），返回用于 VideoSource.url 的标识 */
export async function saveLocalVideoHandle(
  sourceId: string,
  handle: FileSystemFileHandle,
): Promise<string> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(handle, sourceId)
    req.onsuccess = () => {
      db.close()
      resolve(`local-handle:${sourceId}`)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** 根据 local-handle:sourceId 读取原始 File（用于图片导出等） */
export async function getFileFromLocalHandleRef(ref: string): Promise<File | null> {
  const prefix = 'local-handle:'
  if (!ref.startsWith(prefix)) return null
  const sourceId = ref.slice(prefix.length)
  if (!sourceId) return null

  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(sourceId)
    req.onsuccess = async () => {
      db.close()
      const stored = req.result
      const handle = stored as FileSystemFileHandle | undefined
      if (handle && typeof handle.getFile === 'function') {
        try {
          const opts = { mode: 'read' as const }
          if (handle.requestPermission) {
            const perm = await handle.requestPermission(opts)
            if (perm !== 'granted') {
              resolve(null)
              return
            }
          }
          const file = await handle.getFile()
          resolve(file)
        } catch {
          resolve(null)
        }
      } else {
        resolve(null)
      }
    }
    req.onerror = () => {
      db.close()
      resolve(null)
    }
  })
}

/** 根据 local-handle:sourceId 解析为可播放的 blob URL（按需读取文件） */
export async function resolveLocalHandleUrl(url: string): Promise<string | null> {
  const prefix = 'local-handle:'
  if (!url.startsWith(prefix)) return null
  const sourceId = url.slice(prefix.length)
  if (!sourceId) return null

  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(sourceId)
    req.onsuccess = async () => {
      db.close()
      const stored = req.result
      const handle = stored as FileSystemFileHandle | undefined
      if (handle && typeof handle.getFile === 'function') {
        try {
          const opts = { mode: 'read' as const }
          if (handle.requestPermission) {
            const perm = await handle.requestPermission(opts)
            if (perm !== 'granted') {
              resolve(null)
              return
            }
          }
          const file = await handle.getFile()
          resolve(URL.createObjectURL(file))
        } catch {
          resolve(null)
        }
      } else {
        resolve(null)
      }
    }
    req.onerror = () => {
      db.close()
      resolve(null)
    }
  })
}

/** 清空所有已保存的本地视频文件句柄（清除应用数据时调用） */
export async function clearAllLocalVideoHandles(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** 删除已存储的句柄（当 source 被移除时调用） */
export async function removeLocalVideoHandle(sourceId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(sourceId)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}
