import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import 'react-resizable/css/styles.css'
import './index.css'
import { loadAppData, trySyncAppDataFromPersistedRootOnElectronStartup } from './storage/appStore'
import App from './App.tsx'

async function init() {
  await loadAppData()
  await trySyncAppDataFromPersistedRootOnElectronStartup()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

init()
