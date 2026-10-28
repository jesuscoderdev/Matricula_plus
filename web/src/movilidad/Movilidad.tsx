/**
 * Movilidad+: «Con este presupuesto, ¿dónde se evitan más siniestros graves?», con enfoque en las
 * calles de barrio. Sección propia: sus datos (public/movilidad/datos) solo se leen aquí.
 *
 * Recorrido con la estructura de Matrícula+: Problema (el presupuesto no alcanza; ¿cuáles 3
 * arreglarías?) → Solución (¿qué falla?; ¿y si…?) → Antes y después → Resultados (con la localidad
 * y el presupuesto) → Cómo se hizo → Tu reto. Misma navegación que Matrícula+: secciones, ← Atrás
 * (también el atrás del celular), logo que reinicia, teclado en escritorio, recorrido solo en ?modo=auto.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DURACION_PASOS_MOVILIDAD, EMPRESA, LEMA_MOVILIDAD, NOMBRE_MOVILIDAD, SEGUNDOS_INACTIVIDAD, URL_EMPRESA } from '../config'
import { esTotem, leerModo, modoAutomatico, type Modo } from '../modo'
import { BotonTema, LogoReinicio, pulsoLogo } from '../componentes/Marca'
import Intro from '../componentes/Intro'
import Esqueleto from '../componentes/Esqueleto'
import { cargarMovilidad, esquinasCon, millones, nombreLocalidad, type DatosMovilidad, type Nivel } from './datos'
import { informarPantalla, registrar } from '../proli/ordenes'
import { recordado, recordar } from '../recordar'
import MapaMovilidad from './MapaMovilidad'
import {
  Antes, CAPITULOS_MOV, Como, ESQUINAS_A_ESCOGER, Escoge, Falla, Fuentes, Localidad, PortadaMov, Presupuesto, Problema, Resultados, Reto, SECCIONES_MOV,
  Ysi, anioBase, seccionDe, tamanoHex, tusEsquinas, type CapituloMov, type PropsMov, type VistaMov,
} from './Paneles'
import { guionDe } from './guion'

const ORDEN: VistaMov[] = ['portada', ...CAPITULOS_MOV.map((c) => c.id)]

interface Recordado {
  vista: VistaMov; tocadas: number[]; localidad: number | null; monto: number | null; lista: 'contar' | 'modelo'; version: string
}

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
  // Al recargar, donde iba el visitante (src/recordar.ts); al salir del demo se olvida
  const [antes] = useState(() => {
    const a = recordado<Recordado>('movilidad')
    return a && CAPITULOS_MOV.some((c) => c.id === a.vista) ? a : null
  })
  const [intro, setIntro] = useState(!antes)
  const [vista, setVista] = useState<VistaMov>(antes?.vista ?? 'portada')
  const [tocadas, setTocadas] = useState<number[]>(antes?.tocadas ?? [])
  const [localidad, setLocalidad] = useState<number | null>(antes?.localidad ?? null)
  // Presupuesto en millones; null = el primer monto de referencia (sale de los datos)
  const [montoElegido, setMonto] = useState<number | null>(antes?.monto ?? null)
  const monto = montoElegido ?? datos?.experiencia.pantalla_presupuesto_barrio.escenarios.bajo.presupuesto_millones ?? 0
  const [lista, setLista] = useState<'contar' | 'modelo'>(antes?.lista ?? 'modelo')
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    setError(null)
    cargarMovilidad().then((d) => {
      // Las esquinas recordadas son posiciones en los datos: si cambió el modelo, ya no valen
      if (antes && antes.version !== d.experiencia.version_modelo) { setTocadas([]); setLocalidad(null) }
      setDatos(d)
    }).catch((e) => setError(String(e.message ?? e)))
  }, [intento, antes])
  useEffect(() => {
    if (datos) recordar('movilidad', { vista, tocadas, localidad, monto: montoElegido, lista, version: datos.experiencia.version_modelo } satisfies Recordado)
  }, [datos, vista, tocadas, localidad, montoElegido, lista])
  useEffect(() => () => recordar('movilidad', null), [])
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
    // Con varias secciones la barra se desplaza: la actual siempre a la vista
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
    setVista('portada'); setTocadas([]); setLocalidad(null); setMonto(null); setLista('modelo')
  }, [])
  const ir = useCallback((v: VistaMov) => {
    if (v === 'portada') return reiniciar()
    if (vistaRef.current !== v) pila.current.push(vistaRef.current)
    setVista(v)
  }, [reiniciar])
  /** Un paso atrás: primero quita la última esquina escogida o suelta la localidad; en la portada, vuelve al inicio. */
  const atras = useCallback(() => {
    if (vista === 'portada') return alSalir?.()
    if (vista === 'escoge' && tocadas.length) return setTocadas((t) => t.slice(0, -1))
    if (vista === 'localidad' && localidad != null) return setLocalidad(null)
    const i = ORDEN.indexOf(vista)
    setVista(pila.current.pop() ?? (i > 0 ? ORDEN[i - 1] : 'portada'))
  }, [vista, tocadas.length, localidad, alSalir])
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
          if (e.localidad === 'TODA_BOGOTA') { setLocalidad(null); refIr.current('localidad'); return 'Listo: «Tu localidad» muestra la lista de localidades.' }
          const i = datos.sitios.localidades.indexOf(String(e.localidad))
          if (i < 0) return 'Localidad no reconocida en Movilidad+.'
          setLocalidad(i); refIr.current('localidad')
          return `Listo: Resultados muestra el detalle de ${nombreLocalidad(datos.sitios.localidades[i])}.`
        }
        case 'movilidad_lista': {
          if (e.lista !== 'contar' && e.lista !== 'modelo') return 'Lista no reconocida.'
          setLista(e.lista); refIr.current('antes')
          return `Listo: el mapa de Antes y después resalta las esquinas ${e.lista === 'contar' ? 'que se escogen contando' : 'que escoge el modelo'}.`
        }
        case 'movilidad_presupuesto': {
          const n = String(e.nivel) as Nivel
          const esc = datos.experiencia.pantalla_presupuesto_barrio.escenarios
          if (!(n in esc)) return 'Nivel de presupuesto no reconocido.'
          setMonto(esc[n].presupuesto_millones); refIr.current('presupuesto')
          return `Listo: el capítulo Presupuesto muestra ${millones(esc[n].presupuesto_millones)}.`
        }
      }
      return 'Acción no reconocida en Movilidad+.'
    })
  }, [datos])
  // Qué está viendo el visitante (Proli lo recibe como contexto)
  useEffect(() => {
    if (!datos) return
    const cap = vista === 'portada' ? 'portada' : CAPITULOS_MOV.find((c) => c.id === vista)?.nombre ?? vista
    const extra = vista === 'localidad' && localidad != null ? `, localidad ${nombreLocalidad(datos.sitios.localidades[localidad])}`
      : vista === 'presupuesto' ? `, presupuesto de ${millones(monto)}`
        : vista === 'antes' ? `, mapa con las esquinas ${lista === 'contar' ? 'que se escogen contando' : 'del modelo'}`
          : vista === 'escoge' || vista === 'falla' ? `, ${tocadas.length} esquinas escogidas` : ''
    informarPantalla(`Movilidad+, capítulo ${cap}${extra}`)
  }, [datos, vista, localidad, monto, lista, tocadas.length])

  const tocar = useCallback((i: number) => {
    setTocadas((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i].slice(-ESQUINAS_A_ESCOGER)))
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
    const g = guionDe(datos)
    if (vista === 'escoge') {
      // En cada vuelta, otras tres de la lista (casi siempre las de arriba, como haría un visitante)
      setTocadas([])
      for (let j = 0; j < ESQUINAS_A_ESCOGER; j++) en(2 + 1.8 * j, () => tocar(g.tabla[(vuelta + j * (3 + (vuelta % 2))) % g.tabla.length]))
    }
    if (vista === 'antes') { setLista('contar'); en(7, () => setLista('modelo')) }
    if (vista === 'localidad') {
      setLocalidad(null); en(1.5, () => setLocalidad(g.porLocalidad[vuelta % Math.min(4, g.porLocalidad.length)].loc))
    }
    if (vista === 'presupuesto') {
      const esc = datos.experiencia.pantalla_presupuesto_barrio.escenarios
      setMonto(null); en(4, () => setMonto(esc.medio.presupuesto_millones)); en(7.5, () => setMonto(esc.alto.presupuesto_millones))
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

  const propsMapa = useMemo((): Omit<ComponentProps<typeof MapaMovilidad>, 'datos'> => {
    const interactivo = modo !== 'auto' && vista !== 'portada'
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
    if (!datos) return { capa: 'k24', interactivo: false, croquis: true }
    const g = guionDe(datos)
    const a0 = anioBase(datos)
    // En Resultados y Tu localidad, tocar una localidad la elige (y lleva a su detalle)
    const elegir = interactivo && (vista === 'resultados' || vista === 'localidad')
      ? (l: number | null) => { setLocalidad(l); if (l != null && vista !== 'localidad') ir('localidad') } : undefined
    const lugar = { croquis: true, localidad: vista === 'localidad' ? localidad : null, onLocalidad: elegir }
    // Su puesto en la lista de «¿Cuáles escogerías?»
    const puesto = (i: number) => (g.tabla.includes(i) ? String(g.tabla.indexOf(i) + 1) : '')
    const delModelo = { indices: g.comparacionPresupuesto.modelo.lista, color: 'verde' as const, texto: `Las ${g.comparacionPresupuesto.esquinas} esquinas de ${NOMBRE_MOVILIDAD}` }
    switch (vista) {
      case 'portada':
        return { capa: 'k24', interactivo: false, respirar: true, leyenda: false, agrupar: true, croquis: true,
          margen: modo === 'escritorio' ? { izquierda: Math.min(window.innerWidth * 0.46, 44 * rem), arriba: window.innerHeight * 0.05, abajo: window.innerHeight * 0.05 }
            : { arriba: window.innerHeight * 0.4, abajo: window.innerHeight * 0.2 } }
      case 'problema':
        return { ...lugar, capa: 'k24', interactivo }
      case 'escoge':
        return { croquis: true, capa: 'k24', interactivo, tocadas, onTocar: modo === 'auto' ? undefined : tocar, candidatas: g.tabla, etiqueta: puesto,
          resaltar: [{ indices: g.tabla.filter((i) => !tocadas.includes(i)), color: 'naranja', hueco: true, texto: `Las ${g.tabla.length} con más siniestros graves en ${a0}` }] }
      case 'falla': {
        const mias = tusEsquinas(datos, tocadas)
        return { croquis: true, capa: 'k25', interactivo, tocadas: mias, etiqueta: puesto,
          resaltar: [{ indices: g.comparacion30.contar1.lista.filter((i) => !mias.includes(i)), color: 'naranja', hueco: true,
            texto: `Las ${g.comparacion30.esquinas} con más siniestros graves en ${a0}` }] }
      }
      case 'ysi': {
        const i = g.ejemplo, d = 0.02
        return { croquis: true, capa: 'kappa', interactivo, encuadre: [[datos.sitios.lon[i] - d, datos.sitios.lat[i] - d * 0.8], [datos.sitios.lon[i] + d, datos.sitios.lat[i] + d * 0.8]],
          resaltar: [{ indices: [i], color: 'naranja', texto: 'La esquina del ejemplo' }] }
      }
      case 'antes': {
        const c = g.comparacion30, propia = lista === 'contar' ? c.contar1.lista : c.modelo.lista
        const otra = new Set(lista === 'contar' ? c.modelo.lista : c.contar1.lista)
        return { croquis: true, capa: lista === 'contar' ? 'k24' : 'kappa', interactivo,
          resaltar: [
            { indices: propia.filter((i) => otra.has(i)), color: 'gris', texto: 'En las dos listas' },
            { indices: propia.filter((i) => !otra.has(i)), color: lista === 'contar' ? 'naranja' : 'verde', texto: lista === 'contar' ? `Solo contando ${a0}` : 'Solo con el modelo' },
          ] }
      }
      case 'resultados':
        return { ...lugar, capa: 'k25', interactivo, resaltar: [delModelo] }
      case 'localidad':
        return { ...lugar, capa: 'kappa', interactivo, resaltar: [delModelo], margen: { arriba: 2 * rem, abajo: 2 * rem, izquierda: 2 * rem, derecha: 3 * rem } }
      case 'presupuesto':
        return { croquis: true, capa: 'sel', esquinas: esquinasCon(datos, monto), interactivo }
      default:
        return { ...lugar, capa: 'k24', interactivo, respirar: true, agrupar: true, leyenda: false }
    }
  }, [vista, modo, localidad, tocadas, monto, datos, lista, ir, tocar])

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
    datos, modo, ir, tocadas, setTocadas, localidad, setLocalidad, monto, setMonto, lista, setLista, alInicio: alSalir, alPortada,
  }
  const panel = (() => {
    switch (vista) {
      case 'problema': return <Problema {...props} />
      case 'escoge': return <Escoge {...props} />
      case 'falla': return <Falla {...props} />
      case 'ysi': return <Ysi {...props} />
      case 'antes': return <Antes {...props} />
      case 'resultados': return <Resultados {...props} />
      case 'localidad': return <Localidad {...props} />
      case 'presupuesto': return <Presupuesto {...props} />
      case 'como': return <Como {...props} />
      case 'fuentes': return <Fuentes {...props} />
      case 'cierre': return <Reto {...props} />
      default: return null
    }
  })()
  const iActual = vista === 'portada' ? -1 : seccionDe(vista)
  const r = datos.resumen
  const faltan = ESQUINAS_A_ESCOGER - tocadas.length

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
            {/* Seis secciones; cada botón lleva a la primera pantalla de la suya (Proli las señala por cualquiera de ellas) */}
            {SECCIONES_MOV.map((c, i) => (
              <button key={c.nombre} disabled={modo === 'auto'} onClick={() => ir(c.vistas[0] as CapituloMov)} data-proli={c.vistas.map((v) => `cap-${v}`).join(' ')}
                      className={`capitulo ${i === iActual ? 'capitulo--actual' : iActual > i ? 'capitulo--hecho' : ''}`}>
                <span className="capitulo__n">{String(i + 1).padStart(2, '0')}</span><span className="capitulo__nombre">{c.nombre}</span>
              </button>
            ))}
          </nav>
          <BotonTema />
        </header>
      )}

      <div className={`escena ${vista === 'portada' ? 'escena--portada' : ''} ${vista === 'escoge' || (vista === 'presupuesto' && !esTotem(modo)) ? 'escena--mapa-grande' : ''}`}>
        <div className="escena__mapa">
          <MapaMovilidad datos={datos} {...propsMapa}>
            {vista === 'escoge' && modo !== 'auto' && faltan > 0 && (
              <div className="mapa__aviso">{tocadas.length ? `Toca ${faltan} más` : `Toca ${ESQUINAS_A_ESCOGER} esquinas`}</div>
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
          <div className="portada" onClick={modo === 'stand' ? () => ir('problema') : undefined}>
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
