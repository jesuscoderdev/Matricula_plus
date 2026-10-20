import { motion } from 'framer-motion'
import BotonGrande from '../componentes/BotonGrande'
import { kickerDe } from '../componentes/BarraProgreso'
import type { PropsPaso } from './tipos'

const ORDEN = ['familias', 'corte', 'cupos', 'distancia', 'opciones', 'colegio_nuevo', 'jornada_unica']

/** Paso 4 — Supuestos: todo lo que asumimos, a la vista. */
export default function Supuestos({ datos, ir, modo }: PropsPaso) {
  const s = datos.indice.supuestos
  return (
    <div className="pantalla-paso">
      <header className="cabeza">
        <span className="kicker">{kickerDe('supuestos')}</span>
        <h1 className="titulo">Lo que supusimos</h1>
        <p className="subtitulo">Es una simulación para comparar políticas, no una predicción.</p>
      </header>
      <ul className="supuestos">
        {ORDEN.filter((k) => s[k]).map((k, i) => (
          <motion.li key={k} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }}>
            {s[k]}
          </motion.li>
        ))}
      </ul>
      <footer className="pie-acciones">
        {modo !== 'auto' && <BotonGrande onClick={() => ir('metodo')}>Siguiente →</BotonGrande>}
      </footer>
    </div>
  )
}
