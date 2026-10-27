import { ANCHO, ALTO, OJOS, BOCA, TINTA, RANGO, BRILLO, SALUDO, SALUDO_S, HABLA, HABLA_S } from '../../src/componentes/proliGeometria.ts'

/**
 * Proli cuadro a cuadro: el mismo Proli de la app (ProliAnimado) dibujado en un canvas. Cada
 * animación es una función del tiempo, así el video sale igual cada vez y el final de un bucle
 * empalma con el principio.
 */

export interface Pose {
  /** giro del brazo, en grados */
  brazo: number
  /** hacia dónde mira, de −1 a 1 */
  mirada: { x: number; y: number }
  /** alto y ancho del ojo (1 = normal; casi 0 = cerrado) */
  ojo: { alto: number; ancho: number }
  /** brillo de los ojos, de 0 a 1 (al sonreír con los ojos se apaga) */
  brillo: number
  atento: boolean
  boca: { tipo: 'linea' } | { tipo: 'sonrisa' } | { tipo: 'abierta'; alto: number; ancho: number }
}

export interface Animacion {
  id: string
  descripcion: string
  /** duración de un bucle, en segundos */
  bucle: number
  /** cuántos bucles lleva el video */
  vueltas: number
  pose: (t: number) => Pose
}

// Igual que el 'easeInOut' de framer-motion: cubic-bezier(0.42, 0, 0.58, 1)
function suave(p: number) {
  if (p <= 0) return 0
  if (p >= 1) return 1
  let a = 0, b = 1, u = p
  for (let i = 0; i < 24; i++) {
    u = (a + b) / 2
    const x = 3 * (1 - u) ** 2 * u * 0.42 + 3 * (1 - u) * u ** 2 * 0.58 + u ** 3
    if (x < p) a = u; else b = u
  }
  return 3 * (1 - u) * u ** 2 + u ** 3
}

/** Valores repartidos parejo en `duracion` segundos, como los keyframes de framer-motion */
function claves(valores: number[], duracion: number, t: number) {
  const tramos = valores.length - 1
  const p = Math.max(0, Math.min(1, t / duracion)) * tramos
  const i = Math.min(tramos - 1, Math.floor(p))
  return valores[i] + (valores[i + 1] - valores[i]) * suave(p - i)
}

/** Parpadeos en los instantes dados: cierra en 60 ms, queda cerrado 110 ms y abre en 60 ms (de 0 a 1) */
function parpadeo(t: number, instantes: number[]) {
  for (const i of instantes) {
    const d = t - i
    if (d >= 0 && d < 0.23) return d < 0.06 ? d / 0.06 : d < 0.17 ? 1 : 1 - (d - 0.17) / 0.06
  }
  return 0
}

/** La mirada pasa de un punto al siguiente con un giro rápido y suave (como el resorte de la app) */
function mirada(t: number, puntos: { t: number; x: number; y: number }[]) {
  let antes = puntos[puntos.length - 1], ahora = puntos[0]
  for (let i = 0; i < puntos.length; i++) if (t >= puntos[i].t) { ahora = puntos[i]; antes = puntos[(i + puntos.length - 1) % puntos.length] }
  const k = suave(Math.min(1, (t - ahora.t) / 0.28))
  return { x: antes.x + (ahora.x - antes.x) * k, y: antes.y + (ahora.y - antes.y) * k }
}

const FRENTE = [{ t: 0, x: 0, y: 0 }]
const quieto = (t: number, parpadeos: number[], puntos = FRENTE): Pose => {
  const p = parpadeo(t, parpadeos)
  return { brazo: 0, mirada: mirada(t, puntos), ojo: { alto: 1 - 0.92 * p, ancho: 1 }, brillo: 0.95 * (1 - p), atento: false, boca: { tipo: 'linea' } }
}
const bocaHablando = (t: number) => {
  const c = t % HABLA_S
  return { tipo: 'abierta' as const, alto: claves(HABLA.alto, HABLA_S, c), ancho: claves(HABLA.ancho, HABLA_S, c) }
}
// Al saludar sonríe con los ojos (más bajitos y sin brillo), como en la app
const saludando = (t: number) => t < SALUDO_S
const ojosFelices = { ojo: { alto: 0.62, ancho: 1 }, brillo: 0 }

export const ANIMACIONES: Animacion[] = [
  {
    id: 'saludando', descripcion: 'Agita la mano y sonríe con los ojos; luego parpadea', bucle: 3.6, vueltas: 2,
    pose: (t) => saludando(t)
      ? { ...quieto(t, []), ...ojosFelices, brazo: claves(SALUDO, SALUDO_S, t), boca: { tipo: 'sonrisa' } }
      : quieto(t, [3.05]),
  },
  {
    id: 'hablando', descripcion: 'Mueve la boca como sílabas, mirando al frente', bucle: 3.6, vueltas: 2,
    pose: (t) => ({ ...quieto(t, [1.55], [{ t: 0, x: 0, y: 0 }, { t: 1.2, x: 0.25, y: -0.1 }, { t: 2.4, x: -0.15, y: 0.05 }]), boca: bocaHablando(t) }),
  },
  {
    id: 'saluda-y-habla', descripcion: 'Como en la app cuando dice algo: saluda mientras habla', bucle: 3.6, vueltas: 2,
    pose: (t) => saludando(t)
      ? { ...quieto(t, []), ...ojosFelices, brazo: claves(SALUDO, SALUDO_S, t), boca: bocaHablando(t) }
      : { ...quieto(t, [3.05]), boca: bocaHablando(t) },
  },
  {
    id: 'reposo', descripcion: 'Mira a su alrededor y parpadea', bucle: 8, vueltas: 1,
    pose: (t) => quieto(t, [1.2, 4.1, 4.38, 6.9], [
      { t: 0, x: 0, y: 0 }, { t: 1.6, x: -0.85, y: -0.2 }, { t: 3.1, x: 0.7, y: 0.35 }, { t: 4.8, x: 0.2, y: -0.8 }, { t: 6.2, x: 0, y: 0 },
    ]),
  },
  {
    id: 'atento', descripcion: 'Ojos grandes y sonrisa: le interesa lo que ve', bucle: 4, vueltas: 2,
    pose: (t) => {
      const p = parpadeo(t, [2.6])
      return { brazo: 0, mirada: mirada(t, [{ t: 0, x: 0, y: 0 }, { t: 1.5, x: 0.3, y: 0.25 }, { t: 3, x: 0, y: 0 }]),
        ojo: { alto: 1.12 - 1.04 * p, ancho: p ? 1 : 1.08 }, brillo: 0.95 * (1 - p), atento: true, boca: { tipo: 'sonrisa' } }
    },
  },
]

/**
 * El brazo de los videos gira desde el eje del brazo, donde calzan la media luna del brazo y el
 * disco del hombro (ver recortar-capas.py). En la app gira desde HOMBRO_PX, porque allí la capa del
 * brazo está cortada de otra forma.
 */
const HOMBRO = { x: 382, y: 279.7 }

/** Lo mínimo que se usa del contexto 2D (sirve el del navegador y el de @napi-rs/canvas) */
type Contexto = Pick<CanvasRenderingContext2D, 'save' | 'restore' | 'translate' | 'scale' | 'rotate' | 'drawImage' | 'beginPath' |
  'ellipse' | 'arc' | 'fill' | 'stroke' | 'moveTo' | 'quadraticCurveTo' | 'closePath' | 'fillStyle' | 'strokeStyle' | 'globalAlpha' | 'lineWidth' | 'lineCap'>

/**
 * Dibuja a Proli de `alto` píxeles con su esquina superior izquierda en (x, y). `cuerpo` y `brazo`
 * son capas en la proporción de la app (480 × 474), de cualquier resolución.
 */
export function dibujarProli(ctx: Contexto, capas: { cuerpo: unknown; brazo: unknown }, pose: Pose, x: number, y: number, alto: number) {
  const dibujar = ctx.drawImage as (im: unknown, x: number, y: number, w: number, h: number) => void
  const k = alto / ALTO
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  dibujar.call(ctx, capas.cuerpo, 0, 0, ANCHO, ALTO)

  ctx.save()
  ctx.translate(HOMBRO.x, HOMBRO.y)
  ctx.rotate((pose.brazo * Math.PI) / 180)
  ctx.translate(-HOMBRO.x, -HOMBRO.y)
  dibujar.call(ctx, capas.brazo, 0, 0, ANCHO, ALTO)
  ctx.restore()

  const vx = Math.max(-1, Math.min(1, pose.mirada.x)), vy = Math.max(-1, Math.min(1, pose.mirada.y))
  for (const o of OJOS) {
    const cx = o.cx + vx * RANGO.x, cy = o.cy + vy * RANGO.y
    ctx.fillStyle = TINTA
    ctx.beginPath()
    ctx.ellipse(cx, cy, 12 * pose.ojo.ancho, 21.5 * pose.ojo.alto, 0, 0, Math.PI * 2)
    ctx.fill()
    if (pose.brillo > 0) {
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = pose.brillo
      ctx.beginPath()
      ctx.arc(cx - 4 + vx * BRILLO.x, cy - 8 + vy * BRILLO.y, pose.atento ? 4.6 : 3.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = pose.brillo * (0.7 / 0.95)
      ctx.beginPath()
      ctx.arc(cx + 4 + vx * BRILLO.x * 0.6, cy + 7 + vy * BRILLO.y * 0.6, 1.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  const medio = (BOCA.x0 + BOCA.x1) / 2
  ctx.fillStyle = TINTA
  ctx.strokeStyle = TINTA
  ctx.beginPath()
  if (pose.boca.tipo === 'abierta') {
    ctx.ellipse(medio, BOCA.y + 7, 15 * pose.boca.ancho, 10 * pose.boca.alto, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (pose.boca.tipo === 'sonrisa') {
    ctx.moveTo(BOCA.x0 - 3, BOCA.y - 2)
    ctx.quadraticCurveTo(medio, BOCA.curva + 14, BOCA.x1 + 3, BOCA.y - 2)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.moveTo(BOCA.x0, BOCA.y)
    ctx.quadraticCurveTo(medio, BOCA.curva, BOCA.x1, BOCA.y)
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

export { ANCHO, ALTO }
