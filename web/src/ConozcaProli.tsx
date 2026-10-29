/**
 * Conoce a Proli: la segunda pantalla (documento de Paola, 29-oct). Proli arriba, con su saludo
 * escrito letra por letra; debajo, una frase y el botón a los retos. Nada más.
 *
 * Sigue el tema de la app (claro u oscuro): tras la portada navy, el cambio de fondo marca que el
 * visitante ya entró. Textos en config.ts (PROLI_INTRO).
 */
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { PROLI_INTRO, SEGUNDOS_PROLI_AUTO } from './config'
import { esTotem, type Modo } from './modo'
import { BotonInicio, BotonTema, LogoEmpresa, MarcaDeAgua } from './componentes/Marca'
import ProliAnimado from './componentes/ProliAnimado'

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

export default function ConozcaProli({ modo, alContinuar, alVolver }: {
  modo: Modo
  /** a elegir proyecto */
  alContinuar: () => void
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
          {!auto && <BotonInicio alInicio={alVolver} etiqueta="Volver a la portada" />}
          <LogoEmpresa alTocar={auto ? undefined : alVolver} />
          {!esTotem(modo) && <BotonTema />}
        </motion.header>

        <div className="proli-intro__heroe">
          <motion.div className="proli-intro__figura" initial={{ opacity: 0, scale: 0.6, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 13, delay: 0.1 }}>
            <span className="proli-intro__halo" aria-hidden />
            {/* Proli mueve la boca mientras «escribe» su saludo */}
            <span className="proli-intro__img">
              <ProliAnimado hablando={!escrito} saludar={!escrito} seguir />
            </span>
          </motion.div>
          <motion.div className="proli-intro__globo" {...entrar} transition={{ delay: 0.5 }} aria-label={p.saludo}>
            <span aria-hidden>«{saludo}{escrito ? '»' : <i className="proli-intro__cursor" />}</span>
          </motion.div>
        </div>

        <div className="proli-intro__presenta">
          <motion.h1 className="display display--xl proli-intro__nombre" {...entrar} transition={{ delay: 0.32 }}>
            Hola, soy <em>{p.nombre}</em>
          </motion.h1>
          <motion.p className="lead proli-intro__texto" {...entrar} transition={{ delay: 0.4 }}>{p.texto}</motion.p>
        </div>

        <motion.div className="proli-intro__accion" {...entrar} transition={{ delay: 1.25 }}>
          {!auto && <button type="button" className="boton boton--violeta boton--ancho proli-intro__boton" onClick={alContinuar}>{p.boton}</button>}
        </motion.div>
      </div>
    </div>
  )
}
