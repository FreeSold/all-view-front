import { App as AntApp, Spin } from 'antd'
import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { AdminLayout } from './layout/AdminLayout'
import { AppShellProvider } from './context/AppShellContext'
import { GlobalLogProvider } from './context/GlobalLogContext'
import { PhotoFolderProvider } from './context/PhotoFolderContext'
import { PhotoStateProvider } from './context/PhotoStateContext'
import { ThemeProvider } from './theme/ThemeContext'

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AccountManagementPage = lazy(() =>
  import('./pages/AccountManagementPage').then((m) => ({ default: m.AccountManagementPage })),
)
const SystemConfigPage = lazy(() => import('./pages/SystemConfigPage').then((m) => ({ default: m.SystemConfigPage })))
const VideoManagementPage = lazy(() =>
  import('./pages/VideoManagementPage').then((m) => ({ default: m.VideoManagementPage })),
)
const ComicManagementPage = lazy(() =>
  import('./pages/ComicManagementPage').then((m) => ({ default: m.ComicManagementPage })),
)
const PhotoManagementPage = lazy(() => import('./pages/PhotoManagementPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

function RouteFallback() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '45vh',
      }}
    >
      <Spin size="large" />
    </div>
  )
}

/**
 * Electron 打包后通过 file:// 打开页面时，pathname 是磁盘路径而非 /app/...，
 * BrowserRouter 无法匹配路由会落到 404。file: 协议下改用 HashRouter（#/app/...）。
 */
function AppHistoryRouter({ children }: { children: ReactNode }) {
  const useHash =
    typeof window !== 'undefined' && window.location.protocol === 'file:'
  if (useHash) {
    return <HashRouter>{children}</HashRouter>
  }
  return <BrowserRouter>{children}</BrowserRouter>
}

export default function App() {
  return (
    <ThemeProvider>
      <AntApp>
        <AuthProvider>
          <AppHistoryRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/app" replace />} />
                <Route path="/login" element={<LoginPage />} />

                <Route
                  path="/app"
                  element={
                    <RequireAuth>
                      <GlobalLogProvider>
                        <PhotoStateProvider>
                          <PhotoFolderProvider>
                            <AppShellProvider>
                              <AdminLayout />
                            </AppShellProvider>
                          </PhotoFolderProvider>
                        </PhotoStateProvider>
                      </GlobalLogProvider>
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
            </Suspense>
          </AppHistoryRouter>
        </AuthProvider>
      </AntApp>
    </ThemeProvider>
  )
}
