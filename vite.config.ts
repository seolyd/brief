import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Daily Brief',
        short_name: 'Brief',
        description: '끝이 있는 뉴스. 아침 10분, 저녁 10분.',
        lang: 'ko',
        theme_color: '#f6f4ef',
        background_color: '#f6f4ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // 데이터는 매일 바뀝니다. 네트워크가 먼저고, 오프라인일 때만 지난 것을 씁니다.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'data' },
          },
        ],
        navigateFallbackDenylist: [/^\/data\//],
      },
    }),
  ],
})
