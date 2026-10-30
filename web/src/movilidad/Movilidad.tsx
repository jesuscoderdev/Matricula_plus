/**
 * Presupuesto+ (antes Movilidad+): con el mismo presupuesto para seguridad vial, analizar más
 * información cambia dónde se invierte. Sección propia: sus datos (public/movilidad/datos) solo se
 * leen aquí.
 *
 * Formato vertical (revisión de Paola, 29 oct): cada pantalla tiene titular, visual (el mapa u otro),
 * conclusión y un botón principal, en una sola columna y sin scroll; en horizontal, texto a la
 * izquierda y visual a la derecha. Arriba, «Paso N de 6» y atrás (también el atrás del celular); el
 * logo reinicia; teclado en escritorio; recorrido solo en ?modo=auto. Los detalles se abren en una hoja.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { DURACION_PASOS_MOVILIDAD, EMPRESA, LEMA_MOVILIDAD, NOMBRE_MOVILIDAD, SEGUNDOS_INACTIVIDAD, URL_EMPRESA } from '../config'
import { esTotem, leerModo, modoAutomatico, type Modo } from '../modo'
import { pulsoLogo } from '../componentes/Marca'
import { CabeceraRecorrido, EscenaRecorrido, HojaRecorrido } from '../componentes/Recorrido'
import Intro from '../componentes/Intro'
import Esqueleto from '../componentes/Esqueleto'
import { cargarMovilidad, type DatosMovilidad } from './datos'
import { informarPantalla, registrar, useReto } from '../proli/ordenes'
import { recordado, recordar } from '../recordar'
import MapaMovilidad from './MapaMovilidad'
import {
  CAPITULOS_MOV, HojaMetodologia, PANTALLAS, etiquetasMapa, pasoDe, tamanoHex,
  type CapituloMov, type Hoja, type PropsMov, type VistaMov,
} from './Paneles'
import { guionDe } from './guion'

const ORDEN: VistaMov[] = ['portada', ...CAPITULOS_MOV.map((c) => c.id)]

interface Recordado { vista: VistaMov; lista: 'contar' | 'modelo'; version: string }

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
  // Antes y después: empieza con la selección basada en un año; el visitante revela la de Presupuesto+
  const [lista, setLista] = useState<'contar' | 'modelo'>(antes?.lista ?? 'contar')
  const [hoja, setHoja] = useState<Hoja | null>(null)
  const [verQr, setVerQr] = useState(false)
  const [vuelta, setVuelta] = useState(0)
  const reto = useReto()

  useEffect(() => {
    setError(null)
    cargarMovilidad().then(setDatos).catch((e) => setError(String(e.message ?? e)))
  }, [intento])
  useEffect(() => {
    if (datos) recordar('movilidad', { vista, lista, version: datos.experiencia.version_modelo } satisfies Recordado)
  }, [datos, vista, lista])
  useEffect(() => () => recordar('movilidad', null), [])
  useEffect(() => { document.documentElement.dataset.modo = modo }, [modo])
  useEffect(() => {
    if (!modoAutomatico()) return
    const alCambiar = () => setModo(leerModo())
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])

  // El logo late cuando cambia la pantalla
  const primerPulso = useRef(true)
  useEffect(() => {
    if (primerPulso.current) { primerPulso.current = false; return }
    pulsoLogo()
  }, [vista])

  // Historial para "← Atrás"
  const pila = useRef<VistaMov[]>([])
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const reiniciar = useCallback(() => {
    pila.current = []
    setVista('portada'); setLista('contar'); setHoja(null); setVerQr(false)
  }, [])
  // Al cambiar de pantalla se cierran los detalles y el QR
  const ir = useCallback((v: VistaMov) => {
    if (v === 'portada') return reiniciar()
    setHoja(null); setVerQr(false)
    if (v === 'antes') setLista('contar')
    if (vistaRef.current !== v) pila.current.push(vistaRef.current)
    setVista(v)
  }, [reiniciar])
  /** Un paso atrás: primero cierra el detalle abierto; en la portada, vuelve al inicio. */
  const atras = useCallback(() => {
    if (hoja) return setHoja(null)
    if (vista === 'portada') return alSalir?.()
    const i = ORDEN.indexOf(vista)
    setVerQr(false)
    setVista(pila.current.pop() ?? (i > 0 ? ORDEN[i - 1] : 'portada'))
  }, [vista, hoja, alSalir])
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

  // Proli puede mover este demo (src/proli/ordenes.ts). Se registra cuando ya hay datos; las órdenes
  // que llegaron mientras cargaba se aplican en ese momento.
  const refIr = useRef(ir)
  refIr.current = ir
  useEffect(() => {
    if (!datos) return
    return registrar('movilidad', (o) => {
      const e = o.entrada
      switch (o.nombre) {
        case 'movilidad_capitulo': {
          if (e.capitulo === 'metodologia') { refIr.current('como'); setHoja('metodologia'); return `Listo: ${NOMBRE_MOVILIDAD} muestra la metodología.` }
          if (e.capitulo === 'agenda') { refIr.current('reto'); setVerQr(true); return 'Listo: el visitante ve el código QR para enviar su solicitud al equipo (todavía no es una cita).' }
          const v = String(e.capitulo) as VistaMov
          if (!ORDEN.includes(v)) return 'Capítulo no reconocido.'
          refIr.current(v)
          return `Listo: ${NOMBRE_MOVILIDAD} muestra ${v === 'portada' ? 'su portada' : `el paso ${CAPITULOS_MOV.find((c) => c.id === v)!.nombre}`}.`
        }
        case 'movilidad_lista': {
          if (e.lista !== 'contar' && e.lista !== 'modelo') return 'Lista no reconocida.'
          refIr.current('antes'); setLista(e.lista)
          return `Listo: el mapa de Antes y después muestra ${e.lista === 'contar' ? 'la selección basada en un solo año' : `qué cambia con ${NOMBRE_MOVILIDAD}`}.`
        }
      }
      return `Acción no reconocida en ${NOMBRE_MOVILIDAD}.`
    })
  }, [datos])
  // Qué está viendo el visitante (Proli lo recibe como contexto)
  useEffect(() => {
    if (!datos) return
    const cap = vista === 'portada' ? 'portada' : CAPITULOS_MOV.find((c) => c.id === vista)?.nombre ?? vista
    const extra = vista === 'antes' ? `, mapa con ${lista === 'contar' ? 'la selección basada en un solo año' : `los cambios de ${NOMBRE_MOVILIDAD}`}`
      : hoja === 'metodologia' ? ', metodología abierta' : ''
    informarPantalla(`${NOMBRE_MOVILIDAD}, capítulo ${cap}${extra}`)
  }, [datos, vista, lista, hoja])

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
    if (vista === 'antes') { setLista('contar'); en(4, () => setLista('modelo')) }
    en(DURACION_PASOS_MOVILIDAD[vista], () => {
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

  const propsMapa = useMemo((): Omit<ComponentProps<typeof MapaMovilidad>, 'datos'> => {
    const interactivo = modo !== 'auto' && vista !== 'portada'
    if (!datos) return { capa: 'k24', interactivo: false, croquis: true }
    const g = guionDe(datos)
    const t = etiquetasMapa(datos)
    const cP = g.comparacionPresupuesto
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    // La leyenda va debajo del mapa (Leyenda); arriba, en Antes y después, el selector
    const margen = { arriba: rem * (vista === 'antes' && modo !== 'auto' ? 3.4 : 0.5), abajo: rem * 0.5 }
    const fondo = { croquis: true, capa: 'tenue' as const, interactivo, tituloLeyenda: t.fondo, margen, leyenda: false }
    const cambios = [
      { indices: g.comunesPresupuesto, color: 'gris' as const, texto: t.ambas },
      { indices: g.salenPresupuesto, color: 'morado' as const, tenue: true, texto: t.salen },
      { indices: g.entranPresupuesto, color: 'verde' as const, texto: t.entran },
    ]
    const seleccion2024 = [{ indices: cP.contar1.lista, color: 'morado' as const, texto: t.seleccion }]
    switch (vista) {
      case 'problema':
      case 'solucion':
        return { ...fondo, resaltar: seleccion2024 }
      case 'antes':
        return { ...fondo, resaltar: lista === 'contar' ? seleccion2024 : cambios }
      case 'resultados':
        return { ...fondo, resaltar: cambios }
      default:
        // Portada, cómo y reto: la ciudad que respira, sin leyenda ni cifras
        return { capa: 'k24', interactivo: false, respirar: true, leyenda: false, agrupar: true, croquis: true }
    }
  }, [vista, modo, datos, lista])

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
    datos, modo, ir, lista, setLista, verQr, setVerQr, abrirHoja: setHoja, reto, alInicio: alSalir,
  }
  const p = PANTALLAS[vista](props)
  const paso = vista === 'portada' ? 0 : pasoDe(vista as CapituloMov)
  const r = datos.resumen
  const leyenda = propsMapa.tituloLeyenda ? [
    { clase: 'k-pp--fondo', texto: propsMapa.tituloLeyenda },
    ...(propsMapa.resaltar ?? []).map((x) => ({ clase: `k-pp--${x.color} ${x.tenue ? 'k-pp--tenue' : ''}`, texto: x.texto ?? '' })),
  ] : undefined

  return (
    <div className={`app app--movilidad app--pp app--pp-${vista}`}>
      <CabeceraRecorrido paso={paso} total={CAPITULOS_MOV.length} modo={modo} nombre={NOMBRE_MOVILIDAD} reiniciar={reiniciar}
                         alSalir={alSalir} alPortada={alPortada} />
      <EscenaRecorrido vista={vista} p={p} leyenda={leyenda} atras={vista !== 'portada' && modo !== 'auto' ? atras : undefined}
                       alTocar={vista === 'portada' && modo === 'stand' ? () => ir('problema') : undefined}
                       mapa={<MapaMovilidad datos={datos} {...propsMapa}>{!p.visual && p.sobreMapa}</MapaMovilidad>} />

      <footer className="pie">
        <span className="pie__marca">{esTotem(modo) ? EMPRESA : <a href={URL_EMPRESA} target="_blank" rel="noopener noreferrer">{EMPRESA} ↗</a>} · GovTech 2026</span>
        <span>© colaboradores de OpenStreetMap · siniestros graves en zonas de {tamanoHex(datos)}, SDM {r.periodo_estimacion[0]}–{r.anio_validacion} ·
          modelo {r.version}</span>
        {modo === 'escritorio' && <span className="atajos"><kbd>←</kbd> <kbd>→</kbd> pasos · <kbd>F</kbd> pantalla completa</span>}
      </footer>

      <HojaRecorrido abierta={hoja != null} cerrar={() => setHoja(null)}>
        <HojaMetodologia datos={datos} modo={modo} />
      </HojaRecorrido>
      {entrada}
    </div>
  )
}
