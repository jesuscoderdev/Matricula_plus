import { motion } from 'framer-motion'
import { entero } from '../datos'
import { BotonInicio, BotonTema, LogoEmpresa, MarcaDeAgua, NombreApp } from '../componentes/Marca'
import Proli, { ProliMarca } from '../componentes/Proli'
import { esTotem } from '../modo'
import type { PropsCapitulo } from './tipos'

/** Portada: la pregunta, la cifra que duele y una sola acción. */
export default function Portada({ datos, r, modo, ir, alInicio, alPortada }: PropsCapitulo) {
  const p = datos.indice.parametros as { deficit_sed: number; upz_insuficientes_sed: number }
  const totem = esTotem(modo)
  const entrar = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }
  return (
    <>
      <div className="portada__contenido">
        <MarcaDeAgua className="marca-agua--portada" />
        <motion.div className="portada__marca" {...entrar} transition={{ delay: 0.05 }}>
          <div className="portada__logos">
            {alInicio && modo !== 'auto' && <BotonInicio alInicio={alInicio} />}
            <LogoEmpresa alTocar={alPortada} />
            <span className="portada__sep" aria-hidden />
            <span className="marca-bloque"><ProliMarca /><NombreApp /></span>
          </div>
          <span className="etiqueta">GovTech · 3–4 nov 2026</span>
          <BotonTema />
        </motion.div>
        <motion.span className="kicker" {...entrar} transition={{ delay: 0.15 }}>Simulador de matrícula · Bogotá</motion.span>
        <motion.h1 className="display display--xl" {...entrar} transition={{ delay: 0.25 }}>
          ¿Cómo logramos que más niños tengan <em>colegio cerca de casa</em>?
        </motion.h1>
        <motion.p className="lead" {...entrar} transition={{ delay: 0.35 }}>
          En Bogotá hay cupos para los niños nuevos, pero no siempre donde viven: la Secretaría de Educación calcula
          un déficit de <b>{entero(p.deficit_sed)}</b> cupos, concentrado en <b>{p.upz_insuficientes_sed}</b> UPZ.{' '}
          <span className="acento">Descubre qué cambia con otra regla.</span>
        </motion.p>
      </div>
      <div className="portada__pie">
        <motion.div className="portada__cifra" {...entrar} transition={{ delay: 0.5 }}>
          <div className="gran-cifra">
            <span className="gran-cifra__n">{entero(r.bogota.hoy.fueraDeOpciones)}</span>
            <span className="gran-cifra__t">niños hoy no quedan en ninguno de los colegios que pidieron (simulación con datos abiertos)</span>
          </div>
        </motion.div>
        {modo !== 'auto' && (
          <motion.div className="fila" {...entrar} transition={{ delay: 0.6 }}>
            <button className="boton boton--violeta boton--latir" onClick={() => ir('problema')}>Descubre cómo →</button>
            {!totem && <button className="boton-texto" onClick={() => ir('explorar')}>Explorar el mapa</button>}
          </motion.div>
        )}
        {totem && (
          <div className="fila fila--entre">
            <span className="toca">{modo === 'auto' ? 'Recorrido automático' : 'Toca para empezar'}</span>
            {/* En el tótem táctil saluda el Proli flotante; en el automático (sin flotante), este */}
            {modo === 'auto' && <Proli tamano={6} lado="derecha" globo={<>Hola, soy <b>Proli</b>. Te muestro cómo se reparten los cupos.</>} />}
          </div>
        )}
      </div>
    </>
  )
}
