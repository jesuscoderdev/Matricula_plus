import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import BotonGrande from '../componentes/BotonGrande'
import MapaSimulador from '../mapa/MapaSimulador'
import { TITULO_SIMULADOR } from '../config'
import { entero } from '../datos'
import type { PropsPaso } from './tipos'

/** Modo espera (attract loop): mapa respirando y frases gancho. Tocar en cualquier parte empieza. */
export default function Espera({ datos, base, ir, modo }: PropsPaso) {
  const p = datos.indice.parametros as { cupos_nuevos_total: number; demanda_nuevos_total: number }
  const por100 = Math.round((100 * p.cupos_nuevos_total) / p.demanda_nuevos_total)
  const frases = useMemo(() => [
    `Por cada 100 niños nuevos que piden cupo, hay ${por100} cupos.`,
    `Hoy ${entero(base.sinCupo)} niños no quedan en ninguno de sus 3 colegios.`,
    '¿A quién le darías prioridad?',
  ], [por100, base.sinCupo])
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % frases.length), 4000)
    return () => clearInterval(id)
  }, [frases.length])

  return (
    <div className="pantalla-paso pantalla-paso--espera" onClick={() => modo !== 'auto' && ir('problema')}>
      <header className="cabeza">
        <h1 className="titulo titulo--portada">{TITULO_SIMULADOR}</h1>
        <div className="frase-caja">
          <AnimatePresence mode="wait">
            <motion.p key={i} className="frase" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5 }}>
              {frases[i]}
            </motion.p>
          </AnimatePresence>
        </div>
      </header>
      <div className="mapa-zona">
        <MapaSimulador datos={datos} porUpz={base.porUpz} respirar />
      </div>
      <footer className="pie-acciones">
        {modo !== 'auto' && <BotonGrande latir onClick={() => ir('problema')}>Tocar para empezar</BotonGrande>}
      </footer>
    </div>
  )
}
