import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Dos builds:
//  - normal (`npm run build`): PWA con service worker, para servir en http y funcionar offline
//  - archivo (`npm run build:archivo`): UN solo HTML con código, fuentes y datos adentro,
//    para abrir con doble clic (file://), donde Chrome no permite cargar módulos ni JSON aparte
export default defineConfig(({ mode }) => {
  const archivo = mode === 'archivo'
  return {
    plugins: [
      react(),
      archivo
        ? viteSingleFile({ removeViteModuleLoader: true })
        // PWA: el service worker precachea TODO (código, fuente, datos) para funcionar sin internet
        : VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          includeAssets: ['iconos/*.png', 'logo-proliferante.svg'],
          manifest: {
            name: 'Matrícula+ · ¿Dónde cabe cada niño?',
            short_name: 'Matrícula+',
            description: 'Simulación de asignación de cupos escolares oficiales en Bogotá — Proliferante',
            lang: 'es-CO',
            start_url: './',
            scope: './',
            display: 'standalone',
            orientation: 'portrait',
            background_color: '#f6f4ee',
            theme_color: '#14213d',
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
            // La vista previa de desarrollo no debe caer en la app
            navigateFallbackDenylist: [/_previa-stand/],
            cleanupOutdatedCaches: true,
          },
        }),
    ],
    // En el build "archivo" los datos van incrustados (ver datos.ts)
    define: { __EMBEBIDO__: JSON.stringify(archivo) },
    // Rutas relativas: el build funciona servido desde cualquier carpeta
    base: './',
    build: archivo
      ? { outDir: 'dist-archivo', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 6000, copyPublicDir: false }
      : { chunkSizeWarningLimit: 2000 },
  }
})
