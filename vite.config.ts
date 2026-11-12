import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const GAS_DEPLOY_ID =
  'AKfycbzDgh4ktlDeGvf8RudOBtroV2QxvP8f0HoLn2xLN9nweESntGMSYfM836LEADbop60KJg'

export default defineConfig({
  // GitHub Pages 專案站：https://vincent1021210.github.io/School-APP/
  base: '/School-APP/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/gas': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
        // 保留 ?action=... 查詢字串
        rewrite: (path) => {
          const qIndex = path.indexOf('?')
          const qs = qIndex >= 0 ? path.slice(qIndex) : ''
          return `/macros/s/${GAS_DEPLOY_ID}/exec${qs}`
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*')
          })
        },
      },
    },
  },
})
