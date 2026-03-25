import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          // 仅固定拆分 React 与 dayjs；antd 随路由懒加载由 Rollup 自动拆到各 async chunk，避免单文件 >1MB 与循环 chunk
          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('/node_modules/react/') ||
            id.includes('\\node_modules\\react\\') ||
            id.includes('/scheduler/') ||
            id.includes('\\scheduler\\')
          ) {
            return 'react-vendor'
          }
          if (id.includes('dayjs')) {
            return 'dayjs'
          }

          return undefined
        },
      },
    },
  },
})
