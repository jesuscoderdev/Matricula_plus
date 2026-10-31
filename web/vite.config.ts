import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'node:fs'
import { compactar } from './src/movilidad/compactar'

// Las mismas cabeceras de seguridad de producción (vercel.json) en `npm run preview`, para probarlas en local.
// Sin HSTS ni upgrade-insecure-requests: la vista previa va por http (también desde el celular en la red local).
const cabecerasSeguridad: Record<string, string> = Object.fromEntries(
  JSON.parse(fs.readFileSync('vercel.json', 'utf-8')).headers[0].headers
    .filter((h: { key: string }) => h.key !== 'Strict-Transport-Security')
    .map((h: { key: string; value: string }) => [h.key, h.value.replace(/;\s*upgrade-insecure-requests/, '')]))

/**
 * En el HTML de doble clic no hay carpeta pública: el favicon y la fuente del logo van incrustados,
 * y se quitan el ícono de Apple y la precarga de la fuente.
 */
const iconosIncrustados = () => ({
  name: 'iconos-incrustados',
  transformIndexHtml(html: string) {
    const png = fs.readFileSync('public/iconos/favicon.png').toString('base64')
    return html
      .replace('href="./iconos/favicon.png"', `href="data:image/png;base64,${png}"`)
      .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
      .replace(/\s*<link rel="preload"[^>]*as="font"[^>]*>/, '')
  },
  // Las url() del <style> de index.html Vite las resuelve al final, así que la fuente se incrusta
  // sobre el archivo ya escrito
  writeBundle({ dir }: { dir?: string }) {
    const ruta = `${dir}/index.html`
    const html = fs.readFileSync(ruta, 'utf-8').replace(/url\(['"]?[^'")]*fuentes\/([\w-]+\.woff2)['"]?\)/g, (_, f: string) =>
      `url('data:font/woff2;base64,${fs.readFileSync(`public/fuentes/${f}`).toString('base64')}')`)
    fs.writeFileSync(ruta, html)
  },
})

/**
 * Movilidad+: sitios.geojson pesa ~9 MB. El build normal genera al lado un derivado compacto
 * (movilidad/datos/sitios.compacto.json, centros + una sola forma de hexágono) que es el que se
 * descarga y se precachea; el build "archivo" lo incrusta en el HTML junto con los JSON.
 * Nada se escribe a mano: todo sale de los archivos de public/movilidad/datos.
 */
const DIR_MOVILIDAD = 'public/movilidad/datos/'
const leerMovilidad = (f: string) => JSON.parse(fs.readFileSync(DIR_MOVILIDAD + f, 'utf-8'))
const sitiosCompactos = () => compactar(leerMovilidad('sitios.geojson'), leerMovilidad('experiencia.json').version_modelo)
const movilidad = (archivo: boolean) => ({
  name: 'movilidad-datos',
  resolveId: (id: string) => (id === 'virtual:movilidad-embebido' ? '\0movilidad-embebido' : null),
  load(id: string) {
    if (id !== '\0movilidad-embebido') return null
    if (!archivo) return 'export default null'
    const d = [leerMovilidad('experiencia.json'), leerMovilidad('fuentes.json'), leerMovilidad('resumen.json'), sitiosCompactos(),
      fs.existsSync(DIR_MOVILIDAD + 'localidades.geojson') ? leerMovilidad('localidades.geojson') : null]
    return `export default JSON.parse(${JSON.stringify(JSON.stringify(d))})`
  },
  generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
    if (archivo) return
    this.emitFile({ type: 'asset', fileName: 'movilidad/datos/sitios.compacto.json', source: JSON.stringify(sitiosCompactos()) })
  },
})

// Dos builds:
//  - normal (`npm run build`): PWA con service worker, para servir en http y funcionar offline
//  - archivo (`npm run build:archivo`): UN solo HTML con código, fuentes y datos adentro,
//    para abrir con doble clic (file://), donde Chrome no permite cargar módulos ni JSON aparte
export default defineConfig(({ mode }) => {
  const archivo = mode === 'archivo'
  return {
    plugins: [
      react(),
      movilidad(archivo),
      archivo
        ? [viteSingleFile({ removeViteModuleLoader: true }), iconosIncrustados()]
        // PWA: el service worker precachea TODO (código, fuente, datos) para funcionar sin internet
        : VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          includeAssets: ['iconos/*.png'],
          manifest: {
            name: 'Proliferante · Matrícula+ y Movilidad+',
            short_name: 'Proliferante',
            description: 'Demostraciones con datos abiertos de Bogotá: cupos escolares (Matrícula+) y seguridad vial en calles de barrio (Movilidad+) — Proliferante',
            lang: 'es-CO',
            start_url: './',
            scope: './',
            display: 'standalone',
            orientation: 'portrait',
            background_color: '#ffffff',
            theme_color: '#162b2a',
            icons: [
              { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,woff2,png,svg,webp,json,geojson,mp3}'],
            // El geojson original de movilidad no se precachea: la app usa el derivado compacto
            globIgnores: ['movilidad/datos/sitios.geojson'],
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
    preview: { headers: cabecerasSeguridad },
    // Rutas relativas: el build funciona servido desde cualquier carpeta
    base: './',
    build: archivo
      ? { outDir: 'dist-archivo', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 6000, copyPublicDir: false }
      : { chunkSizeWarningLimit: 2000 },
  }
})
