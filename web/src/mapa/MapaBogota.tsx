/**
 * Mapa vectorial plano de Bogotá con deck.gl, SIN mapa base (100% offline).
 *
 * Capas:
 *  - UPZ coloreadas por déficit / superávit (respiran en el modo espera)
 *  - Bordes de localidades
 *  - Colegios (puntos)
 *  - Líneas estudiante → colegio. Las posiciones finales se animan en la GPU con
 *    `transitions`: al pasar de "hoy" a "Matrícula+" cada línea se reacomoda.
 *  - Niños sin cupo (puntos rojos que laten)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator, WebMercatorViewport, type PickingInfo } from '@deck.gl/core'
import { GeoJsonLayer, LineLayer, ScatterplotLayer } from '@deck.gl/layers'
import { COLORES } from '../config'
import type { Bbox, Datos, PropsUpz } from '../datos'

export type FaseMapa = 'espera' | 'problema' | 'hoy' | 'matricula'

interface Props {
  datos: Datos
  fase: FaseMapa
  /** localidad enfocada (null = toda la ciudad) */
  localidad: string | null
  onTocarLocalidad?: (localidad: string) => void
  /** si está definido, tocar una UPZ la selecciona (en vez de cambiar de localidad) */
  onTocarUpz?: (codigo: string) => void
  upzSeleccionada?: string | null
  /** permite arrastrar y hacer zoom con los dedos (celular) */
  interactivo?: boolean
  /** márgenes (fracción del alto) que tapan los textos de arriba y los botones de abajo */
  margenArriba?: number
  margenAbajo?: number
}

const UMBRAL_LARGO = 40
type RGBA = [number, number, number, number]
const conAlfa = (c: [number, number, number], a: number): RGBA => [c[0], c[1], c[2], a]

/** Reloj de animación compartido (~30 fps es suficiente para respirar y latir). */
function useReloj(activo: boolean) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!activo) return
    let id = 0
    let ultimo = 0
    const paso = (ms: number) => {
      if (ms - ultimo > 33) { setT(ms / 1000); ultimo = ms }
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [activo])
  return t
}

/** Tamaño del contenedor, para encuadrar la localidad con fitBounds. */
function useTamano<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [tam, setTam] = useState({ w: 390, h: 844 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setTam({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, tam] as const
}

function encuadrar(bbox: Bbox, w: number, h: number, arriba: number, abajo: number) {
  const vp = new WebMercatorViewport({ width: w, height: h })
  const pad = Math.round(w * 0.06)
  const { longitude, latitude, zoom } = vp.fitBounds(bbox, {
    padding: { top: Math.round(h * arriba) + pad, bottom: Math.round(h * abajo) + pad, left: pad, right: pad },
  })
  return { longitude, latitude, zoom }
}

export default function MapaBogota({
  datos, fase, localidad, onTocarLocalidad, onTocarUpz, upzSeleccionada = null, interactivo = false, margenArriba = 0.22, margenAbajo = 0.2,
}: Props) {
  const [ref, { w, h }] = useTamano<HTMLDivElement>()
  const t = useReloj(true)
  const { muestra } = datos.hoy
  const n = muestra.lon.length

  // --- Cámara: toda la ciudad o la localidad elegida, con vuelo suave ---
  const viewState = useMemo(() => {
    const bbox = localidad && fase !== 'espera' ? datos.bboxLocalidad[localidad] : datos.bboxCiudad
    return {
      ...encuadrar(bbox, w, h, margenArriba, margenAbajo),
      pitch: 0, bearing: 0,
      transitionDuration: 1600,
      transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }),
    }
  }, [localidad, fase, w, h, margenArriba, margenAbajo, datos])

  const enFoco = (loc: string) => !localidad || fase === 'espera' || loc === localidad

  // Índices de la muestra (los datos de las capas son índices, las posiciones salen de los arreglos)
  const indices = useMemo(() => Array.from({ length: n }, (_, i) => i), [n])
  const sinCupoAlguna = useMemo(
    () => indices.filter((i) => datos.hoy.muestra.sede[i] < 0 || datos.matricula.muestra.sede[i] < 0),
    [indices, datos],
  )

  const maxCupos = useMemo(() => Math.max(1, ...datos.colegios.map((c) => c.cupos)), [datos])
  const escenario = fase === 'matricula' ? datos.matricula : datos.hoy
  const lineasVisibles = fase === 'hoy' || fase === 'matricula'

  const respiro = 0.5 + 0.5 * Math.sin(t * 1.6)          // 0..1
  const latido = 1 + 0.35 * Math.max(0, Math.sin(t * 4))  // radio de los sin cupo

  const capas = [
    new GeoJsonLayer<PropsUpz>({
      id: 'upz',
      data: datos.upz as any,
      filled: true,
      stroked: true,
      pickable: !!(onTocarLocalidad || onTocarUpz),
      opacity: fase === 'espera' ? 0.55 + 0.3 * respiro : 0.85,
      getFillColor: (f: { properties: PropsUpz }) => {
        const p = f.properties
        const base = COLORES[p.estado]
        const intensidad = p.estado === 'equilibrio' ? 110 : 90 + Math.min(1, Math.abs(p.balance_pct)) * 140
        return conAlfa(base, enFoco(p.localidad) ? intensidad : 28)
      },
      getLineColor: (f: { properties: PropsUpz }) =>
        f.properties.codigo === upzSeleccionada ? [255, 255, 255, 255] : conAlfa(COLORES.borde, 255),
      lineWidthUnits: 'pixels',
      getLineWidth: (f: { properties: PropsUpz }) => (f.properties.codigo === upzSeleccionada ? 3.5 : 1),
      updateTriggers: { getFillColor: [localidad, fase], getLineColor: [upzSeleccionada], getLineWidth: [upzSeleccionada] },
      transitions: { getFillColor: 700 },
      onClick: (info: PickingInfo<{ properties: PropsUpz }>) => {
        if (!info.object) return
        if (onTocarUpz) onTocarUpz(info.object.properties.codigo)
        else onTocarLocalidad?.(info.object.properties.localidad)
      },
    }),
    new GeoJsonLayer({
      id: 'localidades',
      data: datos.localidades as any,
      filled: false,
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineColor: (f: any) => [255, 255, 255, enFoco(f.properties.nombre) && localidad && fase !== 'espera' ? 255 : 90],
      getLineWidth: (f: any) => (f.properties.nombre === localidad && fase !== 'espera' ? 3 : 1.2),
      updateTriggers: { getLineColor: [localidad, fase], getLineWidth: [localidad, fase] },
    }),
    new ScatterplotLayer({
      id: 'colegios',
      data: datos.colegios,
      getPosition: (c) => [c.lon, c.lat],
      // Tamaño relativo al colegio más grande (funciona igual con cupos de muestra o reales)
      getRadius: (c) => 45 + 190 * Math.sqrt(c.cupos / maxCupos),
      radiusUnits: 'meters',
      radiusMinPixels: 1.5,
      getFillColor: (c) => conAlfa(COLORES.colegio, enFoco(c.localidad) ? 230 : 70),
      updateTriggers: { getFillColor: [localidad, fase] },
    }),
    new LineLayer<number>({
      id: 'asignaciones',
      data: indices,
      getSourcePosition: (i) => [muestra.lon[i], muestra.lat[i]],
      getTargetPosition: (i) => {
        const s = escenario.muestra.sede[i]
        if (!lineasVisibles || s < 0) return [muestra.lon[i], muestra.lat[i]]   // longitud cero
        const c = datos.colegios[s]
        return [c.lon, c.lat]
      },
      getColor: (i) => {
        if (!lineasVisibles) return [255, 255, 255, 0]
        const largo = escenario.muestra.tiempo_min[i] > UMBRAL_LARGO
        const primera = escenario.muestra.opcion[i] === 1
        const base = largo ? COLORES.deficit : primera ? COLORES.acento : ([200, 210, 225] as [number, number, number])
        return conAlfa(base, enFoco(datos.localidadMuestra[i]) ? 210 : 35)
      },
      widthUnits: 'pixels',
      getWidth: 1.3,
      updateTriggers: { getTargetPosition: [fase], getColor: [fase, localidad] },
      transitions: {
        getTargetPosition: { duration: 1800, easing: (x: number) => 1 - Math.pow(1 - x, 3) },
        getColor: 900,
      },
    }),
    new ScatterplotLayer<number>({
      id: 'sin-cupo',
      data: sinCupoAlguna,
      getPosition: (i) => [muestra.lon[i], muestra.lat[i]],
      getRadius: (i) => (lineasVisibles && escenario.muestra.sede[i] < 0 ? 3.5 : 0),
      radiusUnits: 'pixels',
      radiusScale: latido,
      getFillColor: (i) => conAlfa(COLORES.deficit, enFoco(datos.localidadMuestra[i]) ? 255 : 90),
      stroked: true,
      getLineColor: [255, 255, 255, 180],
      lineWidthMinPixels: 0.5,
      updateTriggers: { getRadius: [fase], getFillColor: [localidad, fase] },
      transitions: { getRadius: { duration: 700, enter: () => [0] } },
    }),
  ]

  return (
    <div ref={ref} className="mapa">
      <DeckGL
        initialViewState={viewState}
        controller={interactivo ? { dragRotate: false, touchRotate: false, doubleClickZoom: false } : false}
        layers={capas}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'default')}
      />
    </div>
  )
}
