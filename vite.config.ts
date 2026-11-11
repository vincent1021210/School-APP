import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const GAS_DEPLOY_ID =
  'AKfycbzDgh4ktlDeGvf8RudOBtroV2QxvP8f0HoLn2xLN9nweESntGMSYfM836LEADbop60KJg'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/gas': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => `/macros/s/${GAS_DEPLOY_ID}/exec`,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*')
          })
        },
      },
    },
  },
})
