/**
 * El mapa de Movilidad+: los hexágonos de 115 m dibujan la ciudad (sin mapa base → 100 % offline).
 * Los hexágonos sin siniestros no vienen en el archivo: quedan como fondo vacío.
 *
 * Una sola escala de un solo tono (violeta): claro = poco, oscuro = mucho (en el tema oscuro,
 * al revés: más = más brillante). Nunca rojo/verde. Los cortes de la escala salen de los datos.
 *
 *  · capa "k24" / "k25" — siniestros graves de ese año (calles de barrio; avenidas en gris)
 *  · capa "kappa"       — riesgo anual corregido (lo que se puede prometer)
 *  · capa "sel"         — las esquinas que alcanza el presupuesto elegido
 * Encima: las esquinas que tocó el visitante (numeradas) y, si se pide, las peores de 2024 (anillos).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator, WebMercatorViewport, type PickingInfo } from '@deck.gl/core'
import { PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { useTema, type Tema } from '../tema'
import type { Bbox, DatosMovilidad, Nivel } from './datos'

type RGB = [number, number, number]
type RGBA = [number, number, number, number]
export type Capa = 'k24' | 'k25' | 'kappa' | 'sel'

// ---------------------------------------------------------------- paleta (la de la app)
const RAMPA: Record<Tema, RGB[]> = {
  claro: [[196, 172, 250], [155, 112, 244], [122, 62, 232], [86, 38, 186], [48, 18, 112]],
  oscuro: [[62, 46, 132], [100, 64, 204], [144, 104, 246], [190, 166, 255], [236, 228, 255]],
}
const PALETA = {
  claro: { vacio: [216, 212, 229, 255] as RGBA, avenida: [231, 229, 237, 255] as RGBA, tinta: [22, 19, 43, 255] as RGBA,
    superficie: [255, 255, 255, 245] as RGBA, fuera: 70 },
  oscuro: { vacio: [42, 44, 82, 255] as RGBA, avenida: [28, 30, 60, 255] as RGBA, tinta: [236, 233, 250, 255] as RGBA,
    superficie: [30, 32, 66, 245] as RGBA, fuera: 60 },
}
const VIOLETA: RGBA = [127, 69, 238, 255]
const BIT: Record<Nivel, number> = { bajo: 1, medio: 2, alto: 4 }

/** Cortes de la escala a partir de los datos (cuantiles de los valores positivos, sin repetir). */
function cortesDe(valores: number[], enteros: boolean): number[] {
  const v = valores.filter((x) => x > 0).sort((a, b) => a - b)
  if (!v.length) return []
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
  const r = (x: number) => (enteros ? Math.round(x) : Math.round(x * 10) / 10)
  return [...new Set([0.5, 0.8, 0.95, 0.99].map((p) => r(q(p))))]
}
const claseDe = (cortes: number[], x: number) => { const i = cortes.findIndex((c) => x <= c); return i < 0 ? cortes.length : i }
const fmt1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
function etiquetas(cortes: number[], enteros: boolean): string[] {
  const f = (x: number) => fmt1.format(x)
  return [...cortes.map((c, i) => {
    const desde = i === 0 ? null : cortes[i - 1]
    if (enteros) return desde == null ? (c === 1 ? '1' : `1–${c}`) : c - desde === 1 ? String(c) : `${desde + 1}–${c}`
    return desde == null ? `≤ ${f(c)}` : `${f(desde)}–${f(c)}`
  }), enteros ? `${cortes[cortes.length - 1] + 1}+` : `> ${f(cortes[cortes.length - 1])}`]
}

// ---------------------------------------------------------------- celdas de la vista de ciudad
const RADIO_CELDA_M = 290   // celda hexagonal de ~500 m de lado a lado (≈ 4 hexágonos de 115 m por lado)
const N_DESTELLOS = 26      // destellos a la vez en la vista de ciudad
const PERIODO_DESTELLO = 3.2  // s que dura cada destello
const suave = (x: number) => x * x * (3 - 2 * x)

/** Segundos desde que se activó, a ~30 cuadros por segundo. Con "reducir movimiento" se queda quieto. */
function useReloj(activo: boolean) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!activo || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let id = 0, ult = 0
    const inicio = performance.now()
    const p = (ms: number) => { if (ms - ult > 33) { setT((ms - inicio) / 1000); ult = ms } id = requestAnimationFrame(p) }
    id = requestAnimationFrame(p)
    return () => cancelAnimationFrame(id)
  }, [activo])
  return activo ? t : 0
}
interface Celda { v: number; poligono: [number, number][] }

/** Suma el valor de las calles de barrio de cada hexágono en una malla hexagonal de celdas grandes. */
function agruparEnCeldas(s: DatosMovilidad['sitios'], valor: number[]): Celda[] {
  const lat0 = s.lat.reduce((a, b) => a + b, 0) / Math.max(1, s.n)
  const mLat = 110574, mLon = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const R = RADIO_CELDA_M, ancho = Math.sqrt(3) * R
  const suma = new Map<string, { q: number; r: number; v: number }>()
  for (let i = 0; i < s.n; i++) {
    const x = s.lon[i] * mLon, y = s.lat[i] * mLat
    // Coordenadas axiales (hexágono con punta arriba) y redondeo cúbico a la celda más cercana
    const qf = (x * Math.sqrt(3) / 3 - y / 3) / R, rf = (2 * y / 3) / R
    let q = Math.round(qf), r = Math.round(rf); const sf = -qf - rf, sc = Math.round(sf)
    const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(sc - sf)
    if (dq > dr && dq > ds) q = -r - sc; else if (dr > ds) r = -q - sc
    const k = `${q},${r}`
    const c = suma.get(k) ?? { q, r, v: 0 }
    if (s.local[i] === 1) c.v += valor[i]
    suma.set(k, c)
  }
  // Un pequeño margen entre celdas (92 %) deja ver la trama
  const forma = Array.from({ length: 6 }, (_, j) => {
    const a = (Math.PI / 180) * (60 * j - 30)
    return [(0.92 * R * Math.cos(a)) / mLon, (0.92 * R * Math.sin(a)) / mLat] as [number, number]
  })
  return [...suma.values()].map(({ q, r, v }) => {
    const cx = (ancho * (q + r / 2)) / mLon, cy = (1.5 * R * r) / mLat
    return { v, poligono: forma.map(([dx, dy]) => [cx + dx, cy + dy] as [number, number]) }
  }).sort((a, b) => a.v - b.v)
}

function useTamano<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [tam, setTam] = useState({ w: 600, h: 600 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setTam({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, tam] as const
}

interface Props {
  datos: DatosMovilidad
  capa: Capa
  /** índice de localidad para acercar y atenuar el resto */
  localidad?: number | null
  nivel?: Nivel
  tocadas?: number[]
  /** el visitante toca una esquina: se elige la de más siniestros cerca del toque */
  onTocar?: (i: number) => void
  peores?: boolean
  interactivo?: boolean
  respirar?: boolean
  margen?: { arriba?: number; abajo?: number; izquierda?: number; derecha?: number }
  /** encuadre propio (p. ej. las esquinas tocadas) */
  encuadre?: Bbox | null
  /** vista de toda la ciudad: los hexágonos de 115 m se suman en celdas de ~500 m para que se lean */
  agrupar?: boolean
  leyenda?: boolean
  children?: ReactNode
}

export default function MapaMovilidad({
  datos, capa, localidad = null, nivel = 'bajo', tocadas = [], onTocar, peores = false, interactivo = true,
  respirar = false, margen = {}, encuadre = null, leyenda = true, agrupar = false, children,
}: Props) {
  const tema = useTema()
  const P = PALETA[tema]
  const rampa = RAMPA[tema]
  const s = datos.sitios
  const [ref, { w, h }] = useTamano<HTMLDivElement>()
  const [centrar, setCentrar] = useState(0)
  const e = useMemo(() => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1, [w, h])

  // Valor de cada hexágono según la capa (solo calles de barrio; avenidas aparte)
  const valor = useMemo(() => (capa === 'k25' ? s.k25 : capa === 'kappa' ? s.kappa : s.k24), [capa, s])
  const enteros = capa !== 'kappa'
  const cortes = useMemo(() => cortesDe(valor.filter((_, i) => s.local[i] === 1), enteros), [valor, s, enteros])
  const indices = useMemo(() => s.id.map((_, i) => i), [s])

  // ---------------------------------------------------------------- cámara
  const marco: Bbox = encuadre ?? (localidad != null ? datos.bboxLocalidad[localidad] : datos.bboxCiudad)
  const viewState = useMemo(() => {
    const W = Math.max(w, 60), H = Math.max(h, 60)
    const pad = Math.round(Math.min(W, H) * 0.04)
    const lado = (a: number | undefined, total: number) => Math.min((a ?? 0) + pad, total * 0.42)
    let vp: { longitude: number; latitude: number; zoom: number }
    try {
      vp = new WebMercatorViewport({ width: W, height: H }).fitBounds(marco, {
        padding: { top: lado(margen.arriba, H), bottom: lado(margen.abajo, H), left: lado(margen.izquierda, W), right: lado(margen.derecha, W) },
      })
    } catch {
      vp = new WebMercatorViewport({ width: W, height: H }).fitBounds(marco)
    }
    return { longitude: vp.longitude, latitude: vp.latitude, zoom: Math.min(vp.zoom, 16), pitch: 0, bearing: 0,
      transitionDuration: 1000, transitionInterpolator: new FlyToInterpolator({ speed: 1.8 }) }
  }, [marco[0][0], marco[0][1], marco[1][0], marco[1][1], w, h, margen.arriba, margen.abajo, margen.izquierda, margen.derecha, centrar])  // eslint-disable-line react-hooks/exhaustive-deps

  // Respiro suave (portada)
  const [respiro, setRespiro] = useState(1)
  useEffect(() => {
    if (!respirar || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let id = 0, ult = 0
    const p = (ms: number) => { if (ms - ult > 60) { setRespiro(0.5 + 0.5 * Math.sin(ms / 700)); ult = ms } id = requestAnimationFrame(p) }
    id = requestAnimationFrame(p)
    return () => cancelAnimationFrame(id)
  }, [respirar])

  const colorDe = (i: number): RGBA => {
    const dentro = localidad == null || s.loc[i] === localidad
    let c: RGBA
    if (capa === 'sel') c = s.sel[i] & BIT[nivel] ? [...rampa[tema === 'oscuro' ? 4 : 3], 255] : s.local[i] ? P.vacio : P.avenida
    else if (!s.local[i]) c = P.avenida
    else c = valor[i] > 0 ? [...rampa[claseDe(cortes, valor[i])], 255] : P.vacio
    return dentro ? c : [c[0], c[1], c[2], P.fuera]
  }
  // Las esquinas elegidas se ven aunque el hexágono mida menos de un píxel
  // Calles de barrio con valor, de menor a mayor (las más oscuras quedan encima)
  const conValor = useMemo(() => indices.filter((i) => s.local[i] === 1 && valor[i] > 0).sort((a, b) => valor[a] - valor[b]), [indices, s, valor])
  const elegidas = useMemo(() => (capa === 'sel' ? indices.filter((i) => s.sel[i] & BIT[nivel]) : []), [capa, nivel, indices, s])

  // Vista de ciudad: suma del valor de las calles de barrio en celdas hexagonales grandes. Las celdas
  // donde solo hay avenidas o calles sin siniestros ese año quedan como fondo y dibujan la ciudad.
  const celdas = useMemo(() => (agrupar ? agruparEnCeldas(s, valor) : null), [agrupar, s, valor])
  const cortesCeldas = useMemo(() => (celdas ? cortesDe(celdas.map((c) => c.v), true) : []), [celdas])

  // Destellos (vista de ciudad que respira): cada uno cae en una calle de barrio con siniestros en ese
  // año, con más frecuencia donde hubo más; un anillo se abre y se apaga. Cada vuelta, otros sitios.
  const reloj = useReloj(!!celdas && respirar)
  const bolsa = useMemo(() => {
    if (!celdas || !respirar) return []
    const b: number[] = []
    for (let i = 0; i < s.n; i++) if (s.local[i] === 1 && valor[i] > 0) for (let k = 0; k < valor[i]; k++) b.push(i)
    return b
  }, [celdas, respirar, s, valor])
  const destellos = useMemo(() => {
    if (!bolsa.length) return []
    const out: { i: number; u: number }[] = []
    for (let n = 0; n < N_DESTELLOS; n++) {
      const tt = reloj + ((n * 0.6180339887) % 1) * PERIODO_DESTELLO
      const vuelta = Math.floor(tt / PERIODO_DESTELLO)
      out.push({ i: bolsa[(n * 7919 + vuelta * 104729) % bolsa.length], u: (tt % PERIODO_DESTELLO) / PERIODO_DESTELLO })
    }
    return out
  }, [bolsa, reloj])
  const tonoDestello: RGB = tema === 'oscuro' ? [236, 228, 255] : rampa[4]

  const capas: any[] = celdas ? [
    new PolygonLayer<Celda>({
      id: 'celdas', data: celdas, filled: true, stroked: false,
      getPolygon: (c) => c.poligono,
      getFillColor: (c) => (c.v > 0 ? [...rampa[claseDe(cortesCeldas, c.v)], 255] : P.vacio),
      opacity: respirar ? 0.75 + 0.25 * respiro : 1,
      updateTriggers: { getFillColor: [tema, cortesCeldas] },
      transitions: { getFillColor: 500 },
    }),
    destellos.length > 0 && new ScatterplotLayer<{ i: number; u: number }>({
      id: 'destellos-anillo', data: destellos, getPosition: (d) => [s.lon[d.i], s.lat[d.i]], radiusUnits: 'pixels',
      getRadius: (d) => e * (3 + 16 * suave(d.u)), filled: false, stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.6 * e,
      getLineColor: (d) => [...tonoDestello, Math.round(230 * (1 - d.u))] as RGBA,
    }),
    destellos.length > 0 && new ScatterplotLayer<{ i: number; u: number }>({
      id: 'destellos-punto', data: destellos, getPosition: (d) => [s.lon[d.i], s.lat[d.i]], radiusUnits: 'pixels',
      getRadius: (d) => e * 2.6 * (1 - 0.5 * d.u), getFillColor: (d) => [...tonoDestello, Math.round(255 * Math.max(0, 1 - 1.6 * d.u))] as RGBA,
    }),
  ] : [
    new PolygonLayer<number>({
      id: 'hexagonos', data: indices, filled: true, stroked: false,
      getPolygon: (i) => s.forma.map(([dx, dy]) => [s.lon[i] + dx, s.lat[i] + dy]),
      getFillColor: colorDe,
      opacity: respirar ? 0.7 + 0.3 * respiro : 1,
      updateTriggers: { getFillColor: [capa, nivel, localidad, tema, cortes] },
      transitions: { getFillColor: 500 },
    }),
    // Con la ciudad entera un hexágono mide 1–3 px: un punto mínimo mantiene visibles los que tienen siniestros
    capa !== 'sel' && new ScatterplotLayer<number>({
      id: 'con-siniestros', data: conValor, getPosition: (i) => [s.lon[i], s.lat[i]],
      getRadius: 45, radiusUnits: 'meters', radiusMinPixels: 1.2 * e,
      getFillColor: colorDe, opacity: respirar ? 0.7 + 0.3 * respiro : 1,
      updateTriggers: { getFillColor: [capa, nivel, localidad, tema, cortes], getRadius: [e] },
    }),
    elegidas.length > 0 && new ScatterplotLayer<number>({
      id: 'elegidas', data: elegidas, getPosition: (i) => [s.lon[i], s.lat[i]],
      getRadius: 50, radiusUnits: 'meters', radiusMinPixels: 1.6 * e,
      getFillColor: [...rampa[tema === 'oscuro' ? 4 : 3], 255] as RGBA, updateTriggers: { getFillColor: [tema] },
    }),
    peores && new ScatterplotLayer<number>({
      id: 'peores', data: datos.peores, getPosition: (i) => [s.lon[i], s.lat[i]],
      getRadius: 7 * e, radiusUnits: 'pixels', filled: false, stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.8 * e,
      getLineColor: P.tinta, updateTriggers: { getRadius: [e], getLineWidth: [e], getLineColor: [tema] },
    }),
    tocadas.length > 0 && new ScatterplotLayer<number>({
      id: 'tocadas', data: tocadas, getPosition: (i) => [s.lon[i], s.lat[i]],
      getRadius: 11 * e, radiusUnits: 'pixels', stroked: true, lineWidthUnits: 'pixels', getLineWidth: 3 * e,
      getFillColor: [VIOLETA[0], VIOLETA[1], VIOLETA[2], 60], getLineColor: VIOLETA,
      updateTriggers: { getRadius: [e], getLineWidth: [e] },
    }),
    tocadas.length > 0 && new TextLayer<number>({
      id: 'tocadas-n', data: tocadas, getPosition: (i) => [s.lon[i], s.lat[i]], getText: (i) => String(tocadas.indexOf(i) + 1),
      getSize: 13 * e, getPixelOffset: [0, -22 * e], getColor: VIOLETA, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600,
      background: true, getBackgroundColor: P.superficie, backgroundPadding: [5, 2],
      updateTriggers: { getText: [tocadas], getSize: [e], getPixelOffset: [e], getBackgroundColor: [tema] },
    }),
  ].filter(Boolean)

  // Toque: entre las calles de barrio con siniestros en 2024 cerca del dedo, la de más siniestros
  const alTocar = (info: PickingInfo) => {
    if (!onTocar || !info.coordinate || !info.viewport) return
    const vp = info.viewport
    const [px, py] = vp.project(info.coordinate as [number, number])
    let mejor = -1, mejorK = -1, mejorD = Infinity
    for (const radio of [16 * e, 40 * e]) {
      for (let i = 0; i < s.n; i++) {
        if (!s.local[i] || s.k24[i] <= 0 || (localidad != null && s.loc[i] !== localidad)) continue
        const [x, y] = vp.project([s.lon[i], s.lat[i]])
        const d = Math.hypot(x - px, y - py)
        if (d > radio) continue
        if (s.k24[i] > mejorK || (s.k24[i] === mejorK && d < mejorD)) { mejor = i; mejorK = s.k24[i]; mejorD = d }
      }
      if (mejor >= 0) break
    }
    if (mejor >= 0) onTocar(mejor)
  }

  const titulo = capa === 'sel' ? 'Esquinas que alcanza el presupuesto'
    : capa === 'kappa' ? 'Riesgo anual corregido · calles de barrio'
      : `Siniestros graves ${capa === 'k25' ? datos.resumen.anio_validacion : datos.experiencia.pantalla_1_usted_decide.anio_mostrado} · calles de barrio`
  const nombres = etiquetas(cortes, enteros)
  const css = (c: RGB | RGBA) => `rgb(${c[0]},${c[1]},${c[2]})`
  return (
    <div ref={ref} className="mapa mapa--movilidad">
      <DeckGL initialViewState={viewState} layers={capas.filter(Boolean)} onClick={alTocar}
              controller={interactivo ? { dragRotate: false, touchRotate: false, doubleClickZoom: false, scrollZoom: { speed: 0.02, smooth: true } } : false}
              getCursor={({ isDragging }) => (isDragging ? 'grabbing' : onTocar ? 'crosshair' : interactivo ? 'grab' : 'default')} />
      {leyenda && (
        <div className="mapa__leyenda">
          <span className="mapa__leyenda-titulo">{titulo}</span>
          {capa === 'sel' ? (
            <span className="mapa__zona"><i className="k-cuadro" style={{ background: css(rampa[tema === 'oscuro' ? 4 : 3]) }} />esquina elegida</span>
          ) : (
            <div className="mapa__escala">{nombres.map((n, i) => <span key={n}><i style={{ background: css(rampa[i] ?? rampa[rampa.length - 1]) }} />{n}</span>)}</div>
          )}
          <span className="mapa__zona mapa__zona--avenidas"><i className="k-cuadro" style={{ background: css(P.avenida), outline: `1px solid ${css(P.vacio)}` }} />avenidas{capa === 'sel' ? '' : ' (no se colorean)'}</span>
          {peores && <span className="mapa__zona"><i className="k-anillo-vacio" />las {datos.peores.length} peores esquinas de barrio de {datos.experiencia.pantalla_1_usted_decide.anio_mostrado}</span>}
        </div>
      )}
      <span className="mapa__atribucion">© colaboradores de OpenStreetMap</span>
      {interactivo && <button className="mapa__centrar" onClick={() => setCentrar((x) => x + 1)} title="Volver a centrar">⤢</button>}
      {children}
    </div>
  )
}

