import { motion } from 'framer-motion'
import { entero } from '../datos'
import { LogoEmpresa } from '../componentes/Marca'
import Proli from '../componentes/Proli'
import { esTotem } from '../modo'
import type { PropsCapitulo } from './tipos'

/** Portada: la pregunta, la cifra que duele y una sola acción. */
export default function Portada({ datos, r, modo, ir }: PropsCapitulo) {
  const p = datos.indice.parametros as { cupos_nuevos_total: number; demanda_nuevos_total: number }
  const totem = esTotem(modo)
  const entrar = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }
  return (
    <>
      <div className="portada__contenido">
        <motion.div className="portada__marca" {...entrar} transition={{ delay: 0.05 }}>
          <LogoEmpresa />
          <span className="etiqueta">GovTech · 3–4 nov 2026</span>
        </motion.div>
        <motion.span className="kicker" {...entrar} transition={{ delay: 0.15 }}>Simulador de matrícula · Bogotá</motion.span>
        <motion.h1 className="display display--xl" {...entrar} transition={{ delay: 0.25 }}>
          ¿Dónde cabe <em>cada niño</em>?
        </motion.h1>
        <motion.p className="lead" {...entrar} transition={{ delay: 0.35 }}>
          Cada año <b>{entero(p.demanda_nuevos_total)}</b> niños nuevos piden cupo en un colegio público de Bogotá,
          y solo hay <b>{entero(p.cupos_nuevos_total)}</b> cupos. Simula cómo repartirlos mejor.
        </motion.p>
      </div>
      <div className="portada__pie">
        <motion.div className="portada__cifra" {...entrar} transition={{ delay: 0.5 }}>
          <div className="gran-cifra">
            <span className="gran-cifra__n">{entero(r.bogota.hoy.fueraDeOpciones)}</span>
            <span className="gran-cifra__t">niños hoy no quedan en ninguno de los colegios que pidieron</span>
          </div>
        </motion.div>
        {modo !== 'auto' && (
          <motion.div className="fila" {...entrar} transition={{ delay: 0.6 }}>
            <button className="boton boton--violeta boton--latir" onClick={() => ir('problema')}>Empezar el recorrido →</button>
            {!totem && <button className="boton boton--claro" onClick={() => ir('caso')}>Simula una familia</button>}
            {!totem && <button className="boton-texto" onClick={() => ir('explorar')}>Explorar el mapa</button>}
          </motion.div>
        )}
        {totem && (
          <div className="fila fila--entre">
            <span className="toca">{modo === 'auto' ? 'Recorrido automático' : 'Toca para empezar'}</span>
            <Proli tamano={6} lado="derecha" globo={<>Hola, soy <b>Proli</b>. Te muestro cómo se reparten los cupos.</>} />
          </div>
        )}
      </div>
    </>
  )
}
