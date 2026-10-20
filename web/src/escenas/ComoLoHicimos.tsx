import { motion } from 'framer-motion'
import BotonGrande from '../componentes/BotonGrande'
import { conSigno, decimal, entero } from '../datos'
import type { PropsEscena } from './tipos'

/** Paso 5: la metodología en 3 tarjetas + supuestos visibles. */
export default function ComoLoHicimos({ datos, ir, modo }: PropsEscena) {
  const r = datos.resumen
  const tarjetas = [
    {
      n: '1', titulo: 'Datos abiertos',
      texto: `Oferta y demanda de cupos de la SED, sedes de Catastro y límites de UPZ y localidades.`,
      dato: `${entero(r.totales.sedes)} sedes · ${r.totales.upz} UPZ`,
    },
    {
      n: '2', titulo: 'Modelo',
      texto: 'Cupo garantizado por optimización de red + aceptación diferida con prioridades.',
      dato: r.fuente === 'real'
        ? `${entero(r.totales.muestra_simulada)} simuladas · expandidas a ${entero(r.totales.estudiantes)} reales`
        : `${entero(r.totales.muestra_simulada)} solicitudes simuladas`,
    },
    {
      n: '3', titulo: 'Impacto',
      texto: `Mismos cupos, mejor repartidos. ${conSigno(r.delta.pct_top3, decimal)} pts en su top 3.`,
      dato: `${conSigno(r.delta.sin_cupo)} sin cupo · ${conSigno(Math.round(100 * r.delta.viajes_largos / Math.max(1, r.hoy.viajes_largos)))}% viajes largos`,
    },
  ]
  return (
    <div className="escena escena--opaca">
      <header className="arriba">
        <h1 className="titulo">¿Cómo lo hicimos?</h1>
      </header>
      <div className="tarjetas">
        {tarjetas.map((t, i) => (
          <motion.div
            key={t.n}
            className="tarjeta"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.5, duration: 0.5 }}
          >
            <div className="tarjeta__n">{t.n}</div>
            <div>
              <div className="tarjeta__titulo">{t.titulo}</div>
              <div className="tarjeta__texto">{t.texto}</div>
              <div className="tarjeta__dato">{t.dato}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <footer className="abajo">
        <div className="supuesto">{r.nota} Toda la ciudad · semilla fija · resultados reproducibles.</div>
        {modo !== 'auto' && <BotonGrande onClick={() => ir('cierre')}>Siguiente</BotonGrande>}
      </footer>
    </div>
  )
}
