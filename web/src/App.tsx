import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cargarDatos, decimal, type Datos } from './datos'
import { palancasIniciales, supuestosIniciales, useResultados, type Palancas } from './estado'
import type { ColegioNuevo, Supuestos } from './motor'
import { DURACION_PASOS, EMPRESA, SEGUNDOS_INACTIVIDAD } from './config'
import { esTotem, leerModo, modoAutomatico, type Modo } from './modo'
import MapaEscena from './mapa/MapaEscena'
import { LogoReinicio } from './componentes/Marca'
import Intro from './componentes/Intro'
import { CAPITULOS, numeroDe, type Capitulo, type PropsCapitulo, type Vista } from './capitulos/tipos'
import Portada from './capitulos/Portada'
import Problema from './capitulos/Problema'
import Accion from './capitulos/Accion'
import Resultado, { type Alcance } from './capitulos/Resultado'
import Laboratorio from './capitulos/Laboratorio'
import Metodo from './capitulos/Metodo'
import Caso, { alternarColegio, casoInicial, cercanos, type EstadoCaso } from './capitulos/Caso'
import Explorar from './capitulos/Explorar'
import Agendar from './capitulos/Agendar'

const ORDEN: Vista[] = ['portada', ...CAPITULOS.map((c) => c.id)]

// Modo automático: en cada vuelta, otra localidad y otras palancas. En Problema se elige la
// localidad; en Acción se mueven las palancas y se aprieta ▶ Asignar.
type Cambio = Partial<Omit<Palancas, 'colegioNuevo'>> & { colegioNuevo?: string }
const GUIONES: { localidad: string; cambios: { segundo: number; cambio: Cambio }[] }[] = [
  { localidad: 'Suba', cambios: [{ segundo: 2, cambio: { preset: 'equidad' } }, { segundo: 4, cambio: { colegioNuevo: 'tibabuyes' } }] },
  { localidad: 'Kennedy', cambios: [{ segundo: 2, cambio: { preset: 'familias' } }, { segundo: 4, cambio: { colegioNuevo: 'kennedy' } }] },
  { localidad: 'Ciudad Bolívar', cambios: [{ segundo: 2, cambio: { preset: 'equidad' } }, { segundo: 4, cambio: { colegioNuevo: 'ciudad_bolivar' } }] },
  { localidad: 'Bosa', cambios: [{ segundo: 2, cambio: { preset: 'cercania' } }, { segundo: 4, cambio: { colegioNuevo: 'bosa' } }] },
]

export default function App() {
  const [modo, setModo] = useState<Modo>(leerModo)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intro, setIntro] = useState(true)
  const [vista, setVista] = useState<Vista>('portada')
  const [supuestos, setSupuestos] = useState<Supuestos | null>(null)
  const [palancas, setPalancas] = useState<Palancas | null>(null)
  const [localidad, setLocalidad] = useState<string | null>(null)
  // Proceso animado
  const [asignado, setAsignado] = useState(false)
  const [reproduccion, setReproduccion] = useState(0)
  const [terminado, setTerminado] = useState(false)
  const [eligiendoPunto, setEligiendoPunto] = useState(false)
  // Resultado / Explorar / Caso
  const [alcance, setAlcance] = useState<Alcance>('localidad')
  const [coloreo, setColoreo] = useState<'hoy' | 'pol'>('pol')
  const [upz, setUpz] = useState<string | null>(null)
  const [caso, setCaso] = useState<EstadoCaso>(casoInicial)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    cargarDatos().then((d) => { setDatos(d); setSupuestos(supuestosIniciales(d)); setPalancas(palancasIniciales(d)) })
      .catch((e) => setError(String(e.message ?? e)))
  }, [])
  useEffect(() => { document.documentElement.dataset.modo = modo }, [modo])
  useEffect(() => {
    if (!modoAutomatico()) return
    const alCambiar = () => setModo(leerModo())
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])

  const r = useResultados(datos, supuestos, palancas)
  // Cada capítulo empieza arriba
  const refPanel = useRef<HTMLElement>(null)
  useEffect(() => { refPanel.current?.scrollTo({ top: 0 }) }, [vista, localidad])

  // Cualquier cambio de reglas o supuestos invalida la asignación animada
  useEffect(() => { setAsignado(false) }, [palancas, supuestos])
  useEffect(() => { setTerminado(false) }, [vista, localidad, asignado, reproduccion])

  const reiniciar = useCallback(() => {
    if (!datos) return
    setPalancas(palancasIniciales(datos)); setSupuestos(supuestosIniciales(datos))
    setLocalidad(null); setVista('portada'); setAlcance('localidad'); setColoreo('pol')
    setUpz(null); setCaso(casoInicial()); setEligiendoPunto(false)
  }, [datos])
  const ir = useCallback((v: Vista) => {
    if (v === 'portada') return reiniciar()
    if (v === 'accion') setLocalidad((l) => l ?? 'Suba')
    setEligiendoPunto(false)
    setVista(v)
  }, [reiniciar])
  const cambiarPalancas = useCallback((c: Partial<Palancas>) => setPalancas((p) => (p ? { ...p, ...c } : p)), [])
  const cambiarSupuestos = useCallback((c: Partial<Supuestos>) => setSupuestos((s) => (s ? { ...s, ...c } : s)), [])
  const asignar = useCallback(() => { setAsignado(true); setReproduccion((x) => x + 1) }, [])
  const repetir = useCallback(() => setReproduccion((x) => x + 1), [])
  const alTerminar = useCallback(() => setTerminado(true), [])
  const ubicar = useCallback((lon: number, lat: number) => {
    if (!r || !supuestos) return
    setCaso((c) => ({ ...c, lon, lat, hermanoEn: null, colegios: cercanos(r.pol.pos, lon, lat, supuestos.opciones).map((x) => x.s) }))
  }, [r, supuestos])

  // Kiosco táctil: sin interacción en N segundos, vuelve a la portada
  useEffect(() => {
    if (modo !== 'stand' || vista === 'portada') return
    let id = window.setTimeout(reiniciar, SEGUNDOS_INACTIVIDAD * 1000)
    const tocar = () => { window.clearTimeout(id); id = window.setTimeout(reiniciar, SEGUNDOS_INACTIVIDAD * 1000) }
    window.addEventListener('pointerdown', tocar)
    return () => { window.clearTimeout(id); window.removeEventListener('pointerdown', tocar) }
  }, [modo, vista, reiniciar])

  // El tótem no abre menús contextuales ni hace zoom con gestos
  useEffect(() => {
    if (!esTotem(modo)) return
    const bloquear = (e: Event) => e.preventDefault()
    window.addEventListener('contextmenu', bloquear)
    window.addEventListener('gesturestart', bloquear)
    return () => { window.removeEventListener('contextmenu', bloquear); window.removeEventListener('gesturestart', bloquear) }
  }, [modo])

  // Modo automático: recorre los capítulos con sus tiempos y "toca" lo que tocaría un visitante
  useEffect(() => {
    if (modo !== 'auto' || !datos || intro) return
    const v = (ORDEN.includes(vista) ? vista : 'portada') as keyof typeof DURACION_PASOS
    const timers: number[] = []
    const en = (s: number, f: () => void) => timers.push(window.setTimeout(f, s * 1000))
    const guion = GUIONES[vuelta % GUIONES.length]
    if (v === 'problema') en(1.5, () => setLocalidad(guion.localidad))
    if (v === 'accion') {
      for (const g of guion.cambios) en(g.segundo, () => {
        const { colegioNuevo: cn, ...resto } = g.cambio
        const c: Partial<Palancas> = { ...resto }
        if (resto.preset) c.pesos = datos.indice.pesos_presets[resto.preset]
        if (cn) { const u = datos.indice.colegio_nuevo.find((x) => x.clave === cn)!; c.colegioNuevo = { clave: u.clave, lon: u.lon, lat: u.lat } }
        cambiarPalancas(c)
      })
      en(5.5, asignar)
    }
    if (v === 'resultado') { en(5, () => setAlcance('bogota')); en(8.5, () => setAlcance('zona')) }
    if (v === 'laboratorio') en(2, () => cambiarSupuestos({ opciones: 5 }))
    en(DURACION_PASOS[v], () => {
      const sig = ORDEN[(ORDEN.indexOf(v) + 1) % ORDEN.length]
      if (sig === 'portada') { setVuelta((x) => x + 1); reiniciar() } else setVista(sig)
    })
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [modo, vista, datos, vuelta, intro, cambiarPalancas, cambiarSupuestos, asignar, reiniciar])

  // Modo presentación (PC): flechas para avanzar/retroceder, espacio para asignar, F pantalla completa
  useEffect(() => {
    if (modo !== 'escritorio') return
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select')) return
      const i = ORDEN.indexOf(vista)
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); ir(i < 0 ? 'problema' : ORDEN[Math.min(ORDEN.length - 1, i + 1)]) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); if (i > 0) ir(ORDEN[i - 1]) }
      else if (e.key === 'Home') ir('portada')
      else if (e.key === ' ' && vista === 'accion') { e.preventDefault(); asignar() }
      else if (e.key === 'Escape') setEligiendoPunto(false)
      else if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) document.exitFullscreen?.()
        else document.documentElement.requestFullscreen?.().catch(() => {})
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [modo, vista, ir, asignar])

  const propsMapa = useMemo((): Omit<ComponentProps<typeof MapaEscena>, 'datos' | 'r' | 'supuestos'> | null => {
    if (!palancas || !supuestos) return null
    const interactivo = modo !== 'auto' && vista !== 'portada'
    const base = { interactivo, colegioNuevo: palancas.colegioNuevo }
    switch (vista) {
      case 'problema':
        return localidad
          ? { ...base, escena: 'proceso', fase: 'llegada', localidad, reproduccion, alTerminar }
          : { ...base, escena: 'ciudad', coloreo: 'hoy', localidad: null, colegioNuevo: null,
              onTocarUpz: modo === 'auto' ? undefined : (c: string) => setLocalidad(datos!.localidadDeUpz[datos!.posUpz[c]]) }
      case 'accion':
        return { ...base, escena: 'proceso', fase: asignado ? 'diferida' : 'neutro', localidad: localidad ?? 'Suba', reproduccion, alTerminar,
          mostrarCandidatos: true,
          textoNeutro: eligiendoPunto ? 'Toca el mapa donde quieres construir el colegio nuevo.' : 'Elige las reglas y toca ▶ Asignar.',
          onTocarCandidato: (clave: string) => {
            const u = datos!.indice.colegio_nuevo.find((x) => x.clave === clave)!
            cambiarPalancas({ colegioNuevo: { clave, lon: u.lon, lat: u.lat } })
          },
          onTocarMapa: eligiendoPunto ? (lon: number, lat: number) => {
            cambiarPalancas({ colegioNuevo: { clave: null, lon, lat } as ColegioNuevo }); setEligiendoPunto(false)
          } : undefined }
      case 'resultado':
        return { ...base, escena: 'ciudad', coloreo, localidad: alcance === 'localidad' ? localidad : null }
      case 'explorar':
        return { ...base, escena: 'ciudad', coloreo, localidad: null, upzSeleccionada: upz, onTocarUpz: setUpz }
      case 'caso':
        return { ...base, escena: 'caso', localidad: null,
          caso: caso.lon == null ? null : { lon: caso.lon, lat: caso.lat!, colegios: caso.colegios, hermanoEn: caso.hermanoEn },
          onTocarMapa: modo === 'auto' ? undefined : ubicar,
          onTocarColegio: (s: number) => setCaso((c) => alternarColegio(c, s, supuestos.opciones)) }
      case 'portada':
        // El mapa se corre hacia donde no lo tapa el texto de la portada
        return { ...base, escena: 'ciudad', coloreo: 'hoy', localidad: null, respirar: true, colegioNuevo: null,
          margen: modo === 'escritorio' ? { izquierda: Math.min(window.innerWidth * 0.46, 44 * parseFloat(getComputedStyle(document.documentElement).fontSize)) }
            : { arriba: window.innerHeight * 0.3, abajo: window.innerHeight * 0.22 } }
      default:
        return { ...base, escena: 'ciudad', coloreo: 'pol', localidad: null, respirar: vista === 'metodo' || vista === 'agendar' }
    }
  }, [vista, modo, localidad, palancas, supuestos, asignado, reproduccion, alTerminar, eligiendoPunto, coloreo, alcance, upz, caso, ubicar, cambiarPalancas, datos])

  const entrada = intro && <Intro alTerminar={() => setIntro(false)} />
  if (error || !datos || !r || !supuestos || !palancas || !propsMapa) {
    return (
      <div className="app">
        {error ? <div className="mensaje-error">{error}</div> : !intro && <div className="cargando">Cargando Bogotá…</div>}
        {entrada}
      </div>
    )
  }

  const props: PropsCapitulo = {
    datos, r, modo, supuestos, cambiarSupuestos, restaurarSupuestos: () => setSupuestos(supuestosIniciales(datos)),
    palancas, cambiarPalancas, localidad, elegirLocalidad: setLocalidad, ir, terminado, repetir,
  }
  const panel = (() => {
    switch (vista) {
      case 'problema': return <Problema {...props} />
      case 'accion': return <Accion {...props} asignado={asignado} asignar={asignar} eligiendoPunto={eligiendoPunto} setEligiendoPunto={setEligiendoPunto} />
      case 'resultado': return <Resultado {...props} alcance={alcance} setAlcance={setAlcance} coloreo={coloreo} setColoreo={setColoreo} />
      case 'laboratorio': return <Laboratorio {...props} />
      case 'metodo': return <Metodo {...props} />
      case 'caso': return <Caso {...props} caso={caso} setCaso={setCaso} ubicar={ubicar} />
      case 'explorar': return <Explorar {...props} upz={upz} setUpz={setUpz} coloreo={coloreo} setColoreo={setColoreo} />
      case 'agendar': return <Agendar />
      default: return null
    }
  })()

  const totem = esTotem(modo)
  const extras: { id: Vista; nombre: string }[] = modo === 'auto' ? [] : [
    { id: 'caso', nombre: modo === 'celular' ? 'Familia' : 'Simula una familia' },
    { id: 'explorar', nombre: 'Explorar' },
    ...(totem ? [] : [{ id: 'agendar' as Vista, nombre: modo === 'celular' ? 'Cita' : 'Agendar' }]),
  ]
  const iActual = CAPITULOS.findIndex((c) => c.id === vista)
  const ini = supuestosIniciales(datos)
  const editados = (Object.keys(ini) as (keyof Supuestos)[]).some((k) => supuestos[k] !== ini[k])
  const proceso = propsMapa.escena === 'proceso'

  return (
    <div className="app">
      {vista !== 'portada' && (
        <header className="cabecera">
          <LogoReinicio alReiniciar={reiniciar} />
          <nav className="capitulos" aria-label="Capítulos">
            {CAPITULOS.map((c, i) => (
              <button key={c.id} disabled={modo === 'auto'} onClick={() => ir(c.id as Capitulo)}
                      className={`capitulo ${c.id === vista ? 'capitulo--actual' : iActual > i ? 'capitulo--hecho' : ''}`}>
                <span className="capitulo__n">{numeroDe(c.id)}</span><span className="capitulo__nombre">{c.nombre}</span>
              </button>
            ))}
          </nav>
          {extras.length > 0 && (
            <div className="cabecera__extra">
              {extras.map((x) => (
                <button key={x.id} className={`boton-extra ${vista === x.id ? 'boton-extra--activo' : ''}`} onClick={() => ir(x.id)}>{x.nombre}</button>
              ))}
            </div>
          )}
        </header>
      )}

      <div className={`escena ${vista === 'portada' ? 'escena--portada' : ''} ${proceso ? 'escena--mapa-grande' : ''}`}>
        <div className="escena__mapa">
          <MapaEscena datos={datos} r={r} supuestos={supuestos} {...propsMapa}>
            {eligiendoPunto && vista === 'accion' && <div className="mapa__aviso">Toca donde quieres el colegio nuevo</div>}
            {vista === 'caso' && caso.lon == null && <div className="mapa__aviso">Toca dónde vive la familia</div>}
            {vista === 'problema' && !localidad && modo !== 'auto' && <div className="mapa__aviso">Toca tu localidad</div>}
          </MapaEscena>
        </div>
        {vista !== 'portada' && (
          <section className="escena__panel" ref={refPanel}>
            <AnimatePresence mode="wait">
              <motion.div key={vista + (vista === 'problema' ? localidad : '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }} transition={{ duration: 0.22 }} style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
                {panel}
              </motion.div>
            </AnimatePresence>
          </section>
        )}
        {vista === 'portada' && (
          <div className="portada" onClick={modo === 'stand' ? () => ir('problema') : undefined}>
            <div className="portada__velo" />
            <Portada {...props} />
          </div>
        )}
      </div>

      {/* Supuestos siempre visibles */}
      <footer className="pie">
        <span className="pie__marca">{EMPRESA} · GovTech 2026</span>
        {editados && <span className="pie__aviso">Supuestos editados</span>}
        <span>Familias sintéticas (1 = {datos.familias.estudiantes_por_familia} niños) · SED 03.2025 · hasta {supuestos.opciones} colegios por familia ·
          reubicación ≤ {decimal(supuestos.radioReubicacionKm)} km · distancia en línea recta{datos.indice.fuente === 'sintetica' && ' · DATOS SINTÉTICOS'}</span>
        {modo === 'escritorio' && <span className="atajos"><kbd>←</kbd> <kbd>→</kbd> capítulos · <kbd>F</kbd> pantalla completa</span>}
      </footer>
      {entrada}
    </div>
  )
}
