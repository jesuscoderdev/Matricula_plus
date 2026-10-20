import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import imagenProli from '../assets/proli.webp'
import { EMPRESA } from '../config'

/**
 * Proli, la mascota de Proliferante. Se mece suavemente (salvo con "reducir movimiento")
 * y puede llevar un globo de diálogo.
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
  return (
    <div className={`proli proli--${lado} ${className}`}>
      <motion.img
        src={imagenProli}
        alt={`Proli, de ${EMPRESA}`}
        className="proli__img"
        style={{ height: `${tamano}rem` }}
        draggable={false}
        animate={reducir ? undefined : { rotate: [0, -4, 0, 4, 0], y: [0, -3, 0, -3, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {globo && (
        <motion.div className="proli__globo" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 20 }}>
          {globo}
        </motion.div>
      )}
    </div>
  )
}
