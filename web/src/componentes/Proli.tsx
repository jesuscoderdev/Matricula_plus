import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import ProliAnimado from './ProliAnimado'

/** Proli en el lugar del icono de un proyecto (portada, intro y tarjetas): quieto, con la mirada viva. */
export function ProliMarca({ tamano = 2.4, className = '' }: { tamano?: number; className?: string }) {
  return (
    <span className={`proli-marca ${className}`} style={{ display: 'inline-flex' }}>
      <ProliAnimado tamano={tamano} seguir />
    </span>
  )
}

const SEGUNDOS_HABLANDO = 2.4  // al aparecer con un globo, Proli «dice» la frase

/**
 * Proli, la mascota de Proliferante. Quieto: la vida está en la mirada (sigue el puntero, mira
 * alrededor, parpadea) y, si lleva un globo de diálogo, saluda con la mano y mueve la boca mientras
 * aparece la frase.
 */
export default function Proli({ tamano = 6, globo, lado = 'izquierda', className = '' }: {
  /** alto en rem */
  tamano?: number
  globo?: ReactNode
  /** de qué lado del globo queda Proli */
  lado?: 'izquierda' | 'derecha'
  className?: string
}) {
  const [hablando, setHablando] = useState(!!globo)
  useEffect(() => {
    if (!globo) return
    setHablando(true)
    const id = window.setTimeout(() => setHablando(false), SEGUNDOS_HABLANDO * 1000)
    return () => window.clearTimeout(id)
  }, [globo])
  return (
    <div className={`proli proli--${lado} ${className}`}>
      <span className="proli__img">
        <ProliAnimado tamano={tamano} hablando={hablando} saludar={hablando} seguir />
      </span>
      {globo && (
        <motion.div className="proli__globo" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 20 }}>
          {globo}
        </motion.div>
      )}
    </div>
  )
}
