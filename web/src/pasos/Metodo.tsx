import { motion } from 'framer-motion'
import BotonGrande from '../componentes/BotonGrande'
import { LogoEmpresa } from '../componentes/Marca'
import QrCita from '../componentes/QrCita'
import { esTotem } from '../modo'
import { describirPalancas, type PropsPaso } from './tipos'

/** Paso 5 — El método Proliferante aplicado a este demo, y QR para agendar cita. */
export default function Metodo({ datos, palancas, ir, modo, alAgendar }: PropsPaso) {
  const etapas = [
    { t: 'Datos abiertos', d: 'Oferta y demanda SED, colegios, UPZ y población por edad' },
    { t: 'Modelo', d: 'Familias sintéticas y asignación diferida' },
    { t: 'Simulación', d: `${Object.keys(datos.escenarios).length} escenarios precalculados` },
    { t: 'Decisión', d: describirPalancas(datos, palancas) },
    { t: 'Aprendizaje', d: 'Medir, comparar y ajustar la política' },
  ]
  return (
    <div className="pantalla-paso">
      <header className="cabeza">
        <LogoEmpresa />
        <h1 className="titulo">El método Proliferante</h1>
      </header>
      <ol className="metodo">
        {etapas.map((e, i) => (
          <motion.li key={e.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i }}>
            <span className="metodo__n">{i + 1}</span>
            <span><b>{e.t}</b><br /><small>{e.d}</small></span>
          </motion.li>
        ))}
      </ol>
      <div className="cierre">
        <QrCita />
      </div>
      <footer className="pie-acciones">
        {!esTotem(modo) && <BotonGrande onClick={alAgendar}>Agendar una cita</BotonGrande>}
        {modo !== 'auto' && <BotonGrande variante="secundario" onClick={() => ir('espera')}>Volver a empezar</BotonGrande>}
      </footer>
    </div>
  )
}
