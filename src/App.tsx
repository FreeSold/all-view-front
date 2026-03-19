import { App as AntApp } from 'antd'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { AdminLayout } from './layout/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AccountManagementPage } from './pages/AccountManagementPage'
import { SystemConfigPage } from './pages/SystemConfigPage'
import { VideoManagementPage } from './pages/VideoManagementPage'
import { ComicManagementPage } from './pages/ComicManagementPage'
import PhotoManagementPage from './pages/PhotoManagementPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PhotoFolderProvider } from './context/PhotoFolderContext'
import { PhotoStateProvider } from './context/PhotoStateContext'
import { ThemeProvider } from './theme/ThemeContext'

export default function App() {
  return (
    <ThemeProvider>
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/app"
              element={
                <RequireAuth>
                  <PhotoStateProvider>
                    <PhotoFolderProvider>
                      <AdminLayout />
                    </PhotoFolderProvider>
                  </PhotoStateProvider>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="accounts" element={<AccountManagementPage />} />
              <Route path="system-config" element={<SystemConfigPage />} />
              <Route path="videos" element={<VideoManagementPage />} />
              <Route path="comics" element={<ComicManagementPage />} />
              <Route path="photos" element={<PhotoManagementPage />} />
            </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ThemeProvider>
  )
}
