import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 開發時避開瀏覽器 CORS：App 打 /api/gas?... → 轉發到 Apps Script
      '/api/gas': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
        rewrite: () =>
          '/macros/s/AKfycbwBE0IVr9JuF92lpHMTUQiTgIpjxBYZWidAXHEfICwumlHggm31kfbD3Y3_mlznVuES/exec',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*')
          })
        },
      },
    },
  },
})
