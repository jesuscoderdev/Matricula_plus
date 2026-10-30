/**
 * Marca de agua viva (fondo del cuadrante derecho, en horizontal): varios logos de Proliferante (la «o»)
 * (el ícono en alta resolución) en transparencia. Cada tanto, uno suelta puntos que viajan en curva hasta un lugar libre y se
 * acomodan, uno por uno, sobre la silueta exacta de la «o» (sacada de la imagen del logo); cuando el
 * dibujo está completo, el logo aparece encima y los puntos se apagan. Los logos más viejos se van
 * desvaneciendo, así nunca se llena. Es un canvas: no tapa clics ni se ve en lectores de pantalla.
 * Con «reducir movimiento», solo los logos quietos.
 */
import { useEffect, useRef } from 'react'
// El ícono de Proliferante en alta resolución (640 × 640), el mismo de la marca de agua de «Conoce a Proli»
import iconoProliferante from '../assets/icono-proliferante.webp'

const ALFA_LOGO = 0.13          // transparencia de la marca de agua
const MAX_LOGOS = 6
const CADA_MS = 2600            // cada cuánto un logo suelta puntos
const VUELO_MS = 2300           // lo que tardan los puntos en llegar a su lugar en la silueta
const APARECE_MS = 700          // lo que tarda el logo en aparecer sobre los puntos
const APAGA_MS = 1600           // lo que tarda en desvanecerse un logo viejo
const COLORES = ['#7bc689', '#5a44dd', '#3e8e52', '#8c7cee']
const TINTE = '#7bc689'          // color de los logos (el verde de la «o»)

interface Logo { x: number; y: number; t: number; nace: number; muere: number | null }
interface Punto { x0: number; y0: number; cx: number; cy: number; dx: number; dy: number; color: string; demora: number }
interface Vuelo { inicio: number; destino: Logo; puntos: Punto[] }

const suave = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)

/** La silueta de la «o»: recorta la imagen a su contenido y la recorre en una malla de ~18 × 18, con un punto por cada celda opaca */
function silueta(img: HTMLImageElement) {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth; c.height = img.naturalHeight
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height)
  let x0 = width, y0 = height, x1 = 0, y1 = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 40) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, lado = Math.max(w, h)
  const paso = Math.max(1, lado / 18)
  const puntos: [number, number][] = []
  for (let yy = y0; yy <= y1; yy += paso) for (let xx = x0; xx <= x1; xx += paso) {
    const x = Math.round(xx), y = Math.round(yy)
    if (data[(y * width + x) * 4 + 3] <= 120) continue
    puntos.push([(x - x0 - w / 2) / lado, (y - y0 - h / 2) / lado])   // centrado, en unidades del tamaño del logo
  }
  return { puntos, recorte: [x0, y0, w, h] as const, proporcion: w / lado, alto: h / lado }
}

export default function MarcaDeAguaViva() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let ancho = 0, alto = 0, raf = 0, ultimo = 0
    let forma: ReturnType<typeof silueta> | null = null
    let sprite: HTMLCanvasElement | null = null   // el logo recortado y teñido, listo para dibujar sin pixelarse
    const img = new Image()
    const logos: Logo[] = []
    const vuelos: Vuelo[] = []

    const medir = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1)
      ancho = r.width; alto = r.height
      canvas.width = Math.round(ancho * dpr); canvas.height = Math.round(alto * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const tamano = () => Math.max(46, Math.min(ancho, alto) * (0.13 + Math.random() * 0.08))
    /** Un lugar libre: lejos de los otros logos y de los bordes */
    const lugarLibre = (t: number): Logo => {
      let mejor: Logo = { x: ancho / 2, y: alto / 2, t, nace: 0, muere: null }, distMejor = -1
      for (let k = 0; k < 24; k++) {
        const x = t * 0.7 + Math.random() * (ancho - t * 1.4), y = t * 0.7 + Math.random() * (alto - t * 1.4)
        const d = Math.min(...logos.filter((l) => l.muere == null).map((l) => Math.hypot(l.x - x, l.y - y)), 9e9)
        if (d > distMejor) { distMejor = d; mejor = { x, y, t, nace: 0, muere: null } }
      }
      return mejor
    }
    const soltar = (ahora: number) => {
      if (!forma) return
      const vivos = logos.filter((l) => l.muere == null && ahora - l.nace > APARECE_MS)
      if (!vivos.length) return
      const origen = vivos[Math.floor(Math.random() * vivos.length)]
      const destino = lugarLibre(tamano())
      // Cada punto de la silueta sale del logo de origen y viaja en curva a su lugar en el nuevo logo
      const puntos = forma.puntos.map(([px, py], k): Punto => {
        const a = Math.random() * Math.PI * 2, r = origen.t * 0.35 * Math.random()
        const x0 = origen.x + Math.cos(a) * r, y0 = origen.y + Math.sin(a) * r
        const dx = destino.x + px * destino.t, dy = destino.y + py * destino.t
        const mx = (x0 + dx) / 2, my = (y0 + dy) / 2, nx = -(dy - y0), ny = dx - x0, curva = (Math.random() - 0.5) * 0.9
        return { x0, y0, dx, dy, cx: mx + nx * curva, cy: my + ny * curva, color: COLORES[k % COLORES.length], demora: Math.random() * 500 }
      })
      vuelos.push({ inicio: ahora, destino, puntos })
      // Si ya hay muchos, el más viejo empieza a apagarse
      const vivosTodos = logos.filter((l) => l.muere == null)
      if (vivosTodos.length + vuelos.length > MAX_LOGOS) vivosTodos.sort((a, b) => a.nace - b.nace)[0].muere = ahora
    }

    const dibujarLogo = (l: Logo, alfa: number) => {
      if (!forma || !sprite || alfa <= 0) return
      const w = forma.proporcion * l.t, h = forma.alto * l.t
      ctx.globalAlpha = alfa
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(sprite, l.x - w / 2, l.y - h / 2, w, h)
    }
    const cuadro = (ahora: number) => {
      raf = requestAnimationFrame(cuadro)
      if (ahora - ultimo < 30) return   // ~30 cuadros por segundo es suficiente para un fondo
      ultimo = ahora
      ctx.clearRect(0, 0, ancho, alto)
      // Logos (los que se apagan, con su desvanecimiento)
      for (let i = logos.length - 1; i >= 0; i--) {
        const l = logos[i]
        const entra = Math.min(1, (ahora - l.nace) / APARECE_MS)
        const sale = l.muere == null ? 1 : 1 - (ahora - l.muere) / APAGA_MS
        if (sale <= 0) { logos.splice(i, 1); continue }
        dibujarLogo(l, ALFA_LOGO * entra * sale)
      }
      // Puntos en vuelo y armado del logo nuevo
      for (let i = vuelos.length - 1; i >= 0; i--) {
        const v = vuelos[i]
        const total = ahora - v.inicio
        const armado = (total - VUELO_MS - 500) / APARECE_MS        // 0 → 1 mientras aparece el logo
        if (armado >= 1) { vuelos.splice(i, 1); continue }
        if (armado >= 0 && v.destino.nace === 0) { v.destino.nace = ahora; logos.push(v.destino) }
        const r = Math.max(0.55, v.destino.t / 120)
        for (const p of v.puntos) {
          const u = suave(Math.max(0, Math.min(1, (total - p.demora) / VUELO_MS)))
          const x = (1 - u) * (1 - u) * p.x0 + 2 * (1 - u) * u * p.cx + u * u * p.dx
          const y = (1 - u) * (1 - u) * p.y0 + 2 * (1 - u) * u * p.cy + u * u * p.dy
          // Discretos en el viaje (que no distraigan); al llegar, algo más marcados sobre la silueta; luego se apagan bajo el logo
          ctx.globalAlpha = (u < 1 ? 0.06 + 0.1 * Math.sin(Math.PI * Math.min(1, u * 1.1)) + 0.14 * u : 0.3) * (armado > 0 ? 1 - armado : 1)
          ctx.fillStyle = p.color
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }

    const ro = new ResizeObserver(medir)
    ro.observe(canvas)
    medir()
    let reloj = 0
    img.onload = () => {
      forma = silueta(img)
      // Recorte teñido a resolución completa: se reduce al dibujarlo, así se ve nítido
      const [sx, sy, sw, sh] = forma.recorte
      sprite = document.createElement('canvas'); sprite.width = sw; sprite.height = sh
      const sg = sprite.getContext('2d')!
      sg.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      sg.globalCompositeOperation = 'source-in'; sg.fillStyle = TINTE; sg.fillRect(0, 0, sw, sh)
      const ahora = performance.now()
      // Para empezar, tres logos ya puestos
      for (let k = 0; k < 3; k++) { const l = lugarLibre(tamano()); l.nace = ahora - APARECE_MS; logos.push(l) }
      if (quieto) { cuadro(ahora); cancelAnimationFrame(raf); return }
      raf = requestAnimationFrame(cuadro)
      soltar(ahora)
      reloj = window.setInterval(() => { if (!document.hidden) soltar(performance.now()) }, CADA_MS)
    }
    img.src = iconoProliferante
    return () => { cancelAnimationFrame(raf); window.clearInterval(reloj); ro.disconnect() }
  }, [])
  return <canvas ref={ref} className="marca-viva" aria-hidden />
}
