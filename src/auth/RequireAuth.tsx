import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
