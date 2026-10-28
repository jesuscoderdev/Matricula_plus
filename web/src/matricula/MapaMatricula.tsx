/**
 * El mapa de Matrícula+: el croquis de las localidades y, encima, los niños que quedan lejos de su
 * colegio (cada punto = un grupo simulado de 10 niños). Sin mapa base → 100 % offline.
 *
 *  · capa "hoy"       — lejos con el reparto de hoy (orden de llegada), en violeta
 *  · capa "prioridad" — los mismos, resaltando a quienes Matrícula+ da prioridad (estrato 1–2 y
 *                       menores de 10 o de 14 a 16 años)
 *  · capa "despues"   — lejos con Matrícula+ en violeta; en verde, los que estaban lejos y quedan cerca
 *  · capa "faltan"    — coropleta: niños que siguen lejos con Matrícula+ (de un nivel o de todos)
 * Al cambiar entre "hoy" y "despues", los puntos cambian de color y tamaño con una transición.
 * Con `onLocalidad`, tocar una localidad la elige (el mapa se acerca) y tocarla de nuevo, o
 * «Toda Bogotá», la suelta.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator, type PickingInfo } from '@deck.gl/core'
import { PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { encuadrar, type Margen } from '../mapa/encuadre'
import { useTema, type Tema } from '../tema'
import { entero, type Croquis, type DatosMatricula, type Nivel } from './datos'

type RGB = [number, number, number]
type RGBA = [number, number, number, number]
export type CapaMatricula = 'hoy' | 'prioridad' | 'despues' | 'faltan'

// Paleta del manual: índigo para «lejos», verde para «ahora cerca», pizarra para lo secundario
const PALETA: Record<Tema, { tierra: RGBA; tinta: RGBA; lejos: RGB; cerca: RGB; tenue: RGB; rampa: RGB[] }> = {
  claro: { tierra: [255, 255, 255, 255], tinta: [22, 43, 42, 255], lejos: [90, 68, 221], cerca: [61, 138, 75], tenue: [80, 91, 125],
    rampa: [[238, 235, 252], [190, 182, 246], [140, 124, 238], [90, 68, 221], [52, 38, 150]] },
  oscuro: { tierra: [23, 43, 42, 255], tinta: [240, 246, 245, 255], lejos: [160, 146, 248], cerca: [123, 198, 137], tenue: [142, 163, 182],
    rampa: [[36, 58, 60], [62, 52, 140], [96, 78, 214], [150, 136, 246], [220, 216, 255]] },
}

/** Lo que mide el contenedor del mapa */
function useTamano<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [tam, setTam] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setTam({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, tam] as const
}

/** ¿El punto cae dentro del anillo? (par-impar) */
function dentro([x, y]: [number, number], anillo: [number, number][]) {
  let si = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) si = !si
  }
  return si
}
const localidadEn = (croquis: Croquis[], p: [number, number]) => croquis.find((c) => c.anillos.some((a) => dentro(p, a)))?.nombre ?? null

interface Props {
  datos: DatosMatricula
  capa: CapaMatricula
  /** capa "faltan": el nivel que se colorea (null = todos) */
  nivel?: Nivel | null
  localidad?: string | null
  onLocalidad?: (l: string | null) => void
  interactivo?: boolean
  /** la portada: los puntos laten despacio */
  respirar?: boolean
  margen?: Margen
  leyenda?: boolean
  children?: ReactNode
}

export default function MapaMatricula({
  datos, capa, nivel = null, localidad = null, onLocalidad, interactivo = true, respirar = false, margen = {}, leyenda = true, children,
}: Props) {
  const tema = useTema()
  const P = PALETA[tema]
  const p = datos.puntos
  const [ref, { w, h }] = useTamano<HTMLDivElement>()
  const [centrar, setCentrar] = useState(0)
  const e = useMemo(() => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1, [w, h])
  const indices = useMemo(() => p.lon.map((_, i) => i), [p])
  const iLoc = localidad == null ? -1 : p.localidades.indexOf(localidad)
  const iNivel = nivel == null ? -1 : p.niveles.indexOf(nivel)

  // ---------------------------------------------------------------- cámara
  const marco = (localidad != null && datos.croquis.find((c) => c.nombre === localidad)?.bbox) || datos.bboxCiudad
  const viewState = useMemo(() => {
    const vp = encuadrar(marco, w, h, margen)
    return { longitude: vp.longitude, latitude: vp.latitude, zoom: Math.min(vp.zoom, 14), pitch: 0, bearing: 0,
      transitionDuration: 900, transitionInterpolator: new FlyToInterpolator({ speed: 1.8 }) }
  }, [marco[0][0], marco[0][1], marco[1][0], marco[1][1], w, h, margen.arriba, margen.abajo, margen.izquierda, margen.derecha, centrar])  // eslint-disable-line react-hooks/exhaustive-deps

  // Respiro suave (portada)
  const [respiro, setRespiro] = useState(1)
  useEffect(() => {
    if (!respirar || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let id = 0, ult = 0
    const paso = (ms: number) => { if (ms - ult > 60) { setRespiro(0.5 + 0.5 * Math.sin(ms / 800)); ult = ms } id = requestAnimationFrame(paso) }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [respirar])

  // ---------------------------------------------------------------- coropleta (capa "faltan")
  const valorLoc = useMemo(() => {
    const v = new Map<string, number>()
    for (const [nombre, c] of Object.entries(datos.r.por_localidad)) {
      v.set(nombre, nivel == null ? c.lejos_despues : c.lejos_despues_por_nivel[nivel])
    }
    return v
  }, [datos, nivel])
  const maxLoc = Math.max(1, ...valorLoc.values())
  const colorLoc = (nombre: string): RGBA => {
    const v = valorLoc.get(nombre) ?? 0
    if (v <= 0) return P.tierra
    const k = Math.min(P.rampa.length - 1, 1 + Math.floor((v / maxLoc) * (P.rampa.length - 1)))
    return [...P.rampa[k], 255]
  }

  // ---------------------------------------------------------------- puntos
  const prioritario = (i: number) => p.estrato[i] <= 2 && (p.edad[i] < 10 || p.edad[i] >= 14)
  const visibleEn = (i: number) => {
    if (capa === 'despues') return p.lejos_antes[i] === 1 || p.lejos_despues[i] === 1
    if (capa === 'faltan') return p.lejos_despues[i] === 1 && (iNivel < 0 || p.nivel[i] === iNivel)
    return p.lejos_antes[i] === 1
  }
  const color = (i: number): RGBA => {
    if (!visibleEn(i)) return [...P.lejos, 0]
    const fuera = iLoc >= 0 && p.localidad[i] !== iLoc
    const a = (x: number) => Math.round(x * (fuera ? 0.25 : 1))
    if (capa === 'despues' && p.lejos_despues[i] !== 1) return [...P.cerca, a(150)]
    if (capa === 'prioridad' && !prioritario(i)) return [...P.tenue, a(90)]
    if (capa === 'faltan') return [...P.tinta.slice(0, 3) as RGB, a(170)]
    return [...P.lejos, a(220)]
  }
  const radio = (i: number) => {
    if (!visibleEn(i)) return 0
    if (capa === 'despues' && p.lejos_despues[i] !== 1) return 1.6 * e
    if (capa === 'prioridad' && prioritario(i)) return 3.2 * e
    return (capa === 'faltan' ? 1.8 : 2.6) * e
  }

  // ---------------------------------------------------------------- croquis
  const anillos = useMemo(() => datos.croquis.flatMap((c) => c.anillos.map((a) => ({ c, a }))), [datos])
  const propia = (c: Croquis) => localidad != null && c.nombre === localidad
  const atenuada = (c: Croquis) => localidad != null && c.nombre !== localidad
  const mPorPx = (78271.52 * Math.cos((viewState.latitude * Math.PI) / 180)) / 2 ** viewState.zoom
  // Un nombre solo si cabe a lo ancho de su localidad (en el centro hay localidades pequeñas); la elegida siempre
  const nombres = useMemo(() => datos.croquis.filter((c) => {
    if (propia(c)) return true
    const anchoPx = ((c.bbox[1][0] - c.bbox[0][0]) * 111320 * Math.cos((c.etiqueta[1] * Math.PI) / 180)) / mPorPx
    return anchoPx > c.nombre.length * 11 * e * 0.62
  }), [datos, localidad, mPorPx, e])  // eslint-disable-line react-hooks/exhaustive-deps
  const t = P.tinta
  const transicion = { duration: 700 }

  const capas = [
    new PolygonLayer<{ c: Croquis; a: [number, number][] }>({
      id: 'tierra', data: anillos, filled: true, stroked: false, getPolygon: (d) => d.a,
      getFillColor: (d) => {
        const c = capa === 'faltan' ? colorLoc(d.c.nombre) : P.tierra
        return atenuada(d.c) ? [c[0], c[1], c[2], 150] : c
      },
      pickable: !!onLocalidad,
      updateTriggers: { getFillColor: [tema, localidad, capa, nivel] }, transitions: { getFillColor: 500 },
    }),
    new PathLayer<{ c: Croquis; a: [number, number][] }>({
      id: 'limites', data: anillos, getPath: (d) => d.a, widthUnits: 'pixels', jointRounded: true,
      getWidth: (d) => (propia(d.c) ? 3 : 1.1) * e,
      getColor: (d) => (propia(d.c) ? [...P.lejos, 255] : [t[0], t[1], t[2], atenuada(d.c) ? 50 : 90]) as RGBA,
      updateTriggers: { getWidth: [localidad, e], getColor: [localidad, tema] },
    }),
    new ScatterplotLayer<number>({
      id: 'ninos', data: indices, getPosition: (i) => [p.lon[i], p.lat[i]], radiusUnits: 'pixels',
      getRadius: radio, getFillColor: color, opacity: respirar ? 0.65 + 0.35 * respiro : 1,
      updateTriggers: { getRadius: [capa, nivel, e], getFillColor: [capa, nivel, localidad, tema] },
      transitions: { getRadius: transicion, getFillColor: transicion },
    }),
    new TextLayer<Croquis>({
      id: 'nombres', data: nombres, getPosition: (c) => c.etiqueta, getText: (c) => c.nombre,
      getSize: (c) => (propia(c) ? 15 : 11) * e, fontFamily: 'Poppins, sans-serif', fontWeight: 600, characterSet: 'auto',
      getColor: (c) => (propia(c) ? [...P.lejos, 255] : [t[0], t[1], t[2], atenuada(c) ? 110 : 200]) as RGBA,
      fontSettings: { sdf: true }, outlineWidth: 4, outlineColor: P.tierra,
      updateTriggers: { getSize: [localidad, e], getColor: [localidad, tema] },
    }),
  ]

  const alTocar = (info: PickingInfo) => {
    if (!onLocalidad || !info.coordinate) return
    const tocada = localidadEn(datos.croquis, info.coordinate as [number, number])
    if (tocada && datos.r.por_localidad[tocada]?.ninos) onLocalidad(tocada === localidad ? null : tocada)
  }

  const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`
  const n = (k: 'lejos_antes' | 'lejos_despues') => datos.r.grupos.bogota[k]
  return (
    <div ref={ref} className="mapa mapa--matricula">
      <DeckGL initialViewState={viewState} layers={capas} onClick={alTocar}
              controller={interactivo ? { dragRotate: false, touchRotate: false, doubleClickZoom: false, scrollZoom: { speed: 0.02, smooth: true } } : false}
              getCursor={({ isDragging, isHovering }) => (isDragging ? 'grabbing' : onLocalidad && isHovering ? 'pointer' : interactivo ? 'grab' : 'default')} />
      {onLocalidad && (localidad != null ? (
        <button className="mapa__localidad" onClick={() => onLocalidad(null)} title="Ver toda Bogotá">
          <b>{localidad}</b><span>✕ Toda Bogotá</span>
        </button>
      ) : <span className="mapa__localidad mapa__localidad--pista">Toca una localidad</span>)}
      {leyenda && (
        <div className="mapa__leyenda">
          {capa === 'faltan' ? (
            <>
              <span className="mapa__leyenda-titulo">Niños{nivel ? ` de ${nivel.toLowerCase()}` : ''} que siguen lejos con Matrícula+</span>
              <div className="mapa__escala">
                {P.rampa.slice(1).map((c, k) => (
                  <span key={k}><i style={{ background: css(c) }} />{k === 0 ? 'pocos' : k === P.rampa.length - 2 ? entero(maxLoc) : ''}</span>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="mapa__leyenda-titulo">Cada punto = {datos.r.ninos_por_grupo_simulado} niños</span>
              {capa === 'prioridad' ? (
                <>
                  <span className="mapa__zona"><i className="k-punto" style={{ background: css(P.lejos) }} />lejos y con prioridad</span>
                  <span className="mapa__zona"><i className="k-punto k-punto--chico" style={{ background: css(P.tenue) }} />lejos, sin prioridad</span>
                </>
              ) : (
                <span className="mapa__zona"><i className="k-punto" style={{ background: css(P.lejos) }} />
                  a más de {entero(datos.r.radio_km)} km de su colegio ({entero(capa === 'despues' ? n('lejos_despues') : n('lejos_antes'))})</span>
              )}
              {capa === 'despues' && (
                <span className="mapa__zona"><i className="k-punto k-punto--chico" style={{ background: css(P.cerca) }} />estaban lejos y ahora quedan cerca</span>
              )}
            </>
          )}
        </div>
      )}
      {interactivo && <button className="mapa__centrar" onClick={() => setCentrar((x) => x + 1)} title="Volver a centrar">⤢</button>}
      {children}
    </div>
  )
}
