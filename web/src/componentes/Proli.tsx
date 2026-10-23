import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import ProliAnimado from './ProliAnimado'

/** Proli en el lugar del icono de un proyecto (portada, intro y tarjetas): se mece y parpadea. */
export function ProliMarca({ tamano = 2.4, className = '' }: { tamano?: number; className?: string }) {
  const reducir = useReducedMotion()
  return (
    <motion.span className={`proli-marca ${className}`} style={{ display: 'inline-flex' }}
                 animate={reducir ? undefined : { rotate: [0, -5, 0, 5, 0] }}
                 transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
      <ProliAnimado tamano={tamano} />
    </motion.span>
  )
}

const SEGUNDOS_HABLANDO = 2.4  // al aparecer con un globo, Proli «dice» la frase

/**
 * Proli, la mascota de Proliferante. Se mece suavemente (salvo con "reducir movimiento"),
 * parpadea y, si lleva un globo de diálogo, mueve la boca mientras aparece la frase.
 */
export default function Proli({ tamano = 6, globo, lado = 'izquierda', className = '' }: {
  /** alto en rem */
  tamano?: number
  globo?: ReactNode
  /** de qué lado del globo queda Proli */
  lado?: 'izquierda' | 'derecha'
  className?: string
}) {
  const reducir = useReducedMotion()
  const [hablando, setHablando] = useState(!!globo)
  useEffect(() => {
    if (!globo) return
    setHablando(true)
    const id = window.setTimeout(() => setHablando(false), SEGUNDOS_HABLANDO * 1000)
    return () => window.clearTimeout(id)
  }, [globo])
  return (
    <div className={`proli proli--${lado} ${className}`}>
      <motion.span className="proli__img"
                   animate={reducir ? undefined : { rotate: [0, -4, 0, 4, 0], y: [0, -3, 0, -3, 0] }}
                   transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
        <ProliAnimado tamano={tamano} hablando={hablando} />
      </motion.span>
      {globo && (
        <motion.div className="proli__globo" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 20 }}>
          {globo}
        </motion.div>
      )}
    </div>
  )
}
