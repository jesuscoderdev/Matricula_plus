/**
 * Videos de Proli para editar (igual que el paquete del logo animado): por cada animación, una
 * carpeta con
 *   - secuencia-png/      cuadros PNG con transparencia (1920 × 1080, 30 fps)
 *   - _transparente.mov   ProRes 4444 con alfa (Premiere, Final Cut, DaVinci, After Effects)
 *   - _transparente.webm  VP9 con alfa (web, CapCut, navegadores)
 *   - _fondo-blanco.mp4   H.264 sobre blanco (WhatsApp, redes, presentaciones)
 * y en capas/ las capas de Proli en alta y una pose quieta de cada animación.
 *
 * Proli sale de capas a 4× (proli-videos/*@4x.png, recortadas del original) con la misma geometría
 * y animaciones de la app. Cada video son bucles enteros: se puede repetir sin que se note el corte.
 *
 * Uso:  npm i --no-save @napi-rs/canvas   (una vez; además hace falta ffmpeg)
 *       npm run proli:videos [-- saludando hablando ...] [-- --salida <carpeta>]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ANIMACIONES, dibujarProli, ANCHO, ALTO } from './proli-videos/animaciones.ts'

const { createCanvas, loadImage } = await import('@napi-rs/canvas').catch(() => {
  console.error('Falta @napi-rs/canvas: npm i --no-save @napi-rs/canvas')
  process.exit(1)
})

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const iSalida = args.indexOf('--salida')
const SALIDA = path.resolve(iSalida >= 0 ? args[iSalida + 1] : path.join(AQUI, '..', '..', '..', 'Proli animado'))
const pedidas = args.filter((a, i) => !a.startsWith('--') && (iSalida < 0 || i !== iSalida + 1))
const W = 1920, H = 1080, FPS = 30
const ALTO_PROLI = 900   // Proli centrado, con aire arriba para el brazo cuando saluda

const capas = {
  cuerpo: await loadImage(path.join(AQUI, 'proli-videos', 'proli-cuerpo@4x.png')),
  brazo: await loadImage(path.join(AQUI, 'proli-videos', 'proli-brazo@4x.png')),
}
const ffmpeg = (...a: string[]) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a], { stdio: 'inherit' })

const elegidas = pedidas.length ? ANIMACIONES.filter((a) => pedidas.includes(a.id)) : ANIMACIONES
if (!elegidas.length) { console.error(`No conozco esas animaciones. Hay: ${ANIMACIONES.map((a) => a.id).join(', ')}`); process.exit(1) }

const dirCapas = path.join(SALIDA, 'capas')
fs.mkdirSync(dirCapas, { recursive: true })
fs.copyFileSync(path.join(AQUI, 'proli-videos', 'proli-cuerpo@4x.png'), path.join(dirCapas, 'proli-cuerpo-sin-cara.png'))
fs.copyFileSync(path.join(AQUI, 'proli-videos', 'proli-brazo@4x.png'), path.join(dirCapas, 'proli-brazo.png'))

for (const a of elegidas) {
  const nombre = `proli-${a.id}`
  const dir = path.join(SALIDA, nombre)
  const dirPng = path.join(dir, 'secuencia-png')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dirPng, { recursive: true })

  const cuadros = Math.round(a.bucle * a.vueltas * FPS)
  const lienzo = createCanvas(W, H)
  const ctx = lienzo.getContext('2d')
  const anchoProli = (ALTO_PROLI * ANCHO) / ALTO
  for (let f = 0; f < cuadros; f++) {
    ctx.clearRect(0, 0, W, H)
    dibujarProli(ctx, capas, a.pose((f / FPS) % a.bucle), (W - anchoProli) / 2, (H - ALTO_PROLI) / 2, ALTO_PROLI)
    fs.writeFileSync(path.join(dirPng, `f${String(f).padStart(4, '0')}.png`), await lienzo.encode('png'))
  }

  const entrada = ['-framerate', String(FPS), '-i', path.join(dirPng, 'f%04d.png')]
  ffmpeg(...entrada, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16',
    path.join(dir, `${nombre}_transparente.mov`))
  ffmpeg(...entrada, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '28', '-row-mt', '1',
    path.join(dir, `${nombre}_transparente.webm`))
  ffmpeg(...entrada, '-filter_complex', `color=white:s=${W}x${H}:r=${FPS}[f];[f][0]overlay=shortest=1,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', path.join(dir, `${nombre}_fondo-blanco.mp4`))

  // Pose quieta en alta (para miniaturas y piezas gráficas): el momento más expresivo de la animación
  const t = { saludando: 0.37, 'saluda-y-habla': 0.37, hablando: 0.2, reposo: 0, atento: 0 }[a.id] ?? 0
  const alta = createCanvas(Math.round((1884 * ANCHO) / ALTO), 1884)
  dibujarProli(alta.getContext('2d'), capas, a.pose(t), 0, 0, 1884)
  fs.writeFileSync(path.join(dirCapas, `${nombre}.png`), await alta.encode('png'))

  console.log(`${nombre}: ${cuadros} cuadros (${(cuadros / FPS).toFixed(1)} s) — ${a.descripcion}`)
}
console.log(`Listo en ${SALIDA}`)
