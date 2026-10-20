/**
 * Mapa vectorial plano de las UPZ con deck.gl, SIN mapa base ni teselas (100% offline).
 *
 * Capas:
 *  - UPZ coloreadas por % de niños sin cupo (escala secuencial naranja; transición suave al
 *    cambiar de escenario, menos de 200 ms de respuesta porque todo está precalculado)
 *  - Contorno grueso de la zona crítica
 *  - Sedes oficiales (puntos)
 *  - Ubicaciones posibles del colegio nuevo (círculos azules numerados; el elegido, grande)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator, WebMercatorViewport, type PickingInfo } from '@deck.gl/core'
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { COLORES, ESCALA_SIN_CUPO } from '../config'
import type { Bbox, Datos, Feature, PropsUpz, UbicacionNueva } from '../datos'

type RGB = [number, number, number]
const conAlfa = (c: RGB, a: number): [number, number, number, number] => [c[0], c[1], c[2], a]

export const colorSinCupo = (pct: number): RGB => (ESCALA_SIN_CUPO.find((e) => pct < e.hasta) ?? ESCALA_SIN_CUPO[ESCALA_SIN_CUPO.length - 1]).color

interface Props {
  datos: Datos
  /** % sin cupo por UPZ en el orden de indice.upz (null = sin colorear) */
  porUpz: number[] | null
  encuadre?: 'ciudad' | 'zona' | Bbox
  colegioNuevo?: string | null
  mostrarCandidatos?: boolean
  /** latido suave (modo espera) */
  respirar?: boolean
  upzSeleccionada?: string | null
  onTocarUpz?: (codigo: string) => void
  onTocarCandidato?: (clave: string) => void
  interactivo?: boolean
  margenArriba?: number
  margenAbajo?: number
}

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

function useRespiro(activo: boolean) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!activo) return
    let id = 0, ultimo = 0
    const paso = (ms: number) => {
      if (ms - ultimo > 50) { setT(ms / 1000); ultimo = ms }
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [activo])
  return activo ? 0.5 + 0.5 * Math.sin(t * 1.6) : 1
}

export default function MapaSimulador({
  datos, porUpz, encuadre = 'ciudad', colegioNuevo = null, mostrarCandidatos = false, respirar = false,
  upzSeleccionada = null, onTocarUpz, onTocarCandidato, interactivo = false, margenArriba = 0.05, margenAbajo = 0.05,
}: Props) {
  const [ref, { w, h }] = useTamano<HTMLDivElement>()
  const respiro = useRespiro(respirar)
  const [centrar, setCentrar] = useState(0)

  const viewState = useMemo(() => {
    const bbox = encuadre === 'ciudad' ? datos.bboxCiudad : encuadre === 'zona' ? datos.bboxZonaCritica : encuadre
    const pad = Math.round(w * 0.05)
    const vp = new WebMercatorViewport({ width: Math.max(w, 50), height: Math.max(h, 50) }).fitBounds(bbox, {
      padding: { top: Math.round(h * margenArriba) + pad, bottom: Math.round(h * margenAbajo) + pad, left: pad, right: pad },
    })
    return {
      longitude: vp.longitude, latitude: vp.latitude, zoom: vp.zoom, pitch: 0, bearing: 0,
      transitionDuration: 1200, transitionInterpolator: new FlyToInterpolator({ speed: 1.6 }),
    }
  }, [encuadre, w, h, margenArriba, margenAbajo, datos, centrar])

  const zona = useMemo(() => ({ type: 'FeatureCollection', features: datos.upz.features.filter((f) => f.properties.zona_critica) }), [datos])
  const sedes = useMemo(() => datos.colegios.features.filter((f) => f.properties.tipo === 'sede'), [datos])
  const candidatos = datos.indice.colegio_nuevo

  const capas = [
    new GeoJsonLayer<PropsUpz>({
      id: 'upz',
      data: datos.upz as any,
      filled: true,
      stroked: true,
      pickable: !!onTocarUpz,
      opacity: respirar ? 0.7 + 0.3 * respiro : 1,
      getFillColor: (f: Feature<PropsUpz>) => {
        if (!porUpz) return conAlfa(COLORES.fondo, 255)
        const pct = porUpz[datos.posUpz[f.properties.codigo]] ?? 0
        return conAlfa(colorSinCupo(pct), 255)
      },
      getLineColor: (f: Feature<PropsUpz>) =>
        f.properties.codigo === upzSeleccionada ? conAlfa(COLORES.azul, 255) : [255, 255, 255, 230],
      getLineWidth: (f: Feature<PropsUpz>) => (f.properties.codigo === upzSeleccionada ? 4 : 1),
      lineWidthUnits: 'pixels',
      updateTriggers: { getFillColor: [porUpz], getLineColor: [upzSeleccionada], getLineWidth: [upzSeleccionada] },
      transitions: { getFillColor: 450 },
      onClick: (info: PickingInfo<Feature<PropsUpz>>) => { if (info.object) onTocarUpz?.(info.object.properties.codigo) },
    }),
    new GeoJsonLayer({
      id: 'zona-critica',
      data: zona as any,
      filled: false,
      stroked: true,
      getLineColor: conAlfa(COLORES.azulOscuro, 255),
      getLineWidth: 3,
      lineWidthUnits: 'pixels',
    }),
    new ScatterplotLayer({
      id: 'sedes',
      data: sedes,
      getPosition: (f: any) => f.geometry.coordinates,
      getRadius: 1.6,
      radiusUnits: 'pixels',
      getFillColor: conAlfa(COLORES.azulOscuro, 150),
    }),
    ...(mostrarCandidatos || colegioNuevo ? [
      new ScatterplotLayer<UbicacionNueva>({
        id: 'candidatos',
        data: candidatos.filter((c) => mostrarCandidatos || c.clave === colegioNuevo),
        pickable: !!onTocarCandidato,
        getPosition: (c) => [c.lon, c.lat],
        getRadius: (c) => (c.clave === colegioNuevo ? 15 : 10),
        radiusUnits: 'pixels',
        getFillColor: (c) => (c.clave === colegioNuevo ? conAlfa(COLORES.azul, 255) : [255, 255, 255, 255]),
        getLineColor: conAlfa(COLORES.azul, 255),
        stroked: true,
        lineWidthMinPixels: 3,
        updateTriggers: { getRadius: [colegioNuevo], getFillColor: [colegioNuevo] },
        transitions: { getRadius: 250 },
        onClick: (info: PickingInfo<UbicacionNueva>) => { if (info.object) onTocarCandidato?.(info.object.clave) },
      }),
      new TextLayer<UbicacionNueva>({
        id: 'candidatos-numero',
        data: candidatos.filter((c) => mostrarCandidatos || c.clave === colegioNuevo),
        getPosition: (c) => [c.lon, c.lat],
        getText: (c) => String(candidatos.indexOf(c) + 1),
        getSize: (c) => (c.clave === colegioNuevo ? 16 : 12),
        getColor: (c) => (c.clave === colegioNuevo ? [255, 255, 255, 255] : conAlfa(COLORES.azul, 255)),
        fontFamily: 'Space Grotesk Variable, sans-serif',
        fontWeight: 700,
        updateTriggers: { getSize: [colegioNuevo], getColor: [colegioNuevo] },
      }),
    ] : []),
  ]

  return (
    <div ref={ref} className="mapa">
      <DeckGL
        initialViewState={viewState}
        controller={interactivo ? { dragRotate: false, touchRotate: false, doubleClickZoom: true, scrollZoom: { speed: 0.02, smooth: true } } : false}
        layers={capas}
        getCursor={({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering && onTocarUpz ? 'pointer' : interactivo ? 'grab' : 'default')}
      />
      {interactivo && <button className="mapa-centrar" onClick={() => setCentrar((x) => x + 1)} title="Volver a centrar el mapa">⤢ Centrar</button>}
    </div>
  )
}

/** Leyenda de la escala de % sin cupo (con texto, no solo color). */
export function LeyendaSinCupo({ titulo = 'Niños sin cupo por UPZ' }: { titulo?: string }) {
  return (
    <div className="leyenda-mapa">
      <span className="leyenda-mapa__titulo">{titulo}</span>
      <div className="leyenda-mapa__escala">
        {ESCALA_SIN_CUPO.map((e) => (
          <span key={e.etiqueta}><i style={{ background: `rgb(${e.color.join(',')})` }} />{e.etiqueta}</span>
        ))}
      </div>
      <span className="leyenda-mapa__zona"><i />Zona crítica</span>
    </div>
  )
}
