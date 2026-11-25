import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const GAS_DEPLOY_ID =
  'AKfycbzDgh4ktlDeGvf8RudOBtroV2QxvP8f0HoLn2xLN9nweESntGMSYfM836LEADbop60KJg'

const base = process.env.VITE_BASE || '/School-APP/'

export default defineConfig({
  // GitHub Pages：/School-APP/ ；Android APK：/
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: 'school-app-contact-book',
        name: '家庭聯絡簿',
        short_name: '聯絡簿',
        description: '班級家庭聯絡簿 — 今日放學公佈欄、換天、每日 Gmail',
        lang: 'zh-Hant',
        dir: 'ltr',
        theme_color: '#0f6b4c',
        background_color: '#f3f6f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname === 'script.google.com' ||
              url.hostname.endsWith('googleusercontent.com'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/gas': {
        target: 'https://script.google.com',
        changeOrigin: true,
        secure: true,
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
