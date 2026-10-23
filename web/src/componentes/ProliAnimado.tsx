import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import imagenProli from '../assets/proli-sin-cara.webp'
import { EMPRESA } from '../config'

// Cara de Proli, en las coordenadas de la imagen (480 × 474): los ojos y la boca se dibujan encima
// para que parpadee, mire hacia donde va y mueva la boca al hablar.
const ANCHO = 480, ALTO = 474
const OJOS = [{ cx: 181, cy: 179.5 }, { cx: 226, cy: 179.5 }]
const BOCA = { x0: 180, x1: 224, y: 215, curva: 232 }
const TINTA = '#2e170a'

/**
 * Proli vivo: parpadea solo, mueve la boca mientras `hablando` y puede mirar hacia un punto
 * (`mirar`, de −1 a 1 en cada eje). Con «reducir movimiento» queda quieto y sonriendo.
 */
export default function ProliAnimado({ tamano, hablando = false, mirar, className = '' }: {
  /** alto en rem (sin él, el alto lo pone el CSS del contenedor) */
  tamano?: number
  hablando?: boolean
  mirar?: { x: number; y: number } | null
  className?: string
}) {
  const reducir = useReducedMotion()
  const parpadeo = useParpadeo(!reducir)
  const mx = reducir || !mirar ? 0 : Math.max(-1, Math.min(1, mirar.x)) * 5
  const my = reducir || !mirar ? 0 : Math.max(-1, Math.min(1, mirar.y)) * 4
  const habla = hablando && !reducir
  return (
    <span className={`proli-animado ${className}`} style={tamano ? { height: `${tamano}rem` } : { height: '100%' }} role="img" aria-label={`Proli, de ${EMPRESA}`}>
      <img src={imagenProli} alt="" draggable={false} />
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden>
        <motion.g animate={{ x: mx, y: my }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          {OJOS.map((o) => (
            <motion.ellipse key={o.cx} cx={o.cx} cy={o.cy} rx={12} ry={21.5} fill={TINTA}
                            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                            animate={{ scaleY: parpadeo ? 0.1 : 1 }} transition={{ duration: 0.08 }} />
          ))}
        </motion.g>
        {habla ? (
          // Al hablar, la boca se abre y se cierra a ritmo irregular, como sílabas
          <motion.ellipse cx={(BOCA.x0 + BOCA.x1) / 2} cy={BOCA.y + 7} rx={15} ry={10} fill={TINTA}
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                          animate={{ scaleY: [0.25, 1, 0.45, 0.85, 0.3, 1, 0.25], scaleX: [1, 0.85, 1, 0.9, 1, 0.85, 1] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }} />
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
