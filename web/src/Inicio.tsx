/**
 * Página de inicio: elegir proyecto (Matrícula+, Movilidad+…). Es la primera pantalla.
 *
 *  ?proyecto=educacion|movilidad → entra directo a uno (útil para el tótem)
 *  ?modo=auto sin ?proyecto      → alterna los proyectos: un recorrido de cada uno y vuelve aquí
 *  ?modo=stand sin ?proyecto     → la inactividad vuelve aquí
 *
 * Los datos de cada proyecto solo se cargan al entrar a él (cada proyecto es su propio módulo).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { EMPRESA, LEMA_EMPRESA, PROYECTOS, SEGUNDOS_INICIO_AUTO, URL_EMPRESA, type IdProyecto } from './config'
import { esTotem, leerModo, modoAutomatico, type Modo } from './modo'
import { BotonTema, IconoApp, LogoEmpresa, NombreApp } from './componentes/Marca'
import Esqueleto from './componentes/Esqueleto'
import Qr from './componentes/Qr'
import App from './App'
import faviconProliferante from './assets/favicon-proliferante.png'
import faviconMatricula from './assets/favicon-matricula.png'
import faviconMovilidad from './assets/favicon-movilidad.png'

// Movilidad+ se descarga aparte, solo si se entra a ella
const Movilidad = lazy(() => import('./movilidad/Movilidad'))

const activos = PROYECTOS.filter((p) => !p.proximamente)
const pedido = (): IdProyecto | null => {
  const p = new URLSearchParams(window.location.search).get('proyecto')
  return activos.some((x) => x.id === p) ? (p as IdProyecto) : null
}

export default function Inicio() {
  const fijo = useMemo(pedido, [])
  const [proyecto, setProyecto] = useState<IdProyecto | null>(fijo)
  const [modo, setModo] = useState<Modo>(leerModo)
  const [turno, setTurno] = useState(0)   // auto: qué proyecto sigue

  useEffect(() => { if (!proyecto) document.documentElement.dataset.modo = modo }, [modo, proyecto])
  // La pestaña dice dónde estás: la «o» de Proliferante en el inicio y el icono de cada proyecto dentro
  useEffect(() => {
    const p = PROYECTOS.find((x) => x.id === proyecto)
    const icono = proyecto === 'educacion' ? faviconMatricula : proyecto === 'movilidad' ? faviconMovilidad : faviconProliferante
    document.querySelector('link[rel="icon"]')?.setAttribute('href', icono)
    document.title = p ? `${p.nombre} · ${p.pregunta}` : `${EMPRESA} · ${PROYECTOS.filter((x) => !x.proximamente).map((x) => x.nombre).join(' y ')}`
  }, [proyecto])
  useEffect(() => {
    if (!modoAutomatico()) return
    const alCambiar = () => setModo(leerModo())
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])

  const volver = useCallback(() => setProyecto(null), [])
  const alternar = modo === 'auto' && !fijo
  const terminarVuelta = useCallback(() => { setTurno((t) => t + 1); setProyecto(null) }, [])

  // Auto: unos segundos aquí y entra al proyecto que sigue
  useEffect(() => {
    if (!alternar || proyecto) return
    const id = window.setTimeout(() => setProyecto(activos[turno % activos.length].id), SEGUNDOS_INICIO_AUTO * 1000)
    return () => window.clearTimeout(id)
  }, [alternar, proyecto, turno])

  const salidas = {
    alSalir: volver,
    alInactivo: modo === 'stand' && !fijo ? volver : undefined,
    alTerminarVuelta: alternar ? terminarVuelta : undefined,
  }
  if (proyecto === 'educacion') return <App {...salidas} />
  if (proyecto === 'movilidad') {
    const p = PROYECTOS.find((x) => x.id === 'movilidad')!
    return (
      <Suspense fallback={<div className="app"><Esqueleto nombre={p.nombre} variante={p.variante} estado="Cargando" /></div>}>
        <Movilidad {...salidas} />
      </Suspense>
    )
  }
  return <Hub modo={modo} entrar={setProyecto} siguiente={alternar ? activos[turno % activos.length].id : null} />
}

const entrar = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

function Hub({ modo, entrar: alEntrar, siguiente }: { modo: Modo; entrar: (p: IdProyecto) => void; siguiente: IdProyecto | null }) {
  const reducir = useReducedMotion()
  return (
    <div className="app inicio">
      <div className="inicio__contenido">
        <motion.header className="inicio__marca" {...entrar} transition={{ delay: 0.05 }}>
          <LogoEmpresa />
          <span className="etiqueta">GovTech · 3–4 nov 2026</span>
          <BotonTema />
        </motion.header>
        <div className="inicio__cabeza">
          <motion.span className="kicker" {...entrar} transition={{ delay: 0.12 }}>Datos abiertos de Bogotá</motion.span>
          <motion.h1 className="display display--xl" {...entrar} transition={{ delay: 0.2 }}>
            ¿Qué quiere <em>explorar</em>?
          </motion.h1>
          <motion.p className="lead" {...entrar} transition={{ delay: 0.28 }}>
            Demostraciones de {EMPRESA} para decidir con datos públicos. {modo === 'auto' ? 'Recorrido automático.' : 'Elija una para empezar.'}
          </motion.p>
        </div>
        <div className="inicio__tarjetas">
          {PROYECTOS.map((p, i) => (
            <motion.button
              key={p.id}
              type="button"
              className={`proyecto proyecto--${p.variante} ${p.proximamente ? 'proyecto--pronto' : ''} ${siguiente === p.id ? 'proyecto--siguiente' : ''}`}
              disabled={p.proximamente || modo === 'auto'}
              onClick={() => alEntrar(p.id)}
              initial={{ opacity: 0, y: 28, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.12, type: 'spring', stiffness: 170, damping: 20 }}
              whileHover={reducir || p.proximamente ? undefined : { y: -5 }}
              whileTap={p.proximamente ? undefined : { scale: 0.985 }}
            >
              <span className="proyecto__arte" aria-hidden>
                {p.id === 'movilidad' ? <ArteHexagonos /> : <ArteFamilias />}
                <IconoApp nombre={p.nombre} letra={p.letra} variante={p.variante} className="proyecto__icono" />
              </span>
              <span className="proyecto__texto">
                <span className="kicker">{p.area}</span>
                <NombreApp nombre={p.nombre} className="proyecto__nombre" />
                <span className="proyecto__pregunta">{p.pregunta}</span>
                <span className="proyecto__bajada">{p.bajada}</span>
                {(p.proximamente || siguiente === p.id || modo !== 'auto') && (
                  <span className="proyecto__entrar">{p.proximamente ? 'Próximamente' : siguiente === p.id ? 'Empieza en un momento' : 'Entrar →'}</span>
                )}
              </span>
              {siguiente === p.id && <span className="proyecto__progreso" style={{ ['--seg' as string]: `${SEGUNDOS_INICIO_AUTO}s` }} />}
            </motion.button>
          ))}
        </div>
      </div>
      <PieEmpresa modo={modo} />
    </div>
  )
}

/**
 * Footer del inicio: quién está detrás y cómo encontrarlo. En celular y PC, enlace a la web de
 * Proliferante (otra pestaña); en el tótem, un QR, porque un enlace sacaría a la gente de la app.
 */
function PieEmpresa({ modo }: { modo: Modo }) {
  const dominio = URL_EMPRESA.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <footer className="pie-empresa">
      <div className="pie-empresa__marca">
        <LogoEmpresa animado={false} />
        <span>{LEMA_EMPRESA}</span>
      </div>
      <span className="pie-empresa__datos">GovTech 2026 · Bogotá · datos abiertos · funciona sin internet</span>
      {esTotem(modo)
        ? <Qr texto={URL_EMPRESA} etiqueta={<>Conoce {EMPRESA}<br /><b>{dominio}</b></>} />
        : <a className="pie-empresa__enlace" href={URL_EMPRESA} target="_blank" rel="noopener noreferrer">Conoce {EMPRESA} · <b>{dominio}</b> ↗</a>}
    </footer>
  )
}

// Puntos que llegan al icono (como la pantalla de carga de Matrícula+)
const PUNTOS = ['#7f45ee', '#268484', '#e0662a', '#a88cf0', '#8bc68e', '#7f45ee', '#268484', '#a88cf0', '#7f45ee', '#e0662a']
function ArteFamilias() {
  return (
    <span className="arte-familias">
      <span className="arte-familias__orbita" /><span className="arte-familias__orbita arte-familias__orbita--2" />
      {PUNTOS.map((c, i) => (
        <i key={i} style={{ '--a': `${i * 36 + 10}deg`, '--d': `${(i * 0.37) % 2.8}s`, '--c': c } as CSSProperties} />
      ))}
    </span>
  )
}

// Panal de hexágonos con tonos de una sola escala violeta (decorativo, sin datos)
const COLS = 15, FILAS = 7
const HEX = Array.from({ length: COLS * FILAS }, (_, j) => {
  const c = j % COLS, f = Math.floor(j / COLS)
  const h = Math.abs(Math.sin(c * 12.9898 + f * 78.233) * 43758.5453) % 1
  return { c, f, tono: h < 0.45 ? 0 : h < 0.75 ? 1 : h < 0.92 ? 2 : 3, late: h > 0.94 }
})
function ArteHexagonos() {
  const r = 10, w = Math.sqrt(3) * r
  return (
    <svg className="arte-hex" viewBox={`0 0 ${COLS * w + w / 2} ${FILAS * 1.5 * r + r / 2}`} preserveAspectRatio="xMidYMid slice">
      {HEX.map(({ c, f, tono, late }, j) => {
        const x = c * w + (f % 2 ? w / 2 : 0) + w / 2, y = f * 1.5 * r + r
        const puntos = Array.from({ length: 6 }, (_, k) => {
          const a = (Math.PI / 3) * k + Math.PI / 6
          return `${(x + 0.92 * r * Math.cos(a)).toFixed(2)},${(y + 0.92 * r * Math.sin(a)).toFixed(2)}`
        }).join(' ')
        // Una onda recorre el panal en diagonal; algunos hexágonos además laten a su ritmo
        return <polygon key={j} points={puntos} className={`arte-hex__h arte-hex__h--${tono} ${late ? 'arte-hex__h--late' : ''}`}
                        style={{ '--onda': `${((c + f * 0.6) * 0.2).toFixed(2)}s`, '--late': `${(j % 7) * 0.4}s` } as CSSProperties} />
      })}
    </svg>
  )
}
