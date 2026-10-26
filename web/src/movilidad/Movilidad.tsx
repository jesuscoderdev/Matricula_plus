/**
 * Movilidad+: «Con este presupuesto, ¿dónde se evitan más siniestros graves?», con enfoque en las
 * calles de barrio. Sección propia: sus datos (public/movilidad/datos) solo se leen aquí.
 *
 * Recorrido: Tú decides (toca esquinas) → Pasó un año → El giro → El método → Presupuesto →
 * Fuentes → Hablemos. Misma navegación que Matrícula+: capítulos, ← Atrás (también el atrás del
 * celular), logo que reinicia, teclado en escritorio, recorrido solo en ?modo=auto.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DURACION_PASOS_MOVILIDAD, EMPRESA, ESQUINAS_A_TOCAR, LEMA_MOVILIDAD, NOMBRE_MOVILIDAD, SEGUNDOS_INACTIVIDAD, URL_EMPRESA } from '../config'
import { esTotem, leerModo, modoAutomatico, type Modo } from '../modo'
import { BotonTema, LogoReinicio, pulsoLogo } from '../componentes/Marca'
import Intro from '../componentes/Intro'
import Esqueleto from '../componentes/Esqueleto'
import { cargarMovilidad, esquinasCon, nombreLocalidad, type Bbox, type DatosMovilidad, type Nivel } from './datos'
import { informarPantalla, registrar } from '../proli/ordenes'
import MapaMovilidad from './MapaMovilidad'
import {
  Anio, CAPITULOS_MOV, Cierre, Decide, Evaluar, Fuentes, Giro, Metodo, PortadaMov, Presupuesto, numeroMov, tamanoHex,
  type CapituloMov, type PropsMov, type VistaMov,
} from './Paneles'

const ORDEN: VistaMov[] = ['portada', ...CAPITULOS_MOV.map((c) => c.id)]

export default function Movilidad({ alSalir, alInactivo, alTerminarVuelta, alPortada }: {
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
  const [datos, setDatos] = useState<DatosMovilidad | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [intro, setIntro] = useState(true)
  const [vista, setVista] = useState<VistaMov>('portada')
  const [tocadas, setTocadas] = useState<number[]>([])
  const [localidad, setLocalidad] = useState<number | null>(null)
  const [anio, setAnio] = useState<'k24' | 'k25'>('k25')
  // Presupuesto en millones; null = el primer monto de referencia (sale de los datos)
  const [montoElegido, setMonto] = useState<number | null>(null)
  const monto = montoElegido ?? datos?.experiencia.pantalla_presupuesto_barrio.escenarios.bajo.presupuesto_millones ?? 0
  const [zona, setZona] = useState<'barrio' | 'avenidas'>('barrio')
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    setError(null)
    cargarMovilidad().then(setDatos).catch((e) => setError(String(e.message ?? e)))
  }, [intento])
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
    // Con 7 capítulos la barra se desplaza: el actual siempre a la vista
    document.querySelector('.capitulo--actual')?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [vista])
  // El logo late cuando algo cambia
  const primerPulso = useRef(true)
  useEffect(() => {
    if (primerPulso.current) { primerPulso.current = false; return }
    pulsoLogo()
  }, [vista, localidad, tocadas.length])

  // Historial para "← Atrás"
  const pila = useRef<VistaMov[]>([])
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const reiniciar = useCallback(() => {
    pila.current = []
    setVista('portada'); setTocadas([]); setLocalidad(null); setAnio('k25'); setMonto(null); setZona('barrio')
  }, [])
  const ir = useCallback((v: VistaMov) => {
    if (v === 'portada') return reiniciar()
    if (vistaRef.current !== v) pila.current.push(vistaRef.current)
    setVista(v)
  }, [reiniciar])
  /** Un paso atrás: primero quita la última esquina tocada; en la portada, vuelve al inicio. */
  const atras = useCallback(() => {
    if (vista === 'portada') return alSalir?.()
    if (vista === 'decide' && tocadas.length) return setTocadas((t) => t.slice(0, -1))
    const i = ORDEN.indexOf(vista)
    setVista(pila.current.pop() ?? (i > 0 ? ORDEN[i - 1] : 'portada'))
  }, [vista, tocadas.length, alSalir])
  const refAtras = useRef(atras)
  refAtras.current = atras
  useEffect(() => {
    if (esTotem(modo)) return
    history.pushState({ movilidad: true }, '')
    const alVolver = () => {
      if (vistaRef.current === 'portada') return alSalir ? alSalir() : history.back()
      refAtras.current()
      history.pushState({ movilidad: true }, '')
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [modo, alSalir])

  // Proli puede mover este demo (src/proli/ordenes.ts). Se registra cuando ya hay datos, para poder
  // validar la localidad; las órdenes que llegaron mientras cargaba se aplican en ese momento.
  const refIr = useRef(ir)
  refIr.current = ir
  useEffect(() => {
    if (!datos) return
    return registrar('movilidad', (o) => {
      const e = o.entrada
      switch (o.nombre) {
        case 'movilidad_capitulo': {
          const v = String(e.capitulo) as VistaMov
          if (!ORDEN.includes(v)) return 'Capítulo no reconocido.'
          refIr.current(v)
          return `Listo: Movilidad+ muestra ${v === 'portada' ? 'su portada' : `el capítulo ${CAPITULOS_MOV.find((c) => c.id === v)!.nombre}`}.`
        }
        case 'movilidad_localidad': {
          if (e.localidad === 'TODA_BOGOTA') { setLocalidad(null); refIr.current('decide'); return 'Listo: el mapa muestra toda Bogotá.' }
          const i = datos.sitios.localidades.indexOf(String(e.localidad))
          if (i < 0) return 'Localidad no reconocida en Movilidad+.'
          setLocalidad(i); refIr.current('decide')
          return `Listo: el mapa de «Tú decides» se acercó a ${nombreLocalidad(datos.sitios.localidades[i])}.`
        }
        case 'movilidad_presupuesto': {
          const n = String(e.nivel) as Nivel
          const esc = datos.experiencia.pantalla_presupuesto_barrio.escenarios
          if (!(n in esc)) return 'Nivel de presupuesto no reconocido.'
          setMonto(esc[n].presupuesto_millones); refIr.current('presupuesto')
          return `Listo: el capítulo Presupuesto muestra $${esc[n].presupuesto_millones} millones.`
        }
        case 'movilidad_tipo_via': {
          if (e.zona !== 'barrio' && e.zona !== 'avenidas') return 'Tipo de vía no reconocido.'
          setZona(e.zona); refIr.current('metodo')
          return `Listo: El método muestra la comparación en ${e.zona === 'barrio' ? 'calles de barrio' : 'avenidas'}.`
        }
        case 'movilidad_anio_mapa': {
          if (e.anio !== '2024' && e.anio !== '2025') return 'Año no reconocido.'
          setAnio(e.anio === '2024' ? 'k24' : 'k25'); refIr.current('anio')
          return `Listo: Pasó un año muestra el mapa de ${e.anio}.`
        }
      }
      return 'Acción no reconocida en Movilidad+.'
    })
  }, [datos])
  // Qué está viendo el visitante (Proli lo recibe como contexto)
  useEffect(() => {
    if (!datos) return
    const cap = vista === 'portada' ? 'portada' : CAPITULOS_MOV.find((c) => c.id === vista)?.nombre ?? vista
    const extra = vista === 'decide' && localidad != null ? `, mapa acercado a ${nombreLocalidad(datos.sitios.localidades[localidad])}`
      : vista === 'presupuesto' ? `, presupuesto de $${monto} millones`
        : vista === 'metodo' ? `, comparación en ${zona === 'barrio' ? 'calles de barrio' : 'avenidas'}`
          : vista === 'decide' || vista === 'anio' ? `, ${tocadas.length} esquinas tocadas` : ''
    informarPantalla(`Movilidad+, capítulo ${cap}${extra}`)
  }, [datos, vista, localidad, monto, zona, tocadas.length])

  // Tocar una esquina: se agrega (o se quita si ya estaba); con todas, la más vieja sale
  const tocar = useCallback((i: number) => {
    setTocadas((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i].slice(-ESQUINAS_A_TOCAR)))
  }, [])

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

  // Modo automático: recorre los capítulos y "toca" lo que tocaría un visitante
  useEffect(() => {
    if (modo !== 'auto' || !datos || intro) return
    const timers: number[] = []
    const en = (s: number, f: () => void) => timers.push(window.setTimeout(f, s * 1000))
    if (vista === 'decide') {
      // En cada vuelta, otras tres de las peores esquinas de barrio
      const p = datos.peores
      for (let j = 0; j < ESQUINAS_A_TOCAR; j++) en(2.5 + 2 * j, () => tocar(p[(vuelta * ESQUINAS_A_TOCAR + j * 7) % p.length]))
    }
    if (vista === 'anio') { setAnio('k24'); en(3, () => setAnio('k25')) }
    if (vista === 'presupuesto') {
      const esc = datos.experiencia.pantalla_presupuesto_barrio.escenarios
      en(4, () => setMonto(esc.medio.presupuesto_millones)); en(7.5, () => setMonto(esc.alto.presupuesto_millones))
    }
    en(DURACION_PASOS_MOVILIDAD[vista], () => {
      const sig = ORDEN[(ORDEN.indexOf(vista) + 1) % ORDEN.length]
      if (sig !== 'portada') return setVista(sig)
      if (alTerminarVuelta) return alTerminarVuelta()
      setVuelta((x) => x + 1); reiniciar()
    })
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [modo, vista, datos, vuelta, intro, tocar, reiniciar, alTerminarVuelta])

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

  // Encuadre de "Pasó un año": las esquinas tocadas (si hay)
  const encuadreTocadas = useMemo((): Bbox | null => {
    if (!datos || !tocadas.length) return null
    const s = datos.sitios, m = 0.012
    const xs = tocadas.map((i) => s.lon[i]), ys = tocadas.map((i) => s.lat[i])
    return [[Math.min(...xs) - m, Math.min(...ys) - m * 0.8], [Math.max(...xs) + m, Math.max(...ys) + m * 0.8]]
  }, [datos, tocadas])

  const propsMapa = useMemo((): Omit<ComponentProps<typeof MapaMovilidad>, 'datos'> => {
    const interactivo = modo !== 'auto' && vista !== 'portada'
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
    switch (vista) {
      case 'portada':
        return { capa: 'k24', interactivo: false, respirar: true, leyenda: false, agrupar: true,
          margen: modo === 'escritorio' ? { izquierda: Math.min(window.innerWidth * 0.46, 44 * rem), arriba: window.innerHeight * 0.05, abajo: window.innerHeight * 0.05 }
            : { arriba: window.innerHeight * 0.4, abajo: window.innerHeight * 0.2 } }
      case 'decide':
        return { capa: 'k24', interactivo, localidad, tocadas, onTocar: modo === 'auto' ? undefined : tocar, croquis: true,
          // Un respiro alrededor de la localidad: que el límite completo quede a la vista
          margen: { arriba: 2 * rem, abajo: 2 * rem, izquierda: 2 * rem, derecha: 3 * rem } }
      case 'anio':
        return { capa: anio, interactivo, tocadas, peores: true, encuadre: encuadreTocadas }
      case 'giro':
        return { capa: 'k25', interactivo, tocadas, peores: true }
      case 'metodo':
        return { capa: 'kappa', interactivo, peores: zona === 'barrio' }
      case 'presupuesto':
        return { capa: 'sel', esquinas: datos ? esquinasCon(datos, monto) : 0, interactivo }
      case 'evaluar':
        return { capa: 'k25', interactivo, peores: true }
      default:
        return { capa: 'k24', interactivo, respirar: true, agrupar: true, leyenda: false }
    }
  }, [vista, modo, localidad, tocadas, tocar, anio, encuadreTocadas, zona, monto, datos])

  const entrada = intro && <Intro alTerminar={() => setIntro(false)} nombre={NOMBRE_MOVILIDAD} lema={LEMA_MOVILIDAD} />
  if (error || !datos) {
    return (
      <div className="app">
        <Esqueleto error={error} reintentar={() => setIntento((x) => x + 1)} nombre={NOMBRE_MOVILIDAD} variante="violeta"
                   estado="Cargando siniestros viales de Bogotá" />
        {entrada}
      </div>
    )
  }

  const props: PropsMov = {
    datos, modo, ir, tocadas, setTocadas, localidad, setLocalidad, anio, setAnio, monto, setMonto, zona, setZona, alInicio: alSalir, alPortada,
  }
  const panel = (() => {
    switch (vista) {
      case 'decide': return <Decide {...props} />
      case 'anio': return <Anio {...props} />
      case 'giro': return <Giro {...props} />
      case 'metodo': return <Metodo {...props} />
      case 'presupuesto': return <Presupuesto {...props} />
      case 'evaluar': return <Evaluar {...props} />
      case 'fuentes': return <Fuentes {...props} />
      case 'cierre': return <Cierre {...props} />
      default: return null
    }
  })()
  const iActual = CAPITULOS_MOV.findIndex((c) => c.id === vista)
  const r = datos.resumen
  const faltan = ESQUINAS_A_TOCAR - tocadas.length

  return (
    <div className="app app--movilidad">
      {vista !== 'portada' && (
        <header className="cabecera">
          {modo !== 'auto' && (
            <button type="button" className="boton-tema boton-atras" onClick={atras} title="Atrás" aria-label="Atrás">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
          )}
          <LogoReinicio alReiniciar={reiniciar} alReiniciarTodo={alSalir} nombre={NOMBRE_MOVILIDAD} />
          <nav className="capitulos" aria-label="Capítulos">
            {CAPITULOS_MOV.map((c, i) => (
              <button key={c.id} disabled={modo === 'auto'} onClick={() => ir(c.id as CapituloMov)} data-proli={`cap-${c.id}`}
                      className={`capitulo ${c.id === vista ? 'capitulo--actual' : iActual > i ? 'capitulo--hecho' : ''}`}>
                <span className="capitulo__n">{numeroMov(c.id)}</span><span className="capitulo__nombre">{c.nombre}</span>
              </button>
            ))}
          </nav>
          <BotonTema />
        </header>
      )}

      <div className={`escena ${vista === 'portada' ? 'escena--portada' : ''} ${vista === 'decide' || (vista === 'presupuesto' && !esTotem(modo)) ? 'escena--mapa-grande' : ''}`}>
        <div className="escena__mapa">
          <MapaMovilidad datos={datos} {...propsMapa}>
            {vista === 'decide' && modo !== 'auto' && faltan > 0 && (
              <div className="mapa__aviso">{tocadas.length ? `Toca ${faltan} más` : `Toca ${ESQUINAS_A_TOCAR} esquinas`}</div>
            )}
          </MapaMovilidad>
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
          <div className="portada" onClick={modo === 'stand' ? () => ir('decide') : undefined}>
            <div className="portada__velo" />
            <PortadaMov {...props} />
          </div>
        )}
      </div>

      <footer className="pie">
        <span className="pie__marca">{esTotem(modo) ? EMPRESA : <a href={URL_EMPRESA} target="_blank" rel="noopener noreferrer">{EMPRESA} ↗</a>} · GovTech 2026</span>
        <span>Siniestros graves agregados por hexágono de {tamanoHex(datos)} · SDM {r.periodo_estimacion[0]}–{r.anio_validacion} ·
          © colaboradores de OpenStreetMap · estimaciones, no compromisos · modelo {r.version}</span>
        {modo === 'escritorio' && <span className="atajos"><kbd>←</kbd> <kbd>→</kbd> capítulos · <kbd>F</kbd> pantalla completa</span>}
      </footer>
      {entrada}
    </div>
  )
}
