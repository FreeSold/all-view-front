import { createContext, useContext } from 'react'
import { usePhotoState } from '../pages/PhotoManagement/usePhotoState'

export type PhotoStateValue = ReturnType<typeof usePhotoState>

const PhotoStateContext = createContext<PhotoStateValue | null>(null)

export function PhotoStateProvider({ children }: { children: React.ReactNode }) {
  const value = usePhotoState()
  return (
    <PhotoStateContext.Provider value={value}>{children}</PhotoStateContext.Provider>
  )
}

export function usePhotoStateContext() {
  const ctx = useContext(PhotoStateContext)
  if (!ctx) throw new Error('usePhotoStateContext must be used within PhotoStateProvider')
  return ctx
}
