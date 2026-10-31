import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, type TargetAndTransition } from 'framer-motion'
import imagenCuerpo from '../assets/proli-cuerpo.webp'
import imagenBrazo from '../assets/proli-brazo.webp'
import { EMPRESA } from '../config'
import { ANCHO, ALTO, OJOS, BOCA, HOMBRO_PX, TINTA, RANGO, BRILLO, SALUDO, SALUDO_S, HABLA, HABLA_S } from './proliGeometria'

// Proli por capas (geometría en proliGeometria.ts): el cuerpo, el brazo que saluda
// (gira desde el hombro) y, encima, ojos y boca dibujados. Respira todo el tiempo y, en reposo, tiene
// gestos propios (inclina la cabeza, da un saltito, mira hacia arriba pensando…): así se ve vivo
// también en el celular, donde no hay puntero que seguir con los ojos.
const HOMBRO = `${(HOMBRO_PX.x / ANCHO) * 100}% ${(HOMBRO_PX.y / ALTO) * 100}%`

type Gesto = 'inclinar' | 'saltito' | 'balanceo' | 'pensar' | 'curioso' | 'saludito'
const GESTOS: Gesto[] = ['inclinar', 'saltito', 'balanceo', 'pensar', 'curioso', 'saludito']
/** Cuánto dura cada gesto (s) */
const DURA: Record<Gesto, number> = { inclinar: 2.2, saltito: 0.9, balanceo: 2.4, pensar: 2.2, curioso: 1.8, saludito: 1.5 }
/** El cuerpo en cada gesto (gira y salta desde los pies) */
const CUERPO: Partial<Record<Gesto, TargetAndTransition>> = {
  inclinar: { rotate: [0, -6, -6, 0], transition: { duration: DURA.inclinar, times: [0, 0.25, 0.75, 1], ease: 'easeInOut' } },
  saltito: { y: ['0%', '-7%', '0%', '-2.5%', '0%'], transition: { duration: DURA.saltito, ease: 'easeOut' } },
  balanceo: { rotate: [0, 4, -4, 2, 0], transition: { duration: DURA.balanceo, ease: 'easeInOut' } },
  pensar: { rotate: [0, 3, 3, 0], transition: { duration: DURA.pensar, times: [0, 0.2, 0.8, 1], ease: 'easeInOut' } },
}
const QUIETO: TargetAndTransition = { rotate: 0, y: '0%', transition: { duration: 0.4 } }

/**
 * Proli vivo: respira, parpadea, sigue con los ojos al puntero (`seguir`) o mira hacia un punto
 * (`mirar`, de −1 a 1); si nadie lo mueve, mira a su alrededor por su cuenta, con micro-movimientos
 * entre una mirada y otra, y de vez en cuando hace un gesto. Mueve la boca mientras `hablando`,
 * saluda con la mano cuando `saludar` y abre los ojos de interés cuando `atento`.
 * Con «reducir movimiento» queda quieto y sonriendo.
 */
export default function ProliAnimado({ tamano, hablando = false, saludar = false, seguir = false, atento = false, mirar, className = '' }: {
  /** alto en rem (sin él, el alto lo pone el CSS del contenedor) */
  tamano?: number
  hablando?: boolean
  saludar?: boolean
  seguir?: boolean
  atento?: boolean
  mirar?: { x: number; y: number } | null
  className?: string
}) {
  const reducir = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const habla = hablando && !reducir
  const saluda = saludar && !reducir
  // Los gestos propios, solo en reposo (ni hablando ni saludando)
  const gesto = useGestos(!reducir && !habla && !saluda)
  const parpadeo = useParpadeo(!reducir)
  const puntero = usePuntero(ref, seguir && !reducir)
  const libre = useMiradaLibre(!reducir && !mirar && !puntero)
  const vista = reducir ? null : gesto === 'pensar' ? PENSAR : mirar ?? puntero ?? libre
  const vx = vista ? Math.max(-1, Math.min(1, vista.x)) : 0
  const vy = vista ? Math.max(-1, Math.min(1, vista.y)) : 0
  const interes = atento || gesto === 'curioso'
  // El ojo conserva su tamaño y sus brillos al hablar y al saludar (al saludar se achina apenas);
  // con interés, se abre un poco más
  const altoOjo = parpadeo ? 0.08 : interes ? 1.12 : saluda ? 0.92 : 1
  const brazo = saluda ? { rotate: SALUDO, transition: { duration: SALUDO_S, ease: 'easeInOut' as const } }
    : gesto === 'saludito' ? { rotate: [0, -14, 2, -14, 0], transition: { duration: DURA.saludito, ease: 'easeInOut' as const } }
    : { rotate: 0, transition: { duration: 0.3 } }
  return (
    <span ref={ref} className={`proli-animado ${reducir ? '' : 'proli-animado--vivo'} ${className}`} style={tamano ? { height: `${tamano}rem` } : { height: '100%' }}
          role="img" aria-label={`Proli, de ${EMPRESA}`}>
      <motion.span className="proli-animado__cuerpo" animate={(gesto && CUERPO[gesto]) || QUIETO}>
        <img src={imagenCuerpo} alt="" draggable={false} />
        <motion.img src={imagenBrazo} alt="" draggable={false} style={{ transformOrigin: HOMBRO }} animate={brazo} />
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden>
          {OJOS.map((o) => (
            <motion.g key={o.cx} animate={{ x: vx * RANGO.x, y: vy * RANGO.y }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
              <motion.ellipse cx={o.cx} cy={o.cy} rx={12} ry={21.5} fill={TINTA}
                              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                              animate={{ scaleY: altoOjo, scaleX: interes && !parpadeo ? 1.08 : 1 }} transition={{ duration: parpadeo ? 0.06 : 0.18 }} />
              {/* El brillo del ojo: lo que más lo hace parecer vivo (solo se apaga al parpadear) */}
              <motion.circle cx={o.cx - 4} cy={o.cy - 8} r={interes ? 4.6 : 3.8} fill="#ffffff"
                             animate={{ x: vx * BRILLO.x, y: vy * BRILLO.y, opacity: parpadeo ? 0 : 0.95 }}
                             transition={{ type: 'spring', stiffness: 220, damping: 18 }} />
              <motion.circle cx={o.cx + 4} cy={o.cy + 7} r={1.8} fill="#ffffff"
                             animate={{ x: vx * BRILLO.x * 0.6, y: vy * BRILLO.y * 0.6, opacity: parpadeo ? 0 : 0.7 }}
                             transition={{ type: 'spring', stiffness: 220, damping: 18 }} />
            </motion.g>
          ))}
          {habla ? (
            // Al hablar, la boca se abre y se cierra a ritmo irregular, como sílabas
            <motion.ellipse cx={(BOCA.x0 + BOCA.x1) / 2} cy={BOCA.y + 7} rx={15} ry={10} fill={TINTA}
                            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                            animate={{ scaleY: HABLA.alto, scaleX: HABLA.ancho }}
                            transition={{ duration: HABLA_S, repeat: Infinity, ease: 'easeInOut' }} />
          ) : saluda || interes ? (
            // Sonrisa abierta: al saludar y cuando algo le interesa
            <path d={`M${BOCA.x0 - 3} ${BOCA.y - 2} Q${(BOCA.x0 + BOCA.x1) / 2} ${BOCA.curva + 14} ${BOCA.x1 + 3} ${BOCA.y - 2} Z`} fill={TINTA} />
          ) : (
            <path d={`M${BOCA.x0} ${BOCA.y} Q${(BOCA.x0 + BOCA.x1) / 2} ${BOCA.curva} ${BOCA.x1} ${BOCA.y}`}
                  fill="none" stroke={TINTA} strokeWidth={8} strokeLinecap="round" />
          )}
        </svg>
      </motion.span>
    </span>
  )
}

/** Pensando, mira hacia arriba, a un lado */
const PENSAR = { x: 0.55, y: -0.95 }

/** En reposo, cada 4 a 8 s, un gesto al azar (nunca el mismo dos veces seguidas). */
function useGestos(activo: boolean) {
  const [gesto, setGesto] = useState<Gesto | null>(null)
  useEffect(() => {
    if (!activo) { setGesto(null); return }
    let id = 0, anterior: Gesto | null = null
    const ciclo = () => {
      id = window.setTimeout(() => {
        const opciones = GESTOS.filter((g) => g !== anterior)
        const g = opciones[Math.floor(Math.random() * opciones.length)]
        anterior = g
        setGesto(g)
        id = window.setTimeout(() => { setGesto(null); ciclo() }, DURA[g] * 1000)
      }, 4000 + Math.random() * 4000)
    }
    ciclo()
    return () => window.clearTimeout(id)
  }, [activo])
  return gesto
}

/** Parpadeo natural: cada 2,5 a 5,5 s, a veces doble. */
function useParpadeo(activo: boolean) {
  const [cerrado, setCerrado] = useState(false)
  useEffect(() => {
    if (!activo) return
    let id = 0
    const ciclo = () => {
      id = window.setTimeout(() => {
        setCerrado(true)
        window.setTimeout(() => {
          setCerrado(false)
          if (Math.random() < 0.25) window.setTimeout(() => { setCerrado(true); window.setTimeout(() => setCerrado(false), 110) }, 160)
          ciclo()
        }, 110)
      }, 2500 + Math.random() * 3000)
    }
    ciclo()
    return () => window.clearTimeout(id)
  }, [activo])
  return cerrado
}

/**
 * Sin nadie a quien mirar, Proli mira alrededor: a un lado, al otro, hacia arriba, y vuelve al frente.
 * Entre una mirada y otra los ojos no quedan clavados: hacen micro-movimientos, como los de verdad.
 */
function useMiradaLibre(activo: boolean) {
  const [v, setV] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  useEffect(() => {
    if (!activo) return
    let id = 0
    let destino = { x: 0, y: 0 }
    const ciclo = () => {
      id = window.setTimeout(() => {
        if (Math.random() < 0.45) {
          // Micro-movimiento alrededor de donde ya mira
          setV({ x: destino.x + (Math.random() - 0.5) * 0.24, y: destino.y + (Math.random() - 0.5) * 0.2 })
        } else {
          // Una mirada nueva; un tercio de las veces, al frente (al visitante)
          destino = Math.random() < 0.34 ? { x: 0, y: 0 } : { x: Math.random() * 2 - 1, y: Math.random() * 1.6 - 0.9 }
          setV(destino)
        }
        ciclo()
      }, 500 + Math.random() * 1600)
    }
    ciclo()
    return () => window.clearTimeout(id)
  }, [activo])
  return activo ? v : null
}

/**
 * Hacia dónde está el puntero (o el último toque) respecto de Proli, de −1 a 1 en cada eje. Si el
 * puntero lleva un rato quieto, devuelve null y Proli vuelve a mirar por su cuenta.
 */
function usePuntero(ref: React.RefObject<HTMLSpanElement | null>, activo: boolean) {
  const [v, setV] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!activo) { setV(null); return }
    let ultimo = 0, quieto = 0
    const mover = (e: PointerEvent) => {
      // El aviso interno de actividad (un pointerdown sin coordenadas) no mueve los ojos
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return
      window.clearTimeout(quieto)
      // Con el dedo (celular, tótem) solo hay toques sueltos: los mira un momento y vuelve a lo suyo
      quieto = window.setTimeout(() => setV(null), e.pointerType === 'mouse' ? 4000 : 1800)
      // Como mucho unas 30 veces por segundo (sin depender de requestAnimationFrame)
      if (e.timeStamp - ultimo < 33) return
      ultimo = e.timeStamp
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.38)
      const d = Math.max(1, Math.hypot(dx, dy))
      const k = Math.min(1, d / 180)   // cerca de Proli, mira menos de lado
      setV({ x: (dx / d) * k, y: (dy / d) * k })
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerdown', mover)
    return () => { window.clearTimeout(quieto); window.removeEventListener('pointermove', mover); window.removeEventListener('pointerdown', mover) }
  }, [activo, ref])
  return v
}
