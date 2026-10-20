import { motion } from 'framer-motion'
import BotonGrande from '../componentes/BotonGrande'
import Contador from '../componentes/Contador'
import { entero } from '../datos'
import type { PropsEscena } from './tipos'

/** El problema: zoom a una localidad y una sola cifra grande. */
export default function Problema({ datos, localidad, ir, modo }: PropsEscena) {
  const loc = datos.resumen.localidades.find((l) => l.localidad === localidad)!
  const faltan = loc.balance < 0
  return (
    <div className="escena">
      <header className="arriba">
        <div className="sobretitulo">Localidad de</div>
        <motion.h1 key={localidad} className="titulo" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {localidad}
        </motion.h1>
        <div className={`cifra-gigante ${faltan ? 'texto-deficit' : 'texto-superavit'}`}>
          <Contador valor={Math.abs(loc.balance)} retraso={0.5} />
        </div>
        <div className="subtitulo">
          {faltan
            ? datos.resumen.fuente === 'real' ? 'cupos faltan para las solicitudes de sus colegios' : 'cupos faltan para los niños que viven aquí'
            : 'cupos sobran en sus colegios'}
        </div>
        <div className="detalle">
          {entero(loc.demanda)} solicitudes · {entero(loc.oferta)} cupos
        </div>
      </header>
      <footer className="abajo">
        {modo !== 'auto' && <div className="pista">Toca otra localidad en el mapa</div>}
        {modo !== 'auto' && <BotonGrande onClick={() => ir('hoy')}>Asignar como hoy</BotonGrande>}
      </footer>
    </div>
  )
}
