import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import imagenCuerpo from '../assets/proli-cuerpo.webp'
import imagenBrazo from '../assets/proli-brazo.webp'
import { EMPRESA } from '../config'

// Proli por capas, en las coordenadas de la imagen (480 × 474): el cuerpo, el brazo que saluda
// (gira desde el hombro) y, encima, ojos y boca dibujados. El cuerpo queda quieto: la vida está en
// la mirada (sigue al puntero, mira alrededor, parpadea, se interesa) y en la boca.
const ANCHO = 480, ALTO = 474
const OJOS = [{ cx: 181, cy: 179.5 }, { cx: 226, cy: 179.5 }]
const BOCA = { x0: 180, x1: 224, y: 215, curva: 232 }
const HOMBRO = `${(386 / ANCHO) * 100}% ${(282 / ALTO) * 100}%`
const TINTA = '#2e170a'
const RANGO = { x: 10, y: 8 }          // cuánto se mueven los ojos dentro de la cara
const BRILLO = { x: 4.5, y: 3.5 }      // el brillo se mueve un poco más que el ojo: da profundidad

/**
 * Proli vivo: parpadea, sigue con los ojos al puntero (`seguir`) o mira hacia un punto (`mirar`, de
 * −1 a 1); si nadie lo mueve, mira a su alrededor por su cuenta. Mueve la boca mientras `hablando`,
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
  const parpadeo = useParpadeo(!reducir)
  const puntero = usePuntero(ref, seguir && !reducir)
  const libre = useMiradaLibre(!reducir && !mirar && !puntero)
  const vista = reducir ? null : mirar ?? puntero ?? libre
  const vx = vista ? Math.max(-1, Math.min(1, vista.x)) : 0
  const vy = vista ? Math.max(-1, Math.min(1, vista.y)) : 0
  const habla = hablando && !reducir
  const saluda = saludar && !reducir
  // Al saludar sonríe con los ojos; atento, los abre un poco más
  const altoOjo = parpadeo ? 0.08 : saluda ? 0.62 : atento ? 1.12 : 1
  return (
    <span ref={ref} className={`proli-animado ${className}`} style={tamano ? { height: `${tamano}rem` } : { height: '100%' }}
          role="img" aria-label={`Proli, de ${EMPRESA}`}>
      <img src={imagenCuerpo} alt="" draggable={false} />
      <motion.img src={imagenBrazo} alt="" draggable={false} style={{ transformOrigin: HOMBRO }}
                  animate={saluda ? { rotate: [0, -24, 4, -24, 4, -24, 4, 0] } : { rotate: 0 }}
                  transition={saluda ? { duration: 2.6, ease: 'easeInOut' } : { duration: 0.3 }} />
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden>
        {OJOS.map((o) => (
          <motion.g key={o.cx} animate={{ x: vx * RANGO.x, y: vy * RANGO.y }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
            <motion.ellipse cx={o.cx} cy={o.cy} rx={12} ry={21.5} fill={TINTA}
                            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                            animate={{ scaleY: altoOjo, scaleX: atento && !parpadeo ? 1.08 : 1 }} transition={{ duration: parpadeo ? 0.06 : 0.18 }} />
            {/* El brillo del ojo: lo que más lo hace parecer vivo */}
            <motion.circle cx={o.cx - 4} cy={o.cy - 8} r={atento ? 4.6 : 3.8} fill="#ffffff"
                           animate={{ x: vx * BRILLO.x, y: vy * BRILLO.y, opacity: parpadeo || saluda ? 0 : 0.95 }}
                           transition={{ type: 'spring', stiffness: 220, damping: 18 }} />
            <motion.circle cx={o.cx + 4} cy={o.cy + 7} r={1.8} fill="#ffffff"
                           animate={{ x: vx * BRILLO.x * 0.6, y: vy * BRILLO.y * 0.6, opacity: parpadeo || saluda ? 0 : 0.7 }}
                           transition={{ type: 'spring', stiffness: 220, damping: 18 }} />
          </motion.g>
        ))}
        {habla ? (
          // Al hablar, la boca se abre y se cierra a ritmo irregular, como sílabas
          <motion.ellipse cx={(BOCA.x0 + BOCA.x1) / 2} cy={BOCA.y + 7} rx={15} ry={10} fill={TINTA}
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                          animate={{ scaleY: [0.25, 1, 0.45, 0.85, 0.3, 1, 0.25], scaleX: [1, 0.85, 1, 0.9, 1, 0.85, 1] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }} />
        ) : saluda || atento ? (
          // Sonrisa abierta: al saludar y cuando le prestan atención
          <path d={`M${BOCA.x0 - 3} ${BOCA.y - 2} Q${(BOCA.x0 + BOCA.x1) / 2} ${BOCA.curva + 14} ${BOCA.x1 + 3} ${BOCA.y - 2} Z`} fill={TINTA} />
        ) : (
          <path d={`M${BOCA.x0} ${BOCA.y} Q${(BOCA.x0 + BOCA.x1) / 2} ${BOCA.curva} ${BOCA.x1} ${BOCA.y}`}
                fill="none" stroke={TINTA} strokeWidth={8} strokeLinecap="round" />
        )}
      </svg>
    </span>
  )
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

/** Sin nadie a quien mirar, Proli mira alrededor: a un lado, al otro, hacia arriba, y vuelve al frente. */
function useMiradaLibre(activo: boolean) {
  const [v, setV] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  useEffect(() => {
    if (!activo) return
    let id = 0
    const ciclo = () => {
      id = window.setTimeout(() => {
        // Un tercio de las veces vuelve a mirar al frente (al visitante)
        setV(Math.random() < 0.34 ? { x: 0, y: 0 } : { x: Math.random() * 2 - 1, y: Math.random() * 1.6 - 0.9 })
        ciclo()
      }, 1300 + Math.random() * 2200)
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
      window.clearTimeout(quieto)
      quieto = window.setTimeout(() => setV(null), 4000)
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
