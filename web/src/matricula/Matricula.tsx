/**
 * Matrícula+ v2: «¿Y si el cupo no se diera por orden de llegada?». Sección propia: sus datos
 * (public/matricula/datos, de engine/reparto_v2.py) solo se leen aquí.
 *
 * Recorrido (guion del 27 de octubre): El problema → La solución → ¿Quién es quién? → Antes y
 * después → Mira tu localidad → Resultados → ¿Dónde faltan cupos? → Cómo se hizo → Fuentes → Tu reto.
 * Misma navegación que Movilidad+: secciones, ← Atrás (también el atrás del celular), logo que
 * reinicia, teclado en escritorio, recorrido solo en ?modo=auto.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { APP_NAME, DURACION_PASOS_MATRICULA, EMPRESA, LEMA_MATRICULA, LOCALIDAD_EJEMPLO_MATRICULA, SEGUNDOS_INACTIVIDAD, URL_EMPRESA } from '../config'
import { esTotem, leerModo, modoAutomatico, type Modo } from '../modo'
import { BotonTema, LogoReinicio, pulsoLogo } from '../componentes/Marca'
import Intro from '../componentes/Intro'
import Esqueleto from '../componentes/Esqueleto'
import { informarPantalla, registrar } from '../proli/ordenes'
import { recordado, recordar } from '../recordar'
import { NIVELES, cargarMatricula, entero, type DatosMatricula, type Nivel } from './datos'
import MapaMatricula from './MapaMatricula'
import {
  Antes, CAPITULOS_MAT, Como, Faltan, Fuentes, Localidad, PortadaMat, Prioridad, Problema, Reto, Resultados, SECCIONES_MAT, Solucion, seccionDe,
  type CapituloMat, type PropsMat, type VistaMat,
} from './Paneles'

const ORDEN: VistaMat[] = ['portada', ...CAPITULOS_MAT.map((c) => c.id)]

interface Recordado { vista: VistaMat; localidad: string | null; reparto: 'hoy' | 'despues'; nivel: Nivel | null }

export default function Matricula({ alSalir, alInactivo, alTerminarVuelta, alPortada }: {
  /** volver a la página de inicio (elegir proyecto) */
  alSalir?: () => void
  /** stand: sin interacción, a dónde volver (por defecto, a la portada) */
  alInactivo?: () => void
  /** auto: al terminar una vuelta (si no, empieza otra) */
  alTerminarVuelta?: () => void
  /** el logo de Proliferante lleva a la portada del stand */
  alPortada?: () => void
}) {
  const [modo, setModo] = useState<Modo>(leerModo)
  const [datos, setDatos] = useState<DatosMatricula | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  // Al recargar, donde iba el visitante (src/recordar.ts); al salir del demo se olvida
  const [antes] = useState(() => {
    const a = recordado<Recordado>('matricula')
    return a && CAPITULOS_MAT.some((c) => c.id === a.vista) ? a : null
  })
  const [intro, setIntro] = useState(!antes)
  const [vista, setVista] = useState<VistaMat>(antes?.vista ?? 'portada')
  const [localidad, setLocalidad] = useState<string | null>(antes?.localidad ?? null)
  const [reparto, setReparto] = useState<'hoy' | 'despues'>(antes?.reparto ?? 'despues')
  const [nivel, setNivel] = useState<Nivel | null>(antes?.nivel ?? null)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    setError(null)
    cargarMatricula().then(setDatos).catch((e) => setError(String(e.message ?? e)))
  }, [intento])
  useEffect(() => { recordar('matricula', { vista, localidad, reparto, nivel } satisfies Recordado) }, [vista, localidad, reparto, nivel])
  useEffect(() => () => recordar('matricula', null), [])
  useEffect(() => { document.documentElement.dataset.modo = modo }, [modo])
  useEffect(() => {
    if (!modoAutomatico()) return
    const alCambiar = () => setModo(leerModo())
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])

  const refPanel = useRef<HTMLElement>(null)
  useEffect(() => {
    refPanel.current?.scrollTo({ top: 0 })
    // Con seis secciones la barra se desplaza en el celular: la actual siempre a la vista
    document.querySelector('.capitulo--actual')?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [vista])
  // El logo late cuando algo cambia
  const primerPulso = useRef(true)
  useEffect(() => {
    if (primerPulso.current) { primerPulso.current = false; return }
    pulsoLogo()
  }, [vista, localidad, reparto, nivel])

  // Historial para "← Atrás"
  const pila = useRef<VistaMat[]>([])
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const reiniciar = useCallback(() => {
    pila.current = []
    setVista('portada'); setLocalidad(null); setReparto('despues'); setNivel(null)
  }, [])
  const ir = useCallback((v: VistaMat) => {
    if (v === 'portada') return reiniciar()
    if (vistaRef.current !== v) pila.current.push(vistaRef.current)
    // «¿Dónde faltan cupos?» empieza con toda Bogotá
    if (v === 'faltan' && vistaRef.current !== 'faltan') setLocalidad(null)
    setVista(v)
  }, [reiniciar])
  /** Un paso atrás: en «Mira tu localidad», primero suelta la localidad; en la portada, vuelve al inicio. */
  const atras = useCallback(() => {
    if (vista === 'portada') return alSalir?.()
    if (vista === 'localidad' && localidad) return setLocalidad(null)
    const i = ORDEN.indexOf(vista)
    setVista(pila.current.pop() ?? (i > 0 ? ORDEN[i - 1] : 'portada'))
  }, [vista, localidad, alSalir])
  const refAtras = useRef(atras)
  refAtras.current = atras
  useEffect(() => {
    if (esTotem(modo)) return
    history.pushState({ matricula: true }, '')
    const alVolver = () => {
      if (vistaRef.current === 'portada') return alSalir ? alSalir() : history.back()
      refAtras.current()
      history.pushState({ matricula: true }, '')
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [modo, alSalir])

  // Tocar una localidad en el mapa la elige y lleva a «Mira tu localidad» (salvo en «¿Dónde faltan cupos?»)
  const elegirLocalidad = useCallback((l: string | null) => {
    setLocalidad(l)
    if (l && vistaRef.current !== 'faltan' && vistaRef.current !== 'localidad') ir('localidad')
  }, [ir])

  // Proli puede mover este demo (src/proli/ordenes.ts). Se registra cuando ya hay datos, para poder
  // validar la localidad; las órdenes que llegaron mientras cargaba se aplican en ese momento.
  const refIr = useRef(ir)
  refIr.current = ir
  useEffect(() => {
    if (!datos) return
    return registrar('matricula', (o) => {
      const e = o.entrada
      switch (o.nombre) {
        case 'matricula_capitulo': {
          const v = String(e.capitulo) as VistaMat
          if (!ORDEN.includes(v)) return 'Capítulo no reconocido.'
          refIr.current(v)
          return `Listo: ${APP_NAME} muestra ${v === 'portada' ? 'su portada' : `la pantalla «${CAPITULOS_MAT.find((c) => c.id === v)!.nombre}»`}.`
        }
        case 'matricula_localidad': {
          if (e.localidad === 'TODA_BOGOTA') { setLocalidad(null); refIr.current('localidad'); return 'Listo: el mapa muestra toda Bogotá.' }
          const l = Object.keys(datos.r.por_localidad).find((x) => x.localeCompare(String(e.localidad), 'es', { sensitivity: 'base' }) === 0)
          if (!l) return `Localidad no reconocida en ${APP_NAME}.`
          const c = datos.r.por_localidad[l]
          setLocalidad(l); refIr.current('localidad')
          return `Listo: «Mira tu localidad» muestra ${l}: ${entero(c.lejos_antes)} niños lejos hoy y ${entero(c.lejos_despues)} con ${APP_NAME}.`
        }
        case 'matricula_reparto': {
          if (e.reparto !== 'hoy' && e.reparto !== 'despues') return 'Reparto no reconocido.'
          setReparto(e.reparto); refIr.current('antes')
          return `Listo: el mapa muestra los niños lejos ${e.reparto === 'hoy' ? 'con el reparto de hoy (orden de llegada)' : `con ${APP_NAME}`}.`
        }
        case 'matricula_nivel': {
          const n = NIVELES.find((k) => k.localeCompare(String(e.nivel), 'es', { sensitivity: 'base' }) === 0) ?? null
          if (e.nivel !== 'TODOS' && !n) return 'Nivel no reconocido.'
          setNivel(n); refIr.current('faltan')
          return `Listo: el mapa de «¿Dónde faltan cupos?» muestra ${n ? n.toLowerCase() : 'todos los niveles'}.`
        }
      }
      return `Acción no reconocida en ${APP_NAME}.`
    })
  }, [datos])
  // Qué está viendo el visitante (Proli lo recibe como contexto)
  useEffect(() => {
    if (!datos) return
    const cap = vista === 'portada' ? 'portada' : CAPITULOS_MAT.find((c) => c.id === vista)?.nombre ?? vista
    const extra = [
      localidad && (vista === 'localidad' || vista === 'faltan') ? `localidad ${localidad}` : '',
      vista === 'antes' ? `mapa ${reparto === 'hoy' ? 'de hoy (orden de llegada)' : `con ${APP_NAME}`}` : '',
      vista === 'faltan' ? `nivel ${nivel ?? 'todos'}` : '',
    ].filter(Boolean)
    informarPantalla(`${APP_NAME}, capítulo ${cap}${extra.map((x) => `, ${x}`).join('')}`)
  }, [datos, vista, localidad, reparto, nivel])

  // Kiosco táctil: sin interacción en N segundos, vuelve al inicio
  useEffect(() => {
    const volver = alInactivo ?? reiniciar
    if (modo !== 'stand' || (vista === 'portada' && !alInactivo)) return
    let id = window.setTimeout(volver, SEGUNDOS_INACTIVIDAD * 1000)
    const tocarPantalla = () => { window.clearTimeout(id); id = window.setTimeout(volver, SEGUNDOS_INACTIVIDAD * 1000) }
    window.addEventListener('pointerdown', tocarPantalla)
    return () => { window.clearTimeout(id); window.removeEventListener('pointerdown', tocarPantalla) }
  }, [modo, vista, reiniciar, alInactivo])

  // El tótem no abre menús contextuales ni hace zoom con gestos
  useEffect(() => {
    if (!esTotem(modo)) return
    const bloquear = (e: Event) => e.preventDefault()
    window.addEventListener('contextmenu', bloquear)
    window.addEventListener('gesturestart', bloquear)
    return () => { window.removeEventListener('contextmenu', bloquear); window.removeEventListener('gesturestart', bloquear) }
  }, [modo])

  // Modo automático: recorre las pantallas y "toca" lo que tocaría un visitante
  useEffect(() => {
    if (modo !== 'auto' || !datos || intro) return
    const timers: number[] = []
    const en = (s: number, f: () => void) => timers.push(window.setTimeout(f, s * 1000))
    if (vista === 'antes') { setReparto('hoy'); en(3, () => setReparto('despues')) }
    if (vista === 'localidad') {
      // El ejemplo acordado primero; en las vueltas siguientes, otra de las que más mejoran
      const mejoran = Object.entries(datos.r.por_localidad).sort((a, b) => (b[1].lejos_antes - b[1].lejos_despues) - (a[1].lejos_antes - a[1].lejos_despues)).map(([l]) => l)
      const lista = [LOCALIDAD_EJEMPLO_MATRICULA, ...mejoran.filter((l) => l !== LOCALIDAD_EJEMPLO_MATRICULA)].slice(0, 4)
      setLocalidad(null); en(1.5, () => setLocalidad(lista[vuelta % lista.length]))
    }
    if (vista === 'faltan') { setLocalidad(null); setNivel(null); NIVELES.forEach((k, j) => en(2.5 + 2 * j, () => setNivel(k))) }
    en(DURACION_PASOS_MATRICULA[vista], () => {
      const sig = ORDEN[(ORDEN.indexOf(vista) + 1) % ORDEN.length]
      if (sig !== 'portada') return setVista(sig)
      if (alTerminarVuelta) return alTerminarVuelta()
      setVuelta((x) => x + 1); reiniciar()
    })
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [modo, vista, datos, vuelta, intro, reiniciar, alTerminarVuelta])

  // Modo presentación (PC): flechas para avanzar/retroceder, F pantalla completa
  useEffect(() => {
    if (modo !== 'escritorio') return
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const i = ORDEN.indexOf(vista)
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); ir(ORDEN[Math.min(ORDEN.length - 1, i + 1)]) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); if (i > 0) ir(ORDEN[i - 1]) }
      else if (e.key === 'Home') ir('portada')
      else if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) document.exitFullscreen?.()
        else document.documentElement.requestFullscreen?.().catch(() => {})
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [modo, vista, ir])

  const propsMapa = useMemo((): Omit<ComponentProps<typeof MapaMatricula>, 'datos'> => {
    const interactivo = modo !== 'auto' && vista !== 'portada'
    // La localidad elegida solo acerca el mapa donde se habla de ella; en las demás se ve toda Bogotá
    const lugar = { localidad: vista === 'localidad' || vista === 'faltan' ? localidad : null, onLocalidad: interactivo ? elegirLocalidad : undefined, interactivo }
    switch (vista) {
      case 'portada': {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
        return { capa: 'hoy', interactivo: false, respirar: true, leyenda: false,
          margen: modo === 'escritorio' ? { izquierda: Math.min(window.innerWidth * 0.46, 44 * rem), arriba: window.innerHeight * 0.05, abajo: window.innerHeight * 0.05 }
            : { arriba: window.innerHeight * 0.4, abajo: window.innerHeight * 0.2 } }
      }
      case 'prioridad': return { ...lugar, capa: 'prioridad' }
      case 'antes': return { ...lugar, capa: reparto }
      case 'localidad': case 'resultados': return { ...lugar, capa: 'despues' }
      case 'faltan': return { ...lugar, capa: 'faltan', nivel }
      default: return { ...lugar, capa: 'hoy' }
    }
  }, [vista, modo, localidad, elegirLocalidad, reparto, nivel])

  const entrada = intro && <Intro alTerminar={() => setIntro(false)} nombre={APP_NAME} lema={LEMA_MATRICULA} />
  if (error || !datos) {
    return (
      <div className="app">
        <Esqueleto error={error} reintentar={() => setIntento((x) => x + 1)} nombre={APP_NAME} variante="tinta" estado="Cargando cupos escolares de Bogotá" />
        {entrada}
      </div>
    )
  }

  const props: PropsMat = { datos, modo, ir, localidad, setLocalidad, reparto, setReparto, nivel, setNivel, alInicio: alSalir, alPortada }
  const panel = (() => {
    switch (vista) {
      case 'problema': return <Problema {...props} />
      case 'solucion': return <Solucion {...props} />
      case 'prioridad': return <Prioridad {...props} />
      case 'antes': return <Antes {...props} />
      case 'localidad': return <Localidad {...props} />
      case 'resultados': return <Resultados {...props} />
      case 'faltan': return <Faltan {...props} />
      case 'como': return <Como {...props} />
      case 'fuentes': return <Fuentes {...props} />
      case 'reto': return <Reto {...props} />
      default: return null
    }
  })()
  const iActual = vista === 'portada' ? -1 : seccionDe(vista)
  const s = datos.r.simulacion

  return (
    <div className="app app--matricula">
      {vista !== 'portada' && (
        <header className="cabecera">
          {modo !== 'auto' && (
            <button type="button" className="boton-tema boton-atras" onClick={atras} title="Atrás" aria-label="Atrás">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
          )}
          <LogoReinicio alReiniciar={reiniciar} alReiniciarTodo={alSalir} nombre={APP_NAME} />
          <nav className="capitulos" aria-label="Secciones">
            {/* Cada botón lleva a la primera pantalla de su sección (Proli las señala por cualquiera de ellas) */}
            {SECCIONES_MAT.map((c, i) => (
              <button key={c.nombre} disabled={modo === 'auto'} onClick={() => ir(c.vistas[0] as CapituloMat)} data-proli={c.vistas.map((v) => `cap-${v}`).join(' ')}
                      className={`capitulo ${i === iActual ? 'capitulo--actual' : iActual > i ? 'capitulo--hecho' : ''}`}>
                <span className="capitulo__n">{String(i + 1).padStart(2, '0')}</span><span className="capitulo__nombre">{c.nombre}</span>
              </button>
            ))}
          </nav>
          <BotonTema />
        </header>
      )}

      <div className={`escena ${vista === 'portada' ? 'escena--portada' : ''} ${vista === 'localidad' || vista === 'faltan' ? 'escena--mapa-grande' : ''}`}>
        <div className="escena__mapa">
          <MapaMatricula datos={datos} {...propsMapa}>
            {/* Antes y después: el reparto se cambia sobre el mismo mapa */}
            {vista === 'antes' && modo !== 'auto' && (
              <div className="segmentos mapa__anio" role="group" aria-label="Reparto en el mapa">
                <button data-proli="reparto-hoy" className={`segmento ${reparto === 'hoy' ? 'segmento--activo' : ''}`} onClick={() => setReparto('hoy')}>Hoy</button>
                <button data-proli="reparto-despues" className={`segmento ${reparto === 'despues' ? 'segmento--activo' : ''}`} onClick={() => setReparto('despues')}>Con {APP_NAME}</button>
              </div>
            )}
          </MapaMatricula>
        </div>
        {vista !== 'portada' && (
          <section className="escena__panel" ref={refPanel}>
            <AnimatePresence mode="wait">
              <motion.div key={vista} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.22 }} style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
                {panel}
              </motion.div>
            </AnimatePresence>
          </section>
        )}
        {vista === 'portada' && (
          <div className="portada" onClick={modo === 'stand' ? () => ir('problema') : undefined}>
            <div className="portada__velo" />
            <PortadaMat {...props} />
          </div>
        )}
      </div>

      <footer className="pie">
        <span className="pie__marca">{esTotem(modo) ? EMPRESA : <a href={URL_EMPRESA} target="_blank" rel="noopener noreferrer">{EMPRESA} ↗</a>} · GovTech 2026</span>
        <span>Simulación con datos abiertos de la Secretaría de Educación y Planeación · {entero(s.ninos)} niños recreados en grupos de {datos.r.ninos_por_grupo_simulado} ·
          distancia en línea recta · sin datos personales · modelo {datos.r.version}</span>
        {modo === 'escritorio' && <span className="atajos"><kbd>←</kbd> <kbd>→</kbd> pantallas · <kbd>F</kbd> pantalla completa</span>}
      </footer>
      {entrada}
    </div>
  )
}
