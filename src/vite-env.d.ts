/// <reference types="vite/client" />

/** File System Access API - Chrome/Edge */
interface FileSystemFileHandle {
  readonly kind: 'file'
  readonly name: string
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  getFile(): Promise<File>
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string | WriteParams): Promise<void>
  seek(position: number): Promise<void>
  truncate(size: number): Promise<void>
}

interface WriteParams {
  type: 'write' | 'seek' | 'truncate'
  size?: number
  position?: number
  data?: BufferSource | Blob | string
}

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string | string[]>
}

interface FilePickerOptions {
  types?: FilePickerAcceptType[]
  excludeAcceptAllOption?: boolean
  multiple?: boolean
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
}

interface FileSystemDirectoryHandle {
  readonly kind: 'directory'
  readonly name: string
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileSystemFileHandle>
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
  queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface Window {
  showOpenFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>
  showDirectoryPicker?(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
  /** Electron preload 注入 */
  electronAPI?: {
    selectVideoPlayer: () => Promise<string | null>
    selectVideoFile: () => Promise<string | null>
    selectImageFile: () => Promise<string | null>
    playVideo: (playerPath: string, videoPath: string) => Promise<void>
    storageRead: () => Promise<string | null>
    storageWrite: (data: string) => Promise<void>
    storageDelete: () => Promise<void>
  }
}
