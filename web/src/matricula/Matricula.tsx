/**
 * Matrícula+: «¿Y si más niños pudieran estudiar cerca de casa sin construir nuevos colegios?».
 * Sección propia: sus datos (public/matricula/datos, de engine/reparto_v2.py) solo se leen aquí.
 *
 * Formato vertical (documento de Paola, 29 oct), con componentes/Recorrido: Portada → El problema →
 * La solución → La gran revelación → La segunda revelación → Cómo lo hicimos → Tu reto. Arriba,
 * «Paso N de 6» y atrás (también el atrás del celular); el logo reinicia; teclado en escritorio;
 * recorrido solo en ?modo=auto. Criterios, tablas y metodología se abren en una hoja.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { APP_NAME, DURACION_PASOS_MATRICULA, EMPRESA, LEMA_MATRICULA, LOCALIDAD_EJEMPLO_MATRICULA, SEGUNDOS_INACTIVIDAD, URL_EMPRESA } from '../config'
import { esTotem, leerModo, modoAutomatico, type Modo } from '../modo'
import { pulsoLogo } from '../componentes/Marca'
import { CabeceraRecorrido, EscenaRecorrido, HojaRecorrido, type ItemLeyenda } from '../componentes/Recorrido'
import Intro from '../componentes/Intro'
import Esqueleto from '../componentes/Esqueleto'
import { informarPantalla, registrar, useReto } from '../proli/ordenes'
import { recordado, recordar } from '../recordar'
import { cargarMatricula, entero, type DatosMatricula } from './datos'
import MapaMatricula from './MapaMatricula'
import {
  CAPITULOS_MAT, HojaCriterios, HojaDatos, HojaEscenario, HojaMetodologia, PANTALLAS, pasoDe,
  type CapituloMat, type HojaMat, type PropsMat, type VistaMat,
} from './Paneles'

const ORDEN: VistaMat[] = ['portada', ...CAPITULOS_MAT.map((c) => c.id)]
const HOJAS: HojaMat[] = ['escenario', 'criterios', 'datos', 'metodologia']
/** En qué paso vive cada detalle (si Proli lo abre, el demo va primero a ese paso) */
const PASO_DE_HOJA: Record<HojaMat, CapituloMat> = { escenario: 'problema', criterios: 'solucion', datos: 'resultados', metodologia: 'como' }

interface Recordado { vista: VistaMat; localidad: string | null; reparto: 'hoy' | 'despues' }

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
  // La gran revelación empieza con el escenario de referencia; el visitante revela Matrícula+
  const [reparto, setReparto] = useState<'hoy' | 'despues'>(antes?.reparto ?? 'hoy')
  const [hoja, setHoja] = useState<HojaMat | null>(null)
  const [verQr, setVerQr] = useState(false)
  const [vuelta, setVuelta] = useState(0)
  const reto = useReto()

  useEffect(() => {
    setError(null)
    cargarMatricula().then(setDatos).catch((e) => setError(String(e.message ?? e)))
  }, [intento])
  useEffect(() => { recordar('matricula', { vista, localidad, reparto } satisfies Recordado) }, [vista, localidad, reparto])
  useEffect(() => () => recordar('matricula', null), [])
  useEffect(() => { document.documentElement.dataset.modo = modo }, [modo])
  useEffect(() => {
    if (!modoAutomatico()) return
    const alCambiar = () => setModo(leerModo())
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])

  // Al cambiar de pantalla se cierran los detalles; el logo late cuando algo cambia
  const primerPulso = useRef(true)
  useEffect(() => {
    if (primerPulso.current) { primerPulso.current = false; return }
    pulsoLogo()
  }, [vista, localidad, reparto])

  // Historial para "← Atrás"
  const pila = useRef<VistaMat[]>([])
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const reiniciar = useCallback(() => {
    pila.current = []
    setVista('portada'); setLocalidad(null); setReparto('hoy'); setHoja(null); setVerQr(false)
  }, [])
  // Al cambiar de pantalla se cierran los detalles y el QR
  const ir = useCallback((v: VistaMat) => {
    if (v === 'portada') return reiniciar()
    setHoja(null); setVerQr(false)
    if (v === 'antes' && vistaRef.current !== 'antes') setReparto('hoy')
    if (v === 'resultados' && vistaRef.current !== 'resultados') setLocalidad(null)
    if (vistaRef.current !== v) pila.current.push(vistaRef.current)
    setVista(v)
  }, [reiniciar])
  /** Un paso atrás: primero cierra el detalle abierto o suelta la localidad; en la portada, vuelve al inicio. */
  const atras = useCallback(() => {
    if (hoja) return setHoja(null)
    if (vista === 'portada') return alSalir?.()
    if (vista === 'resultados' && localidad) return setLocalidad(null)
    const i = ORDEN.indexOf(vista)
    setVerQr(false)
    setVista(pila.current.pop() ?? (i > 0 ? ORDEN[i - 1] : 'portada'))
  }, [vista, hoja, localidad, alSalir])
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
          const h = String(e.capitulo) as HojaMat
          if (HOJAS.includes(h)) { refIr.current(PASO_DE_HOJA[h]); setHoja(h); return `Listo: ${APP_NAME} muestra el detalle «${h}».` }
          if (e.capitulo === 'agenda') { refIr.current('reto'); setVerQr(true); return 'Listo: el visitante ve el código QR para enviar su solicitud al equipo (todavía no es una cita).' }
          const v = String(e.capitulo) as VistaMat
          if (!ORDEN.includes(v)) return 'Capítulo no reconocido.'
          refIr.current(v)
          return `Listo: ${APP_NAME} muestra ${v === 'portada' ? 'su portada' : `el paso «${CAPITULOS_MAT.find((c) => c.id === v)!.nombre}»`}.`
        }
        case 'matricula_localidad': {
          if (e.localidad === 'TODA_BOGOTA') { refIr.current('resultados'); setLocalidad(null); return 'Listo: el mapa muestra toda Bogotá.' }
          const l = Object.keys(datos.r.por_localidad).find((x) => x.localeCompare(String(e.localidad), 'es', { sensitivity: 'base' }) === 0)
          if (!l) return `Localidad no reconocida en ${APP_NAME}.`
          const c = datos.r.por_localidad[l]
          refIr.current('resultados'); setLocalidad(l)
          return `Listo: el mapa muestra ${l}: ${entero(c.lejos_antes)} estudiantes lejos en el escenario de referencia y ${entero(c.lejos_despues)} con ${APP_NAME}.`
        }
        case 'matricula_reparto': {
          if (e.reparto !== 'hoy' && e.reparto !== 'despues') return 'Reparto no reconocido.'
          refIr.current('antes'); setReparto(e.reparto)
          return `Listo: el mapa muestra ${e.reparto === 'hoy' ? 'el escenario de referencia (orden de llegada)' : `la simulación con ${APP_NAME}`}.`
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
      localidad && vista === 'resultados' ? `localidad ${localidad}` : '',
      vista === 'antes' ? `mapa ${reparto === 'hoy' ? 'del escenario de referencia' : `con ${APP_NAME}`}` : '',
      hoja ? `detalle ${hoja} abierto` : '',
    ].filter(Boolean)
    informarPantalla(`${APP_NAME}, capítulo ${cap}${extra.map((x) => `, ${x}`).join('')}`)
  }, [datos, vista, localidad, reparto, hoja])

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

  // Modo automático: recorre los pasos y «toca» lo que tocaría un visitante
  useEffect(() => {
    if (modo !== 'auto' || !datos || intro) return
    const timers: number[] = []
    const en = (s: number, f: () => void) => timers.push(window.setTimeout(f, s * 1000))
    if (vista === 'antes') { setReparto('hoy'); en(3, () => setReparto('despues')) }
    if (vista === 'resultados') {
      // El ejemplo acordado primero; en las vueltas siguientes, otra de las que más mejoran
      const mejoran = Object.entries(datos.r.por_localidad).sort((a, b) => (b[1].lejos_antes - b[1].lejos_despues) - (a[1].lejos_antes - a[1].lejos_despues)).map(([l]) => l)
      const lista = [LOCALIDAD_EJEMPLO_MATRICULA, ...mejoran.filter((l) => l !== LOCALIDAD_EJEMPLO_MATRICULA)].slice(0, 4)
      setLocalidad(null); en(5, () => setLocalidad(lista[vuelta % lista.length]))
    }
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
      if (e.key === 'Escape' && hoja) setHoja(null)
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); ir(ORDEN[Math.min(ORDEN.length - 1, i + 1)]) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); if (i > 0) ir(ORDEN[i - 1]) }
      else if (e.key === 'Home') ir('portada')
      else if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) document.exitFullscreen?.()
        else document.documentElement.requestFullscreen?.().catch(() => {})
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [modo, vista, hoja, ir])

  const propsMapa = useMemo((): Omit<ComponentProps<typeof MapaMatricula>, 'datos'> => {
    const interactivo = modo !== 'auto' && vista !== 'portada'
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const margen = { arriba: rem * (vista === 'antes' && modo !== 'auto' ? 3.4 : 0.5), abajo: rem * 0.5 }
    switch (vista) {
      case 'problema': case 'solucion': return { capa: 'hoy', interactivo, margen, leyenda: false }
      case 'antes': return { capa: reparto, interactivo, margen, leyenda: false }
      case 'resultados': return { capa: 'faltan', nivel: null, localidad, onLocalidad: interactivo ? setLocalidad : undefined, interactivo, margen, leyenda: false }
      // Portada, cómo y reto: la ciudad que respira, sin leyenda ni cifras
      default: return { capa: 'hoy', interactivo: false, respirar: true, leyenda: false, margen }
    }
  }, [vista, modo, localidad, reparto])

  const entrada = intro && <Intro alTerminar={() => setIntro(false)} nombre={APP_NAME} lema={LEMA_MATRICULA} />
  if (error || !datos) {
    return (
      <div className="app">
        <Esqueleto error={error} reintentar={() => setIntento((x) => x + 1)} nombre={APP_NAME} variante="tinta" estado="Cargando cupos escolares de Bogotá" />
        {entrada}
      </div>
    )
  }

  const props: PropsMat = {
    datos, modo, ir, reparto, setReparto, localidad, verQr, setVerQr, abrirHoja: setHoja, reto, alInicio: alSalir,
  }
  const p = PANTALLAS[vista](props)
  const paso = vista === 'portada' ? 0 : pasoDe(vista as CapituloMat)
  const s = datos.r.simulacion
  const porPunto = `Cada punto representa ${entero(datos.r.ninos_por_grupo_simulado)} estudiantes`
  const lejos = `a más de ${entero(datos.r.radio_km)} km de casa`
  const leyenda: ItemLeyenda[] | undefined =
    vista === 'problema' ? [{ clase: 'k-pp--morado', texto: `${porPunto} ${lejos}` }]
      : vista === 'antes' ? [
        { clase: 'k-pp--morado', texto: `${porPunto} ${lejos}` },
        ...(reparto === 'despues' ? [{ clase: 'k-pp--verde', texto: 'Estaban lejos y ahora quedan cerca' }] : []),
      ]
        : vista === 'resultados' ? [
          { clase: 'k-pp--rampa', texto: `Estudiantes que siguen lejos con ${APP_NAME}, por localidad` },
          { clase: 'k-pp--tinta', texto: porPunto },
        ] : undefined

  return (
    <div className={`app app--matricula app--pp app--pp-${vista}`}>
      <CabeceraRecorrido paso={paso} total={CAPITULOS_MAT.length} modo={modo} nombre={APP_NAME} reiniciar={reiniciar}
                         alSalir={alSalir} alPortada={alPortada} />
      <EscenaRecorrido vista={vista} p={p} leyenda={leyenda} fondoVivo={modo === 'escritorio' && vista !== 'como'} atras={vista !== 'portada' && modo !== 'auto' ? atras : undefined}
                       alTocar={vista === 'portada' && modo === 'stand' ? () => ir('problema') : undefined}
                       mapa={<MapaMatricula datos={datos} {...propsMapa}>{!p.visual && p.sobreMapa}</MapaMatricula>} />

      <footer className="pie">
        <span className="pie__marca">{esTotem(modo) ? EMPRESA : <a href={URL_EMPRESA} target="_blank" rel="noopener noreferrer">{EMPRESA} ↗</a>} · GovTech 2026</span>
        <span>Simulación con datos abiertos de la Secretaría de Educación y Planeación · {entero(s.ninos)} estudiantes recreados en grupos de {datos.r.ninos_por_grupo_simulado} ·
          distancia en línea recta · sin datos personales · modelo {datos.r.version}</span>
        {modo === 'escritorio' && <span className="atajos"><kbd>←</kbd> <kbd>→</kbd> pasos · <kbd>F</kbd> pantalla completa</span>}
      </footer>

      <HojaRecorrido abierta={hoja != null} cerrar={() => setHoja(null)}>
        {hoja === 'escenario' ? <HojaEscenario datos={datos} />
          : hoja === 'criterios' ? <HojaCriterios datos={datos} />
            : hoja === 'datos' ? <HojaDatos datos={datos} />
              : <HojaMetodologia datos={datos} modo={modo} />}
      </HojaRecorrido>
      {entrada}
    </div>
  )
}
