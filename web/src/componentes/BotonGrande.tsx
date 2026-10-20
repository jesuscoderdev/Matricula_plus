import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  onClick?: () => void
  variante?: 'primario' | 'secundario'
  /** late suavemente para invitar a tocar */
  latir?: boolean
}

export default function BotonGrande({ children, onClick, variante = 'primario', latir }: Props) {
  return (
    <motion.button
      className={`boton boton--${variante}`}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      whileTap={{ scale: 0.96 }}
      animate={latir ? { scale: [1, 1.04, 1] } : undefined}
      transition={latir ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      {children}
    </motion.button>
  )
}
