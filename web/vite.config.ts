import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // PWA: el service worker precachea TODO (código, fuente, datos) para funcionar sin internet
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['iconos/*.png', 'logo-proliferante.svg'],
      manifest: {
        name: 'Matrícula+ · Asignación inteligente de cupos',
        short_name: 'Matrícula+',
        description: 'Simulación de asignación de cupos escolares oficiales en Bogotá — Proliferante',
        lang: 'es-CO',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0f17',
        theme_color: '#0b0f17',
        icons: [
          { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json,geojson}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // Rutas relativas: el build funciona servido desde cualquier carpeta
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
})
