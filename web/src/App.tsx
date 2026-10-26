import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cargarDatos, decimal, entero, type Datos } from './datos'
import { describir, metricasDe, palancasIniciales, supuestosIniciales, useResultados, type Palancas } from './estado'
import type { ColegioNuevo, Metricas, Supuestos } from './motor'
import { DURACION_PASOS, EMPRESA, SEGUNDOS_INACTIVIDAD, URL_EMPRESA } from './config'
import { esTotem, leerModo, modoAutomatico, type Modo } from './modo'
import MapaEscena from './mapa/MapaEscena'
import { BotonTema, LogoReinicio, pulsoLogo } from './componentes/Marca'
import Intro from './componentes/Intro'
import Esqueleto from './componentes/Esqueleto'
import { CAPITULOS, numeroDe, type Capitulo, type PropsCapitulo, type Vista } from './capitulos/tipos'
import Portada from './capitulos/Portada'
import Problema from './capitulos/Problema'
import Accion from './capitulos/Accion'
import Resultado, { type Alcance } from './capitulos/Resultado'
import Laboratorio from './capitulos/Laboratorio'
import Metodo from './capitulos/Metodo'
import Caso, { alternarColegio, casoInicial, cercanos, resolverCaso, viajeDe, type Cual, type EstadoCaso } from './capitulos/Caso'
import Explorar from './capitulos/Explorar'
import { calcularOpciones, recordarOpciones } from './colegioNuevo'
import Agendar from './capitulos/Agendar'
import { informarPantalla, registrar } from './proli/ordenes'
import { recordado, recordar } from './recordar'

const ORDEN: Vista[] = ['portada', ...CAPITULOS.map((c) => c.id)]
const VISTAS: Vista[] = [...ORDEN, 'caso', 'explorar', 'agendar']

// Modo automático: en cada vuelta, otra localidad y otras palancas. En Problema se elige la
// localidad; en Acción se mueven las palancas y se aprieta ▶ Asignar.
type Cambio = Partial<Omit<Palancas, 'colegioNuevo'>> & { colegioNuevo?: string }
const GUIONES: { localidad: string; cambios: { segundo: number; cambio: Cambio }[] }[] = [
  { localidad: 'Suba', cambios: [{ segundo: 2, cambio: { preset: 'equidad' } }, { segundo: 4, cambio: { colegioNuevo: 'tibabuyes' } }] },
  { localidad: 'Kennedy', cambios: [{ segundo: 2, cambio: { preset: 'familias' } }, { segundo: 4, cambio: { colegioNuevo: 'kennedy' } }] },
  { localidad: 'Ciudad Bolívar', cambios: [{ segundo: 2, cambio: { preset: 'equidad' } }, { segundo: 4, cambio: { colegioNuevo: 'ciudad_bolivar' } }] },
  { localidad: 'Bosa', cambios: [{ segundo: 2, cambio: { preset: 'cercania' } }, { segundo: 4, cambio: { colegioNuevo: 'bosa' } }] },
]

/**
 * Matrícula+. Desde la página de inicio (Inicio.tsx) recibe cómo volver: `alSalir` (← en la
 * portada, atrás del navegador, logo mantenido), `alInactivo` (stand) y `alTerminarVuelta` (auto,
 * para alternar con los otros proyectos). Sin ellas funciona como siempre.
 */
export default function App({ alSalir, alInactivo, alTerminarVuelta, alPortada }: {
  alSalir?: () => void; alInactivo?: () => void; alTerminarVuelta?: () => void
  /** el logo de Proliferante lleva a la portada del stand */
  alPortada?: () => void
} = {}) {
  const [modo, setModo] = useState<Modo>(leerModo)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Al recargar, el capítulo y la localidad en que iba (src/recordar.ts); al salir del demo se olvidan
  const [antes] = useState(() => {
    const a = recordado<{ vista: Vista; localidad: string | null }>('matricula')
    return a && VISTAS.includes(a.vista) && a.vista !== 'portada' ? a : null
  })
  const [intro, setIntro] = useState(!antes)
  const [vista, setVista] = useState<Vista>(antes?.vista ?? 'portada')
  const [supuestos, setSupuestos] = useState<Supuestos | null>(null)
  const [palancas, setPalancas] = useState<Palancas | null>(null)
  const [localidad, setLocalidad] = useState<string | null>(antes?.localidad ?? null)
  useEffect(() => { recordar('matricula', { vista, localidad }) }, [vista, localidad])
  useEffect(() => () => recordar('matricula', null), [])
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
  const [cual, setCual] = useState<Cual>('matricula')  // qué viaje de la familia se ve en el mapa
  const [vuelta, setVuelta] = useState(0)

  const [intento, setIntento] = useState(0)
  useEffect(() => {
    setError(null)
    cargarDatos().then((d) => { setDatos(d); setSupuestos(supuestosIniciales(d)); setPalancas(palancasIniciales(d)) })
      .catch((e) => setError(String(e.message ?? e)))
  }, [intento])
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

  // El logo hace de cargador: se encoge a "M+" y se abre cada vez que algo cambia o se recalcula
  const primerPulso = useRef(true)
  useEffect(() => {
    if (primerPulso.current) { primerPulso.current = false; return }
    pulsoLogo()
  }, [vista, localidad, palancas, supuestos, reproduccion, caso.lon, caso.lat])

  // Cualquier cambio de reglas o supuestos invalida la asignación animada
  useEffect(() => { setAsignado(false) }, [palancas, supuestos])
  useEffect(() => { setTerminado(false) }, [vista, localidad, asignado, reproduccion])

  // Historial para "← Atrás": las vistas por las que pasó el visitante (sin la actual)
  const pila = useRef<Vista[]>([])
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const reiniciar = useCallback(() => {
    if (!datos) return
    pila.current = []
    setPalancas(palancasIniciales(datos)); setSupuestos(supuestosIniciales(datos))
    setLocalidad(null); setVista('portada'); setAlcance('localidad'); setColoreo('pol')
    setUpz(null); setCaso(casoInicial()); setCual('matricula'); setEligiendoPunto(false)
  }, [datos])
  const ir = useCallback((v: Vista) => {
    if (v === 'portada') return reiniciar()
    if (v === 'accion') setLocalidad((l) => l ?? 'Suba')
    setEligiendoPunto(false)
    if (vistaRef.current !== v) pila.current.push(vistaRef.current)
    setVista(v)
  }, [reiniciar])
  /**
   * Un paso atrás: primero deshace el paso dentro de la vista (elegir punto, familia, UPZ,
   * localidad) y luego vuelve a la vista anterior; sin historial, al capítulo anterior.
   */
  const atras = useCallback(() => {
    if (vista === 'portada') return alSalir?.()
    if (eligiendoPunto) return setEligiendoPunto(false)
    if (vista === 'caso' && caso.lon != null) return setCaso(casoInicial())
    if (vista === 'explorar' && upz) return setUpz(null)
    if (vista === 'problema' && localidad) return setLocalidad(null)
    const i = ORDEN.indexOf(vista)
    setVista(pila.current.pop() ?? (i > 0 ? ORDEN[i - 1] : 'portada'))
  }, [eligiendoPunto, vista, caso.lon, upz, localidad, alSalir])
  // El "atrás" del celular o del navegador hace lo mismo que el botón; en la portada sí sale
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
  const cambiarPalancas = useCallback((c: Partial<Palancas>) => setPalancas((p) => (p ? { ...p, ...c } : p)), [])
  const cambiarSupuestos = useCallback((c: Partial<Supuestos>) => setSupuestos((s) => (s ? { ...s, ...c } : s)), [])
  const asignar = useCallback(() => { setAsignado(true); setReproduccion((x) => x + 1) }, [])
  const repetir = useCallback(() => setReproduccion((x) => x + 1), [])
  const alTerminar = useCallback(() => setTerminado(true), [])

  // Proli puede mover este demo (src/proli/ordenes.ts). Se registra con los datos cargados para
  // validar localidades y opciones; lo que llegó mientras cargaba se aplica en ese momento.
  const refIr = useRef(ir)
  refIr.current = ir
  // Lo último calculado, para que Proli lea los mismos resultados que muestra la pantalla
  const refR = useRef(r)
  refR.current = r
  const refSupuestos = useRef(supuestos)
  refSupuestos.current = supuestos
  const refPalancas = useRef(palancas)
  refPalancas.current = palancas
  const refLocalidad = useRef(localidad)
  refLocalidad.current = localidad
  useEffect(() => {
    if (!datos) return
    const vistas = VISTAS
    const nombreVista = (v: Vista) => CAPITULOS.find((c) => c.id === v)?.nombre
      ?? { portada: 'portada', caso: 'Simula una familia', explorar: 'Explorar', agendar: 'Agendar' }[v as string] ?? v
    return registrar('matricula', (o) => {
      const e = o.entrada
      switch (o.nombre) {
        case 'matricula_capitulo': {
          const v = String(e.capitulo) as Vista
          if (!vistas.includes(v)) return 'Capítulo no reconocido.'
          refIr.current(v)
          return `Listo: Matrícula+ muestra ${v === 'portada' ? 'su portada' : `el capítulo ${nombreVista(v)}`}.`
        }
        case 'matricula_localidad': {
          const l = String(e.localidad)
          if (!datos.localidades.includes(l)) return 'Localidad no reconocida en Matrícula+.'
          setLocalidad(l); refIr.current('problema')
          return `Listo: el capítulo Problema muestra cómo se asignan hoy los cupos en ${l}.`
        }
        case 'matricula_reglas': {
          const p = datos.indice.presets.find((x) => x.clave === e.reglas)
          if (!p) return 'Reglas no reconocidas.'
          cambiarPalancas({ preset: p.clave, pesos: datos.indice.pesos_presets[p.clave] }); refIr.current('accion')
          return `Listo: reglas «${p.etiqueta}» (${p.descripcion.toLowerCase()}) en el capítulo Acción.`
        }
        case 'matricula_colegio_nuevo': {
          if (e.ubicacion === 'ninguno') { cambiarPalancas({ colegioNuevo: null }); refIr.current('accion'); return 'Listo: sin colegio nuevo.' }
          const u = datos.indice.colegio_nuevo.find((x) => x.clave === e.ubicacion)
          if (!u) return 'Ubicación no reconocida.'
          cambiarPalancas({ colegioNuevo: { clave: u.clave, lon: u.lon, lat: u.lat } }); refIr.current('accion')
          return `Listo: colegio nuevo de ${u.cupos} cupos en ${u.etiqueta}.`
        }
        case 'matricula_colegio_sugerido': {
          // Donde más rinde para la localidad elegida (o el mejor proyecto SED para Bogotá)
          // Acción abre con Suba si no había localidad: el cálculo usa la misma que verá el visitante
          const pa = refPalancas.current, su = refSupuestos.current, loc = refLocalidad.current ?? 'Suba'
          if (!pa || !su) return 'La pantalla todavía no está lista.'
          const ops = calcularOpciones(datos, su, pa.pesos, pa.jornadaUnica, loc)
          recordarOpciones(su, pa.pesos, pa.jornadaUnica, loc, ops)
          const mejor = ops.reduce((a, b) => (b.ninos > a.ninos ? b : a), ops[0])
          if (!mejor) return 'No encontré un lugar.'
          cambiarPalancas({ colegioNuevo: mejor.colegio }); refIr.current('accion')
          return `Listo: colegio nuevo en ${mejor.etiqueta}${mejor.real ? ' (proyecto real de la SED)' : ' (lugar sugerido por la simulación)'}: ${mejor.ninos.toLocaleString('es-CO')} niños${loc ? ` de ${loc}` : ''} más entran a alguno de los colegios que pidieron.`
        }
        case 'matricula_jornada_unica': {
          if (typeof e.activa !== 'boolean') return 'Valor no reconocido.'
          cambiarPalancas({ jornadaUnica: e.activa }); refIr.current('accion')
          return `Listo: jornada única ${e.activa ? 'activada' : 'desactivada'}.`
        }
        case 'matricula_resultados': {
          // Las mismas cifras del capítulo Resultado, con las reglas y supuestos que el visitante tiene ahora
          const res = refR.current, s = refSupuestos.current, p = refPalancas.current
          if (!res || !s || !p) return 'Los resultados todavía se están calculando; intente de nuevo en un momento.'
          const donde = String(e.ambito)
          let m: { hoy: Metricas; pol: Metricas }
          let nombre: string
          if (donde === 'BOGOTA') { m = res.bogota; nombre = 'Bogotá' }
          else if (donde === 'ZONA_CRITICA') { m = res.zona; nombre = 'la zona crítica (Tibabuyes y El Rincón)' }
          else if (datos.localidades.includes(donde)) { m = metricasDe(datos, res, s, donde); nombre = donde }
          else return 'Localidad no reconocida en Matrícula+.'
          if (e.mostrar === true) {
            if (donde !== 'BOGOTA' && donde !== 'ZONA_CRITICA') setLocalidad(donde)
            setAlcance(donde === 'BOGOTA' ? 'bogota' : donde === 'ZONA_CRITICA' ? 'zona' : 'localidad')
            refIr.current('resultado')
          }
          const par = (k: 'pctFueraDeOpciones' | 'pctPrimera' | 'pctSinCupo' | 'pctVulnerablesFuera' | 'pctViajeLargo') =>
            `hoy ${decimal(m.hoy[k])} % → con estas reglas ${decimal(m.pol[k])} %`
          return `Consulté los resultados de ${nombre}${e.mostrar === true ? ' y los muestro en Resultados' : ''} | `
            + `Simulación en pantalla para ${nombre} (${describir(datos, p)}; ${s.opciones} opciones por familia; «hoy» = asignación actual por orden de llegada): `
            + `${entero(m.hoy.estudiantes)} estudiantes nuevos. Fuera de todas sus opciones: ${par('pctFueraDeOpciones')} `
            + `(${entero(m.hoy.fueraDeOpciones)} → ${entero(m.pol.fueraDeOpciones)} niños). En su primera opción: ${par('pctPrimera')}. `
            + `Sin ningún cupo cercano tras la reubicación: ${par('pctSinCupo')}. Vulnerables fuera de sus opciones: ${par('pctVulnerablesFuera')}. `
            + `Viajes de más de ${decimal(s.umbralViajeLargoKm)} km: ${par('pctViajeLargo')}.`
        }
        case 'matricula_asignar':
          refIr.current('accion')
          // Después del efecto que anula la asignación cuando cambian las reglas (ver arriba)
          window.setTimeout(asignar, 120)
          return 'Listo: se tocó ▶ Asignar; la asignación corre ronda por ronda en el mapa.'
      }
      return 'Acción no reconocida en Matrícula+.'
    })
  }, [datos, cambiarPalancas, asignar])
  // Qué está viendo el visitante (Proli lo recibe como contexto)
  useEffect(() => {
    if (!datos || !palancas) return
    const cap = CAPITULOS.find((c) => c.id === vista)?.nombre
      ?? { portada: 'portada', caso: 'Simula una familia', explorar: 'Explorar', agendar: 'Agendar' }[vista as string] ?? vista
    const reglas = datos.indice.presets.find((x) => x.clave === palancas.preset)?.etiqueta ?? 'personalizadas'
    const nuevo = palancas.colegioNuevo ? `, colegio nuevo en ${datos.indice.colegio_nuevo.find((x) => x.clave === palancas.colegioNuevo!.clave)?.etiqueta ?? palancas.colegioNuevo.etiqueta ?? 'un punto del mapa'}` : ''
    informarPantalla(`Matrícula+, capítulo ${cap}${localidad ? `, localidad ${localidad}` : ''}, reglas ${reglas}${nuevo}${palancas.jornadaUnica ? ', jornada única' : ''}`)
  }, [datos, vista, localidad, palancas])

  const ubicar = useCallback((lon: number, lat: number) => {
    if (!r || !supuestos) return
    setCaso((c) => ({ ...c, lon, lat, hermanoEn: null, quien: null, colegios: cercanos(r.pol.pos, lon, lat, supuestos.opciones).map((x) => x.s) }))
  }, [r, supuestos])

  // Simula una familia: la asignación completa con la familia agregada (~100 ms, solo en esa vista)
  const politica = r?.pol.politica
  const resCaso = useMemo(() => (vista === 'caso' && datos && supuestos && politica ? resolverCaso(datos, supuestos, politica, caso) : null),
    [vista, datos, supuestos, politica, caso.lon, caso.lat, caso.vulnerable, caso.hermanoEn, caso.colegios, caso.llegada])  // eslint-disable-line react-hooks/exhaustive-deps
  const viaje = useMemo(() => (resCaso && supuestos ? viajeDe(caso.colegios, resCaso, cual, supuestos.opciones) : null), [resCaso, caso.colegios, cual, supuestos])

  // Kiosco táctil: sin interacción en N segundos, vuelve a la portada (o a la página de inicio)
  useEffect(() => {
    const volver = alInactivo ?? reiniciar
    if (modo !== 'stand' || (vista === 'portada' && !alInactivo)) return
    let id = window.setTimeout(volver, SEGUNDOS_INACTIVIDAD * 1000)
    const tocar = () => { window.clearTimeout(id); id = window.setTimeout(volver, SEGUNDOS_INACTIVIDAD * 1000) }
    window.addEventListener('pointerdown', tocar)
    return () => { window.clearTimeout(id); window.removeEventListener('pointerdown', tocar) }
  }, [modo, vista, reiniciar, alInactivo])

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
      if (sig !== 'portada') setVista(sig)
      else if (alTerminarVuelta) alTerminarVuelta()
      else { setVuelta((x) => x + 1); reiniciar() }
    })
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [modo, vista, datos, vuelta, intro, cambiarPalancas, cambiarSupuestos, asignar, reiniciar, alTerminarVuelta])

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
          caso: caso.lon == null ? null : { lon: caso.lon, lat: caso.lat!, colegios: caso.colegios, hermanoEn: caso.hermanoEn, viaje, cual },
          onCual: modo === 'auto' ? undefined : setCual,
          // El recuadro del viaje tapa la parte baja del mapa
          margen: viaje ? { abajo: 7 * parseFloat(getComputedStyle(document.documentElement).fontSize) } : undefined,
          onTocarMapa: modo === 'auto' ? undefined : ubicar,
          onTocarColegio: (s: number) => setCaso((c) => alternarColegio(c, s, supuestos.opciones)) }
      case 'portada':
        // El mapa se corre hacia donde no lo tapa el texto de la portada
        return { ...base, escena: 'ciudad', coloreo: 'hoy', localidad: null, conexiones: true, colegioNuevo: null,
          margen: modo === 'escritorio' ? { izquierda: Math.min(window.innerWidth * 0.46, 44 * parseFloat(getComputedStyle(document.documentElement).fontSize)) }
            : { arriba: window.innerHeight * 0.3, abajo: window.innerHeight * 0.22 } }
      default:
        return { ...base, escena: 'ciudad', coloreo: 'pol', localidad: null, respirar: vista === 'metodo' || vista === 'agendar' }
    }
  }, [vista, modo, localidad, palancas, supuestos, asignado, reproduccion, alTerminar, eligiendoPunto, coloreo, alcance, upz, caso, viaje, cual, ubicar, cambiarPalancas, datos])

  const entrada = intro && <Intro alTerminar={() => setIntro(false)} />
  if (error || !datos || !r || !supuestos || !palancas || !propsMapa) {
    return (
      <div className="app">
        <Esqueleto error={error} reintentar={() => setIntento((x) => x + 1)} />
        {entrada}
      </div>
    )
  }

  const props: PropsCapitulo = {
    datos, r, modo, supuestos, cambiarSupuestos, restaurarSupuestos: () => setSupuestos(supuestosIniciales(datos)),
    palancas, cambiarPalancas, localidad, elegirLocalidad: setLocalidad, ir, terminado, repetir, alInicio: alSalir, alPortada,
  }
  const panel = (() => {
    switch (vista) {
      case 'problema': return <Problema {...props} />
      case 'accion': return <Accion {...props} asignado={asignado} asignar={asignar} eligiendoPunto={eligiendoPunto} setEligiendoPunto={setEligiendoPunto} />
      case 'resultado': return <Resultado {...props} alcance={alcance} setAlcance={setAlcance} coloreo={coloreo} setColoreo={setColoreo} />
      case 'laboratorio': return <Laboratorio {...props} />
      case 'metodo': return <Metodo {...props} />
      case 'caso': return <Caso {...props} caso={caso} setCaso={setCaso} ubicar={ubicar} res={resCaso} cual={cual} setCual={setCual} />
      case 'explorar': return <Explorar {...props} upz={upz} setUpz={setUpz} coloreo={coloreo} setColoreo={setColoreo} />
      case 'agendar': return <Agendar {...props} />
      default: return null
    }
  })()

  const totem = esTotem(modo)
  const extras: { id: Vista; nombre: string }[] = modo === 'auto' ? [] : [
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
          {modo !== 'auto' && (
            <button type="button" className="boton-tema boton-atras" onClick={atras} title="Atrás" aria-label="Atrás">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
          )}
          <LogoReinicio alReiniciar={reiniciar} alReiniciarTodo={alSalir} />
          <nav className="capitulos" aria-label="Capítulos">
            {CAPITULOS.map((c, i) => (
              <button key={c.id} disabled={modo === 'auto'} onClick={() => ir(c.id as Capitulo)} data-proli={`cap-${c.id}`}
                      className={`capitulo ${c.id === vista ? 'capitulo--actual' : iActual > i ? 'capitulo--hecho' : ''}`}>
                <span className="capitulo__n">{numeroDe(c.id)}</span><span className="capitulo__nombre">{c.nombre}</span>
              </button>
            ))}
          </nav>
          {extras.length > 0 && (
            <div className="cabecera__extra">
              {extras.map((x) => (
                <button key={x.id} className={`boton-extra ${vista === x.id ? 'boton-extra--activo' : ''}`} onClick={() => ir(x.id)} data-proli={`cap-${x.id}`}>{x.nombre}</button>
              ))}
            </div>
          )}
          <BotonTema />
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
        <span className="pie__marca">{esTotem(modo) ? EMPRESA : <a href={URL_EMPRESA} target="_blank" rel="noopener noreferrer">{EMPRESA} ↗</a>} · GovTech 2026</span>
        {editados && <span className="pie__aviso">Supuestos editados</span>}
        <span>Familias sintéticas (1 = {datos.familias.estudiantes_por_familia} niños) · SED 03.2025 · hasta {supuestos.opciones} colegios por familia ·
          reubicación ≤ {decimal(supuestos.radioReubicacionKm)} km · distancia en línea recta{datos.indice.fuente === 'sintetica' && ' · DATOS SINTÉTICOS'}</span>
        {modo === 'escritorio' && <span className="atajos"><kbd>←</kbd> <kbd>→</kbd> capítulos · <kbd>F</kbd> pantalla completa</span>}
      </footer>
      {entrada}
    </div>
  )
}
