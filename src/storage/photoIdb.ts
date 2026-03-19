/**
 * IndexedDB for PhotoManager root handle persistence
 */

const DB_NAME = 'PhotoManagerDB'
const STORE = 'kv'
const VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const req = store.get(key)
      req.onsuccess = () => resolve((req.result ?? null) as T | null)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const req = store.put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}
