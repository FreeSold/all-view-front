import { createContext, useCallback, useContext, useState } from 'react'
import type { FolderTreeNode } from '../storage/photoTypes'

type PhotoFolderContextValue = {
  folderTree: FolderTreeNode | null
  activeFolderId: string
  setFolderTree: (tree: FolderTreeNode | null) => void
  setActiveFolderId: (id: string) => void
}

const PhotoFolderContext = createContext<PhotoFolderContextValue | null>(null)

export function PhotoFolderProvider({ children }: { children: React.ReactNode }) {
  const [folderTree, setFolderTreeState] = useState<FolderTreeNode | null>(null)
  const [activeFolderId, setActiveFolderIdState] = useState<string>('all')

  const setFolderTree = useCallback((tree: FolderTreeNode | null) => {
    setFolderTreeState(tree)
  }, [])

  const setActiveFolderId = useCallback((id: string) => {
    setActiveFolderIdState(id)
  }, [])

  const value: PhotoFolderContextValue = {
    folderTree,
    activeFolderId,
    setFolderTree,
    setActiveFolderId,
  }

  return (
    <PhotoFolderContext.Provider value={value}>{children}</PhotoFolderContext.Provider>
  )
}

export function usePhotoFolder() {
  const ctx = useContext(PhotoFolderContext)
  return ctx
}
