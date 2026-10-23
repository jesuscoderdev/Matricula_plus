import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import imagenCuerpo from '../assets/proli-cuerpo.webp'
import imagenBrazo from '../assets/proli-brazo.webp'
import { EMPRESA } from '../config'

// Proli por capas, en las coordenadas de la imagen (480 × 474): el cuerpo, el brazo que saluda
// (gira desde el hombro) y, encima, ojos y boca dibujados para que parpadee, mire y hable.
const ANCHO = 480, ALTO = 474
const OJOS = [{ cx: 181, cy: 179.5 }, { cx: 226, cy: 179.5 }]
const BOCA = { x0: 180, x1: 224, y: 215, curva: 232 }
const HOMBRO = `${(386 / ANCHO) * 100}% ${(282 / ALTO) * 100}%`
const TINTA = '#2e170a'

/**
 * Proli vivo: respira, parpadea, sigue con los ojos al puntero (`seguir`) o mira hacia un punto
 * (`mirar`, de −1 a 1), mueve la boca mientras `hablando` y saluda con la mano cuando `saludar`
 * cambia a true. Con «reducir movimiento» queda quieto y sonriendo.
 */
export default function ProliAnimado({ tamano, hablando = false, saludar = false, seguir = false, mirar, className = '' }: {
  /** alto en rem (sin él, el alto lo pone el CSS del contenedor) */
  tamano?: number
  hablando?: boolean
  saludar?: boolean
  seguir?: boolean
  mirar?: { x: number; y: number } | null
  className?: string
}) {
  const reducir = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const parpadeo = useParpadeo(!reducir)
  const puntero = usePuntero(ref, seguir && !reducir)
  const vista = mirar ?? puntero
  const mx = reducir || !vista ? 0 : Math.max(-1, Math.min(1, vista.x)) * 6
  const my = reducir || !vista ? 0 : Math.max(-1, Math.min(1, vista.y)) * 5
  const habla = hablando && !reducir
  const saluda = saludar && !reducir
  return (
    <motion.span ref={ref} className={`proli-animado ${className}`} style={tamano ? { height: `${tamano}rem` } : { height: '100%' }}
                 role="img" aria-label={`Proli, de ${EMPRESA}`}
                 // Respira; al hablar, además asiente un poco
                 animate={reducir ? undefined : habla ? { scaleY: [1, 1.03, 0.99, 1.02, 1], y: [0, -2, 0, -1, 0] } : { scaleY: [1, 1.015, 1] }}
                 transition={habla ? { duration: 0.9, repeat: Infinity } : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}>
      <img src={imagenCuerpo} alt="" draggable={false} />
      <motion.img src={imagenBrazo} alt="" draggable={false} style={{ transformOrigin: HOMBRO }}
                  animate={saluda ? { rotate: [0, -24, 4, -24, 4, -24, 4, 0] } : { rotate: 0 }}
                  transition={saluda ? { duration: 2.6, ease: 'easeInOut' } : { duration: 0.3 }} />
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden>
        <motion.g animate={{ x: mx, y: my }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          {OJOS.map((o) => (
            <motion.ellipse key={o.cx} cx={o.cx} cy={o.cy} rx={12} ry={21.5} fill={TINTA}
                            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                            // Al saludar entrecierra los ojos, como quien sonríe de verdad
                            animate={{ scaleY: parpadeo ? 0.1 : saluda ? 0.7 : 1 }} transition={{ duration: 0.08 }} />
          ))}
        </motion.g>
        {habla ? (
          // Al hablar, la boca se abre y se cierra a ritmo irregular, como sílabas
          <motion.ellipse cx={(BOCA.x0 + BOCA.x1) / 2} cy={BOCA.y + 7} rx={15} ry={10} fill={TINTA}
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                          animate={{ scaleY: [0.25, 1, 0.45, 0.85, 0.3, 1, 0.25], scaleX: [1, 0.85, 1, 0.9, 1, 0.85, 1] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }} />
        ) : saluda ? (
          // Sonrisa abierta al saludar
          <path d={`M${BOCA.x0 - 3} ${BOCA.y - 2} Q${(BOCA.x0 + BOCA.x1) / 2} ${BOCA.curva + 14} ${BOCA.x1 + 3} ${BOCA.y - 2} Z`} fill={TINTA} />
        ) : (
          <path d={`M${BOCA.x0} ${BOCA.y} Q${(BOCA.x0 + BOCA.x1) / 2} ${BOCA.curva} ${BOCA.x1} ${BOCA.y}`}
                fill="none" stroke={TINTA} strokeWidth={8} strokeLinecap="round" />
        )}
      </svg>
    </motion.span>
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

/** Hacia dónde está el puntero (o el último toque) respecto de Proli, de −1 a 1 en cada eje. */
function usePuntero(ref: React.RefObject<HTMLSpanElement | null>, activo: boolean) {
  const [v, setV] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!activo) { setV(null); return }
    let cuadro = 0
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(() => {
        const r = ref.current?.getBoundingClientRect()
        if (!r) return
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.38)
        const d = Math.max(1, Math.hypot(dx, dy))
        const k = Math.min(1, d / 260)   // cerca de Proli, mira menos de lado
        setV({ x: (dx / d) * k, y: (dy / d) * k })
      })
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerdown', mover)
    return () => { cancelAnimationFrame(cuadro); window.removeEventListener('pointermove', mover); window.removeEventListener('pointerdown', mover) }
  }, [activo, ref])
  return v
}
