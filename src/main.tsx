import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import 'react-resizable/css/styles.css'
import './index.css'
import { loadAppData } from './storage/appStore'
import App from './App.tsx'

async function init() {
  await loadAppData()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

init()
