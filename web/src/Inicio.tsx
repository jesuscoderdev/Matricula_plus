/**
 * Entrada de la app: portada del stand → conozca a Proli → elegir proyecto (Matrícula+,
 * Movilidad+…) → proyecto.
 *
 *  ?proyecto=educacion|movilidad → entra directo a uno, sin portada (útil para el tótem)
 *  ?modo=auto sin ?proyecto      → portada, Proli, elegir proyecto y un recorrido de cada uno, en bucle
 *  ?modo=stand sin ?proyecto     → la inactividad vuelve a la portada (pantalla de atracción)
 *
 * Los datos de cada proyecto solo se cargan al entrar a él (cada proyecto es su propio módulo).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { EMPRESA, LEMA_EMPRESA, LLAMADO_INICIO, PROYECTOS, SEGUNDOS_INACTIVIDAD, SEGUNDOS_INICIO_AUTO, URL_CITA, URL_EMPRESA, type IdProyecto } from './config'
import { esTotem, leerModo, modoAutomatico, type Modo } from './modo'
import { BotonTema, LogoEmpresa, MarcaDeAgua, NombreApp } from './componentes/Marca'
import Proli from './componentes/Proli'
import Esqueleto from './componentes/Esqueleto'
import Qr from './componentes/Qr'
import App from './App'
import PortadaStand from './PortadaStand'
import ConozcaProli from './ConozcaProli'
import { informarPantalla, registrar } from './proli/ordenes'
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
  // Pantallas antes de los proyectos: portada → conozca a Proli → elegir proyecto.
  // Quien entra con ?proyecto= va directo, sin portada.
  const [etapa, setEtapa] = useState<'portada' | 'proli' | 'elegir'>(fijo ? 'elegir' : 'portada')
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
  const aPortada = useCallback(() => { setProyecto(null); setEtapa('portada') }, [])
  const aProli = useCallback(() => setEtapa('proli'), [])
  const aElegir = useCallback(() => setEtapa('elegir'), [])
  // Un pedido a Proli entra directo al demo; al salir de él se vuelve a elegir proyecto
  const aProyecto = useCallback((p: IdProyecto) => { setEtapa('elegir'); setProyecto(p) }, [])
  const alternar = modo === 'auto' && !fijo
  // Auto: al terminar el recorrido de un proyecto, la vuelta siguiente empieza en la portada
  const terminarVuelta = useCallback(() => { setTurno((t) => t + 1); aPortada() }, [aPortada])

  // Auto: unos segundos eligiendo proyecto y entra al que sigue
  useEffect(() => {
    if (!alternar || proyecto || etapa !== 'elegir') return
    const id = window.setTimeout(() => setProyecto(activos[turno % activos.length].id), SEGUNDOS_INICIO_AUTO * 1000)
    return () => window.clearTimeout(id)
  }, [alternar, proyecto, etapa, turno])

  // Tótem táctil: si nadie toca la pantalla (Proli o elegir proyecto), vuelve a la portada
  useEffect(() => {
    if (modo !== 'stand' || fijo || proyecto || etapa === 'portada') return
    let id = window.setTimeout(aPortada, SEGUNDOS_INACTIVIDAD * 1000)
    const alTocar = () => { window.clearTimeout(id); id = window.setTimeout(aPortada, SEGUNDOS_INACTIVIDAD * 1000) }
    window.addEventListener('pointerdown', alTocar)
    return () => { window.clearTimeout(id); window.removeEventListener('pointerdown', alTocar) }
  }, [modo, fijo, proyecto, etapa, aPortada])

  // Proli puede llevar al visitante a estas pantallas y abrir los demos (src/proli/ordenes.ts)
  useEffect(() => registrar('inicio', (o) => {
    if (o.nombre === 'ir_a_pantalla') {
      const destino = { portada: 'portada', conozca_a_proli: 'proli', elegir_demo: 'elegir' }[String(o.entrada.pantalla)] as typeof etapa | undefined
      if (!destino) return 'Pantalla no reconocida.'
      setProyecto(null); setEtapa(destino)
      return `Listo: el visitante está en ${destino === 'proli' ? 'Conozca a Proli' : destino === 'elegir' ? 'la página para elegir demo' : 'la portada'}.`
    }
    if (o.nombre === 'abrir_demo') {
      const demo = o.entrada.demo === 'matricula' ? 'educacion' : o.entrada.demo === 'movilidad' ? 'movilidad' : null
      if (!demo) return 'Demo no reconocido.'
      aProyecto(demo)
      return `Listo: se abrió ${demo === 'movilidad' ? 'Movilidad+' : 'Matrícula+'}.`
    }
    return 'Acción no reconocida.'
  }), [aProyecto])
  // Qué está viendo el visitante fuera de los demos (dentro, lo informa cada demo)
  useEffect(() => {
    if (proyecto) return
    informarPantalla(etapa === 'portada' ? 'portada del stand' : etapa === 'proli' ? 'Conozca a Proli' : 'página para elegir demo')
  }, [proyecto, etapa])

  const salidas = {
    alSalir: volver,
    // En el tótem, la inactividad dentro de un proyecto vuelve a la portada (pantalla de atracción)
    alInactivo: modo === 'stand' && !fijo ? aPortada : undefined,
    alTerminarVuelta: alternar ? terminarVuelta : undefined,
    // El logo de Proliferante lleva a la portada del stand (en todos los modos salvo el automático)
    alPortada: modo === 'auto' ? undefined : aPortada,
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
  if (etapa === 'portada') return <PortadaStand modo={modo} alContinuar={aProli} />
  if (etapa === 'proli') return <ConozcaProli modo={modo} alContinuar={aElegir} alElegir={aProyecto} alVolver={aPortada} />
  return <Hub modo={modo} entrar={setProyecto} alPortada={aPortada} siguiente={alternar ? activos[turno % activos.length].id : null} />
}

const entrar = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

function Hub({ modo, entrar: alEntrar, alPortada, siguiente }: { modo: Modo; entrar: (p: IdProyecto) => void; alPortada: () => void; siguiente: IdProyecto | null }) {
  const reducir = useReducedMotion()
  return (
    <div className="app inicio">
      <MarcaDeAgua className="marca-agua--inicio" />
      <div className="inicio__contenido">
        <motion.header className="inicio__marca" {...entrar} transition={{ delay: 0.05 }}>
          <LogoEmpresa alTocar={modo === 'auto' ? undefined : alPortada} />
          <span className="etiqueta">GovTech · 3–4 nov 2026</span>
          <BotonTema />
        </motion.header>
        <div className="inicio__cabeza">
          <motion.span className="kicker" {...entrar} transition={{ delay: 0.12 }}>Datos abiertos de Bogotá</motion.span>
          <motion.h1 className="display display--xl" {...entrar} transition={{ delay: 0.2 }}>
            ¿Qué quiere <em>explorar</em>?
          </motion.h1>
          <motion.p className="lead" {...entrar} transition={{ delay: 0.28 }}>
            Demostraciones de {EMPRESA} para decidir con datos públicos. <span className="acento">{modo === 'auto' ? 'Recorrido automático.' : 'Elija una para empezar.'}</span>
          </motion.p>
        </div>
        <div className="inicio__tarjetas">
          {PROYECTOS.map((p, i) => (
            <motion.button
              key={p.id}
              type="button"
              data-proli={`demo-${p.id === 'educacion' ? 'matricula' : p.id}`}
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
                <Proli tamano={5} lado={p.id === 'movilidad' ? 'derecha' : 'izquierda'} className="proyecto__proli"
                       globo={p.proximamente ? undefined : p.gancho} />
              </span>
              <span className="proyecto__texto">
                <span className="kicker">{p.area}</span>
                <NombreApp nombre={p.nombre} className="proyecto__nombre" />
                <span className="proyecto__pregunta">{p.pregunta}</span>
                <span className="proyecto__bajada">{p.bajada}</span>
                {(p.proximamente || siguiente === p.id || modo !== 'auto') && (
                  <span className="proyecto__entrar">{p.proximamente ? 'Próximamente' : siguiente === p.id ? 'Empieza en un momento' : p.cta}</span>
                )}
              </span>
              {siguiente === p.id && <span className="proyecto__progreso" style={{ ['--seg' as string]: `${SEGUNDOS_INICIO_AUTO}s` }} />}
            </motion.button>
          ))}
        </div>
        <motion.aside className="llamado" {...entrar} transition={{ delay: 0.6 }}>
          <div className="llamado__texto">
            <span className="kicker">{LLAMADO_INICIO.kicker}</span>
            <p className="llamado__titulo">{LLAMADO_INICIO.titulo}</p>
            <p className="nota">{LLAMADO_INICIO.texto}</p>
          </div>
          {URL_CITA && (esTotem(modo)
            ? <Qr texto={URL_CITA} etiqueta={<>Escanee para<br /><b>agendar una cita</b></>} />
            : <a className="boton boton--violeta" href={URL_CITA} target="_blank" rel="noopener noreferrer">{LLAMADO_INICIO.boton}</a>)}
        </motion.aside>
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
const PUNTOS = ['#5a44dd', '#505b7d', '#7bc689', '#aca2ee', '#7bc689', '#5a44dd', '#505b7d', '#aca2ee', '#5a44dd', '#7bc689']
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
