import { motion } from 'framer-motion'
import Contador from './Contador'
import { conSigno, decimal, entero } from '../datos'

type Tono = 'malo' | 'bueno' | 'neutro'

interface Props {
  etiqueta: string
  valor: number
  unidad?: string
  decimales?: boolean
  tono?: Tono
  /** cambio frente a hoy; `mejorSiBaja` define si un delta negativo es bueno */
  delta?: number
  unidadDelta?: string
  mejorSiBaja?: boolean
  retraso?: number
  /** el contador arranca en este valor (la cifra de hoy) */
  desde?: number
}

export default function Kpi({ etiqueta, valor, unidad, decimales, tono = 'neutro', delta, unidadDelta = '', mejorSiBaja, retraso = 0, desde }: Props) {
  const fmt = decimales ? decimal : entero
  const deltaBueno = delta !== undefined && (mejorSiBaja ? delta < 0 : delta > 0)
  return (
    <motion.div
      className={`kpi kpi--${tono}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: retraso, duration: 0.4 }}
    >
      <div className="kpi__valor">
        <Contador valor={valor} formato={fmt} retraso={retraso} desde={desde} duracion={desde !== undefined ? 2 : 1.4} />
        {unidad && <span className="kpi__unidad">{unidad}</span>}
      </div>
      <div className="kpi__etiqueta">{etiqueta}</div>
      {delta !== undefined && (
        <motion.div
          className={`kpi__delta ${delta === 0 ? '' : deltaBueno ? 'kpi__delta--bueno' : 'kpi__delta--malo'}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: retraso + 1.2, type: 'spring', stiffness: 260, damping: 18 }}
        >
          {conSigno(delta, fmt)}{unidadDelta}
        </motion.div>
      )}
    </motion.div>
  )
}
