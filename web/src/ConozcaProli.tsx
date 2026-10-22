/**
 * Conozca a Proli: la segunda pantalla. Presenta a Proli como el guía del stand y deja claro que
 * el visitante puede apoyarse en él. Los «pedidos» son accesos reales: entran directo a un demo
 * (o a elegir proyecto). Cuando Proli converse con IA, esa zona será la entrada a la conversación.
 *
 * Sigue el tema de la app (claro u oscuro), como la página de elegir proyecto: tras la portada
 * navy, el cambio de fondo marca que el visitante ya entró. Textos en config.ts (PROLI_INTRO).
 */
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { PROLI_INTRO, SEGUNDOS_PROLI_AUTO, type IdProyecto } from './config'
import type { Modo } from './modo'
import { BotonInicio, LogoEmpresa, MarcaDeAgua } from './componentes/Marca'
import imagenProli from './assets/proli.webp'

const entrar = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } }
const MS_LETRA = 26   // velocidad con que Proli «escribe» el saludo

/** El saludo aparece letra por letra, como si Proli lo estuviera escribiendo. */
function useEscribiendo(texto: string, activo: boolean) {
  const [n, setN] = useState(activo ? 0 : texto.length)
  useEffect(() => {
    if (!activo) return
    const id = window.setInterval(() => setN((x) => (x >= texto.length ? x : x + 1)), MS_LETRA)
    return () => window.clearInterval(id)
  }, [texto, activo])
  return texto.slice(0, n)
}

function Icono({ tipo }: { tipo: string }) {
  const comun = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="proli-intro__icono">
      {tipo === 'guia' && <path {...comun} d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />}
      {tipo === 'cifra' && <path {...comun} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />}
      {tipo === 'equipo' && <path {...comun} d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a3 3 0 1 0 0-6M2 20c0-3 3-5 6-5s6 2 6 5M16 15c3 0 6 2 6 5" />}
    </svg>
  )
}

export default function ConozcaProli({ modo, alContinuar, alElegir, alVolver }: {
  modo: Modo
  /** a elegir proyecto */
  alContinuar: () => void
  /** entrar directo a un demo */
  alElegir: (p: IdProyecto) => void
  /** volver a la portada */
  alVolver: () => void
}) {
  const p = PROLI_INTRO
  const reducir = useReducedMotion()
  const auto = modo === 'auto'
  const saludo = useEscribiendo(p.saludo, !reducir)
  const escrito = saludo.length >= p.saludo.length

  // Modo automático: un rato con Proli y sigue solo
  useEffect(() => {
    if (!auto) return
    const id = window.setTimeout(alContinuar, SEGUNDOS_PROLI_AUTO * 1000)
    return () => window.clearTimeout(id)
  }, [auto, alContinuar])

  return (
    <div className="app proli-intro">
      <MarcaDeAgua className="marca-agua--proli-intro" />
      <div className="proli-intro__contenido">
        <motion.header className="proli-intro__marca" {...entrar} transition={{ delay: 0.05 }}>
          {!auto && <BotonInicio alInicio={alVolver} />}
          <LogoEmpresa />
        </motion.header>

        <div className="proli-intro__heroe">
          <motion.div className="proli-intro__figura" initial={{ opacity: 0, scale: 0.6, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 13, delay: 0.1 }}>
            <span className="proli-intro__halo" aria-hidden />
            <motion.img src={imagenProli} alt="Proli, la mascota de Proliferante" className="proli-intro__img" draggable={false}
                        animate={reducir ? undefined : { rotate: [0, -6, 0, 6, 0], y: [0, -6, 0, -6, 0] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
          </motion.div>
          <div className="proli-intro__presenta">
            <motion.span className="kicker" {...entrar} transition={{ delay: 0.25 }}>{p.kicker}</motion.span>
            <motion.h1 className="display display--xl proli-intro__nombre" {...entrar} transition={{ delay: 0.32 }}>
              Conozca a <em>{p.nombre}</em>
            </motion.h1>
            <motion.p className="acento" {...entrar} transition={{ delay: 0.4 }}>{p.esencia}</motion.p>
          </div>
        </div>

        <motion.div className="proli-intro__globo" {...entrar} transition={{ delay: 0.5 }} aria-label={p.saludo}>
          <span aria-hidden>{saludo}{!escrito && <i className="proli-intro__cursor" />}</span>
        </motion.div>

        <ul className="proli-intro__ayudas">
          {p.ayudas.map((a, i) => (
            <motion.li key={a.titulo} className="proli-intro__ayuda" {...entrar} transition={{ delay: 0.7 + i * 0.12 }}>
              <span className="proli-intro__icono-caja"><Icono tipo={a.icono} /></span>
              <span><b>{a.titulo}</b><small>{a.texto}</small></span>
            </motion.li>
          ))}
        </ul>

        <motion.div className="proli-intro__pedidos" {...entrar} transition={{ delay: 1.1 }}>
          <span className="etiqueta">{p.pedidosTitulo}</span>
          <div className="proli-intro__chips">
            {p.pedidos.map((x) => (
              <button key={x.texto} type="button" className="proli-intro__chip" disabled={auto}
                      onClick={() => (x.proyecto ? alElegir(x.proyecto) : alContinuar())}>
                {x.texto}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div className="proli-intro__accion" {...entrar} transition={{ delay: 1.25 }}>
          {!auto && <button type="button" className="boton boton--violeta boton--ancho" onClick={alContinuar}>{p.boton}</button>}
        </motion.div>
      </div>
    </div>
  )
}
