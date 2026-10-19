import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// KasirQuh React — build target: static SPA, deploy di Vercel.
// Vercel otomatis mendeteksi preset "Vite": build `npm run build`, output `dist/`.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker kustom (src/sw.ts): workbox precaching + FCM background.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Warunge Mimi',
        short_name: 'Warunge Mimi',
        description:
          'Belanja kebutuhan harian di Warunge Mimi — katalog, keranjang, dan pesanan online.',
        theme_color: '#f49a24',
        background_color: '#f7f4f1',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'id',
        scope: './',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Jangan cache Firestore/Auth — data selalu live.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      },
    }),
  ],
})
