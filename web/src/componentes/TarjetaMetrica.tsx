import { motion } from 'framer-motion'
import Contador from './Contador'
import { describirDelta, type InfoMetrica } from '../metricas'

interface Props {
  info: InfoMetrica
  valor: number
  base: number
  /** sin comparación (paso Problema) */
  sinDelta?: boolean
  grande?: boolean
  retraso?: number
}

/** Tarjeta grande: valor, qué mide y cambio frente a hoy con signo, flecha y palabra. */
export default function TarjetaMetrica({ info, valor, base, sinDelta, grande, retraso = 0 }: Props) {
  const d = describirDelta(info, valor, base)
  return (
    <motion.div
      className={`tarjeta-m ${grande ? 'tarjeta-m--grande' : ''} ${sinDelta ? '' : `tarjeta-m--${d.sentido}`}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: retraso, duration: 0.3 }}
    >
      <div className="tarjeta-m__valor">
        <Contador valor={valor} formato={info.fmt} desde={sinDelta ? 0 : base} duracion={0.9} retraso={retraso} />
        <span className="tarjeta-m__unidad">{info.unidad === '%' ? '%' : ' km'}</span>
      </div>
      <div className="tarjeta-m__etiqueta">{info.etiqueta}</div>
      {!sinDelta && (
        <div className="tarjeta-m__delta">
          <span aria-hidden="true">{d.flecha}</span> {d.texto}
        </div>
      )}
    </motion.div>
  )
}
