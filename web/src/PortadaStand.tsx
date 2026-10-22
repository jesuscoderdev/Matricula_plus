/**
 * Portada del stand: la primera pantalla. Es la pantalla de atracción del tótem (se lee desde lejos)
 * y la puerta de entrada en celular y PC. Toda la pantalla es el botón: tocar en cualquier parte
 * entra a elegir proyecto.
 *
 * Fondo navy con letras blancas y foco verde, como la portada del manual de marca («blanco sobre
 * navy»); el logo va en su versión blanca con la «o» verde. Es igual en tema claro y oscuro.
 * Los textos se cambian en config.ts (PORTADA_STAND).
 */
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { PORTADA_STAND, SEGUNDOS_PORTADA_AUTO } from './config'
import { esTotem, type Modo } from './modo'
import { LogoEmpresa, MarcaDeAgua } from './componentes/Marca'
import Proli from './componentes/Proli'

const entrar = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } }

/** "texto [resaltado] texto" → el tramo entre corchetes va en la segunda voz del titular. */
function conResaltado(texto: string) {
  const m = texto.match(/^(.*)\[(.*)\](.*)$/)
  return m ? <>{m[1]}<em>{m[2]}</em>{m[3]}</> : texto
}

export default function PortadaStand({ modo, alContinuar }: { modo: Modo; alContinuar: () => void }) {
  const p = PORTADA_STAND
  const totem = esTotem(modo)

  // Modo automático: se queda unos segundos y sigue solo
  useEffect(() => {
    if (modo !== 'auto') return
    const id = window.setTimeout(alContinuar, SEGUNDOS_PORTADA_AUTO * 1000)
    return () => window.clearTimeout(id)
  }, [modo, alContinuar])

  return (
    // En el tótem toda la pantalla es el botón; en celular y PC también se puede tocar en cualquier
    // parte, pero el botón «Empezar» es el control accesible (sin anidar un botón dentro de otro)
    <div className="app portada-stand"
         {...(modo === 'stand' ? { role: 'button', tabIndex: 0, 'aria-label': p.tocar } : {})}
         onClick={modo === 'auto' ? undefined : alContinuar}
         onKeyDown={(e) => { if (modo === 'stand' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); alContinuar() } }}>
      <MarcaDeAgua className="marca-agua--portada-stand" />
      <span className="portada-stand__brillo" aria-hidden />

      <div className="portada-stand__contenido">
        <motion.header className="portada-stand__marca" {...entrar} transition={{ delay: 0.05 }}>
          <LogoEmpresa />
          <span className="portada-stand__evento">{p.evento}</span>
        </motion.header>

        <div className="portada-stand__cabeza">
          <motion.span className="kicker" {...entrar} transition={{ delay: 0.15 }}>{p.kicker}</motion.span>
          <motion.h1 className="display display--xl portada-stand__pregunta" {...entrar} transition={{ delay: 0.25 }}>
            {conResaltado(p.pregunta)}
          </motion.h1>
          <motion.p className="lead portada-stand__bajada" {...entrar} transition={{ delay: 0.35 }}>{p.bajada}</motion.p>
        </div>

        <motion.div className="portada-stand__proli" {...entrar} transition={{ delay: 0.5 }}>
          <Proli tamano={totem ? 9 : 8} lado="izquierda" globo={p.proli} />
        </motion.div>

        <motion.div className="portada-stand__eslogan" {...entrar} transition={{ delay: 0.65 }}>
          <p className="portada-stand__frase">{p.eslogan}</p>
          <p className="acento">{p.acento}</p>
        </motion.div>

        <motion.div className="portada-stand__accion" {...entrar} transition={{ delay: 0.8 }}>
          {totem
            ? modo === 'stand' && <span className="portada-stand__tocar"><i aria-hidden />{p.tocar}</span>
            : <button type="button" className="boton portada-stand__boton boton--latir"
                      onClick={(e) => { e.stopPropagation(); alContinuar() }}>{p.boton}</button>}
        </motion.div>
      </div>
    </div>
  )
}
