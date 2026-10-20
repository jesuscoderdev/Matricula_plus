/**
 * El mapa de Matrícula+: un solo mapa vectorial (deck.gl, sin teselas → 100% offline) que cambia
 * de escena según el capítulo.
 *
 *  · "ciudad"  — coropleta de niños fuera de sus opciones por UPZ (hoy o con la política), zona crítica.
 *  · "proceso" — la asignación animada en una localidad:
 *       llegada  → así se asigna hoy: las familias llegan una por una y toman el primer cupo libre;
 *       diferida → asignación diferida por rondas;
 *       y al final de ambas, la reubicación de quienes no cupieron en sus opciones.
 *     Con pausa, avance por ronda y velocidad. Al tocar una familia o un colegio se ve su ficha.
 *  · "caso"    — una familia de ejemplo, sus colegios y lo que le pasa.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator, WebMercatorViewport, type PickingInfo } from '@deck.gl/core'
import { GeoJsonLayer, LineLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { decimal, entero, type Bbox, type Datos, type Feature, type PropsUpz } from '../datos'
import type { ColegioNuevo, Supuestos } from '../motor'
import { familiasDe, nombreColegio, type Resultados } from '../estado'

export type Escena = 'ciudad' | 'proceso' | 'caso'
export type FaseProceso = 'neutro' | 'llegada' | 'diferida'
type RGB = [number, number, number]
type RGBA = [number, number, number, number]

// ---------------------------------------------------------------- paleta del mapa
export const COLOR = {
  primera: [91, 43, 196, 255] as RGBA,       // violeta oscuro: en su 1.ª opción
  otra: [168, 140, 240, 255] as RGBA,        // violeta claro: en otra de sus opciones
  reubicado: [38, 132, 132, 255] as RGBA,    // verde azulado: reubicado fuera de sus opciones
  sin: [224, 102, 42, 255] as RGBA,          // naranja: sin ningún cupo cercano
  espera: [160, 162, 176, 210] as RGBA,
  pidiendo: [134, 116, 214, 255] as RGBA,
  rechazo: [240, 140, 80, 255] as RGBA,
  tinta: [22, 19, 43, 255] as RGBA,
  violeta: [127, 69, 238, 255] as RGBA,
}
export const ESCALA: { hasta: number; color: RGB; etiqueta: string }[] = [
  { hasta: 10, color: [244, 240, 254], etiqueta: '< 10%' },
  { hasta: 20, color: [214, 196, 250], etiqueta: '10–20%' },
  { hasta: 30, color: [171, 134, 243], etiqueta: '20–30%' },
  { hasta: 40, color: [127, 69, 238], etiqueta: '30–40%' },
  { hasta: 101, color: [74, 32, 158], etiqueta: '≥ 40%' },
]
const colorEscala = (pct: number) => (ESCALA.find((e) => pct < e.hasta) ?? ESCALA[ESCALA.length - 1]).color
const alfa = (c: RGBA | RGB, a: number): RGBA => [c[0], c[1], c[2], a]

// ---------------------------------------------------------------- utilidades
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
const suave = (x: number) => x * x * (3 - 2 * x)
const cotaInferior = (a: Int32Array, x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m } return lo }
function centroide(g: any): [number, number] {
  const anillo = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates.reduce((a: any, p: any) => (p[0].length > a.length ? p[0] : a), [])
  let sx = 0, sy = 0
  for (const [x, y] of anillo) { sx += x; sy += y }
  return [sx / anillo.length, sy / anillo.length]
}
function tiemposRondas(R: number, rapido: boolean) {
  const base = rapido ? [1.2, 1.0, 0.7] : [3.0, 2.4, 1.5, 1.0, 0.75]
  const min = rapido ? 0.28 : 0.42
  const inicio: number[] = []
  let t = 0
  for (let r = 1; r <= R; r++) { inicio[r] = t; t += base[r - 1] ?? Math.max(min, base[base.length - 1] * 0.85 ** (r - base.length)) }
  return { inicio, total: t }
}
const REUBICACION_S = 2.6

// ---------------------------------------------------------------- props
interface Props {
  datos: Datos
  r: Resultados
  supuestos: Supuestos
  escena: Escena
  localidad: string | null
  /** ciudad: qué simulación colorea las UPZ */
  coloreo?: 'hoy' | 'pol'
  respirar?: boolean
  upzSeleccionada?: string | null
  /** proceso */
  fase?: FaseProceso
  reproduccion?: number
  rapido?: boolean
  alTerminar?: () => void
  textoNeutro?: string
  /** colegio nuevo y ubicaciones candidatas */
  colegioNuevo?: ColegioNuevo | null
  mostrarCandidatos?: boolean
  onTocarCandidato?: (clave: string) => void
  /** caso */
  caso?: { lon: number; lat: number; colegios: number[]; hermanoEn: number | null } | null
  onTocarColegio?: (sede: number) => void
  /** interacción */
  onTocarUpz?: (codigo: string) => void
  onTocarMapa?: (lon: number, lat: number) => void
  interactivo?: boolean
  /** espacio arriba/abajo que tapan los paneles flotantes (px) */
  margen?: { arriba?: number; abajo?: number; izquierda?: number; derecha?: number }
  children?: ReactNode
}

type Seleccion = { tipo: 'familia'; i: number } | { tipo: 'colegio'; s: number } | null

export default function MapaEscena(props: Props) {
  const {
    datos, r, supuestos, escena, localidad, coloreo = 'hoy', respirar = false, upzSeleccionada = null,
    fase = 'neutro', reproduccion = 0, rapido = false, alTerminar, textoNeutro,
    colegioNuevo = null, mostrarCandidatos = false, onTocarCandidato, caso = null, onTocarColegio,
    onTocarUpz, onTocarMapa, interactivo = true, margen = {}, children,
  } = props
  const [ref, { w, h }] = useTamano<HTMLDivElement>()
  const f = datos.familias
  const S = f.n_sedes
  const [centrar, setCentrar] = useState(0)
  const [sel, setSel] = useState<Seleccion>(null)
  // Escala de puntos y textos con el tamaño raíz (celular 16 px, tótem ~36 px)
  const e = useMemo(() => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1, [w, h])

  const fams = useMemo(() => (localidad && escena !== 'ciudad' ? familiasDe(datos, localidad) : []), [datos, localidad, escena])
  const sim = fase === 'llegada' ? r.hoy : r.pol
  const k = sim.pref.k
  const prefs = sim.pref.prefs
  const pos = sim.pos
  const coord = (s: number): [number, number] => pos[s] ?? pos[0]

  // ---------------------------------------------------------------- cámara
  const encuadre = useMemo<Bbox>(() => {
    if (escena === 'caso' && caso) {
      const m = 0.025
      return [[caso.lon - m, caso.lat - m * 0.8], [caso.lon + m, caso.lat + m * 0.8]]
    }
    if (!localidad) return datos.bboxCiudad
    if (fams.length) {
      const xs = fams.map((i) => f.lon[i]).sort((a, b) => a - b)
      const ys = fams.map((i) => f.lat[i]).sort((a, b) => a - b)
      const q = (a: number[], p: number) => a[Math.round(p * (a.length - 1))]
      return [[q(xs, 0.02), q(ys, 0.02)], [q(xs, 0.98), q(ys, 0.98)]]
    }
    return datos.bboxLocalidad[localidad]
  }, [escena, caso?.lon, caso?.lat, localidad, fams, f, datos])
  const viewState = useMemo(() => {
    const W = Math.max(w, 60), H = Math.max(h, 60)
    const pad = Math.round(Math.min(W, H) * 0.05)
    // El relleno nunca puede dejar sin espacio al mapa (fitBounds falla si no cabe)
    const lado = (a: number | undefined, total: number) => Math.min((a ?? 0) + pad, total * 0.42)
    let vp: { longitude: number; latitude: number; zoom: number }
    try {
      vp = new WebMercatorViewport({ width: W, height: H }).fitBounds(encuadre, {
        padding: { top: lado(margen.arriba, H), bottom: lado(margen.abajo, H), left: lado(margen.izquierda, W), right: lado(margen.derecha, W) },
      })
    } catch {
      vp = new WebMercatorViewport({ width: W, height: H }).fitBounds(encuadre)
    }
    return { longitude: vp.longitude, latitude: vp.latitude, zoom: vp.zoom, pitch: 0, bearing: 0,
      transitionDuration: 1100, transitionInterpolator: new FlyToInterpolator({ speed: 1.7 }) }
  }, [encuadre, w, h, margen.arriba, margen.abajo, margen.izquierda, margen.derecha, centrar])

  // ---------------------------------------------------------------- reloj del proceso (con pausa y velocidad)
  const rondas = useMemo(() => {
    const t = r.pol.traza!
    const R = t.rondas
    const nS = r.pol.cap.length
    const dif = new Int32Array(nS * (R + 2)), props_ = new Int32Array(nS * (R + 2))
    const kk = r.pol.pref.k, pp = r.pol.pref.prefs
    for (let ix = 0; ix < f.n * kk; ix++) {
      const pr = t.rondaPropuesta[ix]
      if (!pr) continue
      const s = pp[ix], q = t.rondaRechazo[ix]
      props_[s * (R + 2) + pr]++; dif[s * (R + 2) + pr]++; dif[s * (R + 2) + (q || R + 1)]--
    }
    const ocup = new Int32Array(nS * (R + 2))
    for (let s = 0; s < nS; s++) { let a = 0; for (let x = 0; x <= R + 1; x++) { a += dif[s * (R + 2) + x]; ocup[s * (R + 2) + x] = a } }
    return { R, ocup, props: props_, ...tiemposRondas(R, rapido) }
  }, [r.pol, f.n, rapido])
  const turnos = useMemo(() => {
    const l: number[][] = Array.from({ length: r.hoy.cap.length }, () => [])
    const { asign, turno } = r.hoy.llegada!
    for (let i = 0; i < f.n; i++) if (asign[i] >= 0) l[asign[i]].push(turno[i])
    return l.map((x) => Int32Array.from(x.sort((a, b) => a - b)))
  }, [r.hoy, f.n])

  const T1 = escena !== 'proceso' ? 0 : fase === 'llegada' ? (rapido ? 5 : 9) : fase === 'diferida' ? rondas.total : 0
  const duracion = T1 > 0 ? T1 + REUBICACION_S : 0
  const [tCrudo, setT] = useState(0)
  const [pausado, setPausado] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  const llave = `${escena}-${fase}-${reproduccion}-${localidad}`
  // El reloj pertenece a una reproducción: al cambiar la llave vale 0 desde el primer cuadro
  // (si no, el cuadro viejo "terminado" avisaría alTerminar de la reproducción nueva).
  const [llaveT, setLlaveT] = useState(llave)
  const t = llaveT === llave ? tCrudo : 0
  useEffect(() => { setT(0); setLlaveT(llave); setPausado(false); setSel(null) }, [llave])
  useEffect(() => {
    if (!duracion || pausado || t >= duracion) return
    let id = 0, ultimo = performance.now()
    const paso = (ahora: number) => {
      const dt = (ahora - ultimo) / 1000
      ultimo = ahora
      setT((x) => Math.min(duracion, x + dt * velocidad))
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [duracion, pausado, velocidad, llave, t >= duracion])  // eslint-disable-line react-hooks/exhaustive-deps
  const terminado = !duracion || t >= duracion
  const avisado = useRef('')
  useEffect(() => {
    if (duracion && terminado && avisado.current !== llave) { avisado.current = llave; alTerminar?.() }
  }, [terminado, llave, duracion, alTerminar])
  const siguienteRonda = () => {
    if (fase !== 'diferida') return setT((x) => Math.min(duracion, x + 1))
    const sig = rondas.inicio.find((x) => x !== undefined && x > t + 0.01)
    setT(sig ?? Math.min(duracion, rondas.total + 0.01))
    setPausado(true)
  }

  // ---------------------------------------------------------------- colegios visibles
  const colegios = useMemo(() => {
    if (escena === 'ciudad') return []
    if (escena === 'caso' && caso) {
      const cerca: [number, number][] = []
      pos.forEach((p, s) => { const d = Math.hypot((p[0] - caso.lon) * 110.9, (p[1] - caso.lat) * 110.6); if (d < 3) cerca.push([d, s]) })
      return cerca.sort((a, b) => a[0] - b[0]).slice(0, 30).map((x) => x[1])
    }
    const set = new Set<number>()
    for (const i of fams) {
      for (let o = 0; o < k; o++) if (prefs[i * k + o] >= 0) set.add(prefs[i * k + o])
      const re = sim.fase2.asign[i]; if (re >= 0) set.add(re)
    }
    return [...set]
  }, [escena, caso, pos, fams, prefs, k, sim])
  const capMax = useMemo(() => Math.max(1, ...colegios.map((s) => sim.cap[s] ?? 1)), [colegios, sim])

  // ---------------------------------------------------------------- cuadro actual del proceso
  const cuadro = useMemo(() => {
    const colorFam: RGBA[] = new Array(fams.length)
    const radioFam = new Float32Array(fams.length)
    const lineas: { de: [number, number]; a: [number, number]; color: RGBA; ancho?: number }[] = []
    const ocupado = new Map<number, number>()
    const c = { conColegio: 0, buscando: 0, reubicados: 0, sinCupo: 0, llegaron: 0 }
    let paso = '', texto = ''
    if (escena !== 'proceso') return { colorFam, radioFam, lineas, ocupado, c, paso, texto }
    const enReub = !terminado && T1 > 0 && t >= T1
    const fr2 = enReub ? Math.min(1, (t - T1) / REUBICACION_S) : terminado ? 1 : 0
    const final = (j: number, i: number) => {
      if (sim.fase1[i] >= 0) { c.conColegio++; colorFam[j] = sim.opcion[i] === 0 ? COLOR.primera : COLOR.otra; radioFam[j] = 2.6; return }
      const re = sim.fase2.asign[i]
      if (re >= 0 && fr2 > 0) {
        c.reubicados++; colorFam[j] = COLOR.reubicado; radioFam[j] = 3
        if (!terminado) lineas.push({ de: [f.lon[i], f.lat[i]], a: coord(re), color: alfa(COLOR.reubicado, Math.round(60 + 170 * fr2)), ancho: 1.6 })
      } else { c.sinCupo++; colorFam[j] = COLOR.sin; radioFam[j] = 3.6 }
    }
    const ocupFinal = (s: number) => {
      let n = 0
      for (const i of fams) if (sim.fase1[i] === s || (fr2 > 0 && sim.fase2.asign[i] === s)) n++
      return n
    }
    if (fase === 'neutro') {
      fams.forEach((_, j) => { colorFam[j] = COLOR.espera; radioFam[j] = 2.2 })
      colegios.forEach((s) => ocupado.set(s, 0))
      texto = textoNeutro ?? 'Elige la política y toca ▶ Asignar.'
      return { colorFam, radioFam, lineas, ocupado, c, paso, texto }
    }
    if (fase === 'llegada') {
      const p = t >= T1 ? 1 : suave(Math.min(1, t / T1))
      const T = p * f.n
      const ventana = f.n * 0.035
      const { turno } = r.hoy.llegada!
      fams.forEach((i, j) => {
        if (turno[i] >= T) { colorFam[j] = COLOR.espera; radioFam[j] = 2.2; return }
        c.llegaron++
        if (t >= T1) return final(j, i)
        if (sim.fase1[i] >= 0) { c.conColegio++; colorFam[j] = sim.opcion[i] === 0 ? COLOR.primera : COLOR.otra; radioFam[j] = 2.6 }
        else { c.buscando++; colorFam[j] = COLOR.rechazo; radioFam[j] = 3.4 }
        if (turno[i] > T - ventana) {
          const destino = sim.fase1[i] >= 0 ? sim.fase1[i] : prefs[i * k]
          lineas.push({ de: [f.lon[i], f.lat[i]], a: coord(destino), color: sim.fase1[i] >= 0 ? COLOR.primera : COLOR.rechazo })
        }
      })
      colegios.forEach((s) => ocupado.set(s, t >= T1 ? cotaInferior(turnos[s], f.n) + (fr2 > 0 ? 0 : 0) : cotaInferior(turnos[s], T)))
      if (fr2 > 0) colegios.forEach((s) => { const extra = fams.filter((i) => sim.fase2.asign[i] === s).length; ocupado.set(s, (ocupado.get(s) ?? 0) + extra) })
      paso = t < T1 ? 'Así se asigna hoy' : terminado ? 'Resultado de hoy' : 'Reubicación'
      texto = t < T1
        ? (p < 0.3 ? 'Las familias piden cupo en orden de llegada: quien llega primero, elige primero.'
          : p < 0.7 ? 'Cada familia toma el primer colegio de su lista que todavía tenga cupo.'
            : 'Los colegios se llenan. Quien llega tarde encuentra sus opciones sin cupo.')
        : !terminado ? `La SED reubica a quienes no cupieron en el colegio con cupo más cercano, hasta ${decimal(supuestos.radioReubicacionKm)} km.`
          : `En ${localidad}: ${entero(c.reubicados * f.estudiantes_por_familia)} niños reubicados lejos de sus opciones y ${entero(c.sinCupo * f.estudiantes_por_familia)} sin ningún cupo cercano.`
      return { colorFam, radioFam, lineas, ocupado, c, paso, texto }
    }
    // diferida
    const { R, ocup, props: pr_, inicio } = rondas
    const tr = r.pol.traza!
    let ronda = R, fr = 1
    if (t < T1) {
      ronda = 1
      while (ronda < R && t >= inicio[ronda + 1]) ronda++
      const fin = ronda < R ? inicio[ronda + 1] : T1
      fr = Math.min(1, (t - inicio[ronda]) / Math.max(0.01, fin - inicio[ronda]))
    }
    const faseA = t < T1 && fr < 0.5
    fams.forEach((i, j) => {
      if (t >= T1) return final(j, i)
      let o = -1
      for (let x = 0; x < k; x++) { const p_ = tr.rondaPropuesta[i * k + x]; if (p_ && p_ <= ronda) o = x }
      if (o < 0) { colorFam[j] = COLOR.espera; radioFam[j] = 2.2; c.buscando++; return }
      const pr = tr.rondaPropuesta[i * k + o], q = tr.rondaRechazo[i * k + o]
      const rech = q !== 0 && (q < ronda || (q === ronda && !faseA))
      const de: [number, number] = [f.lon[i], f.lat[i]], a = coord(prefs[i * k + o])
      if (pr === ronda && faseA) {
        colorFam[j] = COLOR.pidiendo; radioFam[j] = 2.6; c.buscando++
        lineas.push({ de, a, color: alfa(COLOR.pidiendo, Math.round(40 + 160 * (fr / 0.5))) })
      } else if (rech) {
        const ultima = o === k - 1 || prefs[i * k + o + 1] < 0
        c.buscando++; colorFam[j] = ultima ? COLOR.sin : COLOR.rechazo; radioFam[j] = 3.2
        if (q === ronda) lineas.push({ de, a, color: alfa(COLOR.rechazo, Math.round(230 * (1 - (fr - 0.5) * 2) + 25)) })
      } else {
        c.conColegio++; colorFam[j] = o === 0 ? COLOR.primera : COLOR.otra; radioFam[j] = 2.6
        if (pr === ronda) lineas.push({ de, a, color: alfa(COLOR.primera, Math.round(170 * (1 - (fr - 0.5) * 2) + 20)) })
      }
    })
    const nS = R + 2
    colegios.forEach((s) => {
      if (t >= T1) { ocupado.set(s, ocup[s * nS + R] + (fr2 > 0 ? fams.filter((i) => sim.fase2.asign[i] === s).length : 0)); return }
      const antes = ocup[s * nS + (ronda - 1)]
      ocupado.set(s, faseA ? antes + Math.round(pr_[s * nS + ronda] * suave(fr / 0.5)) : ocup[s * nS + ronda])
    })
    void ocupFinal
    paso = t < T1 ? `Ronda ${ronda} de ${R}` : terminado ? `Listo · ${R} rondas + reubicación` : 'Reubicación'
    texto = t < T1
      ? (ronda === 1 && faseA ? 'Todas las familias piden, al mismo tiempo, su colegio favorito.'
        : ronda === 1 ? 'Donde hay más solicitudes que cupos, el colegio se queda con las de más prioridad; las demás pasan a su siguiente opción.'
          : ronda === 2 ? 'Las rechazadas piden su siguiente opción. Si llega alguien con más prioridad, el colegio puede cambiar a quien tenía.'
            : 'Las que siguen sin colegio piden su siguiente opción…')
      : !terminado ? `Los cupos que quedaron libres se reparten con la misma regla de prioridad, hasta ${decimal(supuestos.radioReubicacionKm)} km.`
        : '✓ Asignación estable: nadie puede mejorar su colegio sin quitarle el cupo a alguien con más prioridad.'
    return { colorFam, radioFam, lineas, ocupado, c, paso, texto }
  }, [escena, fase, t, T1, terminado, fams, colegios, sim, r, rondas, turnos, prefs, k, f, localidad, supuestos, textoNeutro])  // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- capas
  const etiquetas = useMemo(() => (localidad && escena !== 'ciudad'
    ? datos.upz.features.filter((x) => x.properties.localidad === localidad).map((x) => ({ n: x.properties.nombre, p: centroide(x.geometry) }))
    : []), [datos, localidad, escena])
  const zona = useMemo(() => ({ type: 'FeatureCollection', features: datos.upz.features.filter((x) => x.properties.zona_critica) }), [datos])
  const colorUpz = coloreo === 'hoy' ? r.upzHoy : r.upzPol
  const marca = `${escena}-${fase}-${t.toFixed(2)}-${terminado}-${localidad}`
  const respiro = useRespiro(respirar)
  const radioCol = (s: number) => e * (w < 500 ? 0.7 : 1) * (4 + 11 * Math.sqrt(Math.max(1, sim.cap[s] ?? 1) / capMax))
  const ocup = (s: number) => cuadro.ocupado.get(s) ?? 0

  const capas: any[] = [
    new GeoJsonLayer<PropsUpz>({
      id: 'upz', data: datos.upz as any, filled: true, stroked: true,
      pickable: !!onTocarUpz,
      opacity: respirar ? 0.75 + 0.25 * respiro : 1,
      getFillColor: (x: Feature<PropsUpz>) => {
        if (escena === 'ciudad') return alfa(colorEscala(colorUpz[datos.posUpz[x.properties.codigo]] ?? 0), 255)
        return x.properties.localidad === localidad ? [255, 255, 255, 255] : [234, 232, 240, 255]
      },
      getLineColor: (x: Feature<PropsUpz>) => (x.properties.codigo === upzSeleccionada ? alfa(COLOR.tinta, 255)
        : escena === 'ciudad' ? [255, 255, 255, 220] : x.properties.localidad === localidad ? [22, 19, 43, 70] : [255, 255, 255, 255]),
      getLineWidth: (x: Feature<PropsUpz>) => (x.properties.codigo === upzSeleccionada ? 3.5 : 1),
      lineWidthUnits: 'pixels',
      updateTriggers: { getFillColor: [escena, colorUpz, localidad], getLineColor: [upzSeleccionada, escena, localidad], getLineWidth: [upzSeleccionada] },
      transitions: { getFillColor: 450 },
    }),
    escena === 'ciudad' && new GeoJsonLayer({
      id: 'zona', data: zona as any, filled: false, stroked: true,
      getLineColor: alfa(COLOR.tinta, 255), getLineWidth: 2.5 * e, lineWidthUnits: 'pixels',
      getDashArray: [4, 3], updateTriggers: { getLineWidth: [e] },
    }),
    etiquetas.length && new TextLayer({
      id: 'upz-nombres', data: etiquetas, getPosition: (x: any) => x.p, getText: (x: any) => x.n,
      getSize: 10.5 * e, getColor: [90, 88, 112, 220], fontFamily: 'Inter Tight Variable, sans-serif', fontWeight: 600, characterSet: 'auto',
    }),
    escena === 'ciudad' && new ScatterplotLayer({
      id: 'sedes', data: datos.posSedes, getPosition: (p: any) => p, getRadius: 1.4 * e, radiusUnits: 'pixels',
      getFillColor: alfa(COLOR.tinta, 130), updateTriggers: { getRadius: [e] },
    }),
    cuadro.lineas.length && new LineLayer({
      id: 'solicitudes', data: cuadro.lineas, getSourcePosition: (l: any) => l.de, getTargetPosition: (l: any) => l.a,
      getColor: (l: any) => l.color, getWidth: (l: any) => (l.ancho ?? 1.3) * e, widthUnits: 'pixels', updateTriggers: { getColor: [marca], getWidth: [e] },
    }),
    escena === 'proceso' && new ScatterplotLayer<number>({
      id: 'familias', data: fams.map((_, j) => j), pickable: true,
      getPosition: (j) => [f.lon[fams[j]], f.lat[fams[j]]],
      getFillColor: (j) => cuadro.colorFam[j], getRadius: (j) => cuadro.radioFam[j] * e, radiusUnits: 'pixels',
      stroked: true, getLineColor: (j) => (sel?.tipo === 'familia' && sel.i === fams[j] ? [22, 19, 43, 255] : [255, 255, 255, 200]),
      getLineWidth: (j) => (sel?.tipo === 'familia' && sel.i === fams[j] ? 2.5 : 0.6) * e, lineWidthUnits: 'pixels',
      updateTriggers: { getFillColor: [marca], getRadius: [marca, e], getLineColor: [sel], getLineWidth: [sel, e] },
    }),
    colegios.length && new ScatterplotLayer<number>({
      id: 'colegios', data: colegios, pickable: true,
      getPosition: coord, getRadius: radioCol, radiusUnits: 'pixels',
      getFillColor: (s) => (s >= S ? [241, 235, 254, 255] : [255, 255, 255, 240]),
      stroked: true, lineWidthUnits: 'pixels',
      getLineWidth: (s) => e * (ocup(s) > (sim.cap[s] ?? 0) ? 3.2 : (caso && caso.colegios.includes(s)) || (sel?.tipo === 'colegio' && sel.s === s) ? 3 : 1.6),
      getLineColor: (s) => (ocup(s) > (sim.cap[s] ?? 0) ? COLOR.rechazo : (caso && caso.colegios.includes(s)) ? COLOR.violeta : s >= S ? COLOR.violeta : COLOR.tinta),
      updateTriggers: { getLineWidth: [marca, caso, sel, e], getLineColor: [marca, caso], getRadius: [capMax, e] },
    }),
    escena === 'proceso' && colegios.length && new ScatterplotLayer<number>({
      id: 'ocupacion', data: colegios,
      getPosition: coord, getRadius: (s) => radioCol(s) * Math.sqrt(Math.min(1, ocup(s) / Math.max(1, sim.cap[s] ?? 1))), radiusUnits: 'pixels',
      getFillColor: (s) => (s >= S ? alfa(COLOR.violeta, 230) : [22, 19, 43, 205]),
      updateTriggers: { getRadius: [marca, capMax, e] },
    }),
    caso && escena === 'caso' && new TextLayer({
      id: 'caso-numeros', data: caso.colegios.map((s, o) => ({ s, o })),
      getPosition: (x: any) => coord(x.s), getText: (x: any) => String(x.o + 1), getSize: 13 * e,
      getColor: alfa(COLOR.violeta, 255), getPixelOffset: [0, -20 * e], fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600,
      background: true, getBackgroundColor: [255, 255, 255, 240], backgroundPadding: [4, 2], updateTriggers: { getSize: [e], getPixelOffset: [e] },
    }),
    caso && escena === 'caso' && new LineLayer({
      id: 'caso-lineas', data: caso.colegios, getSourcePosition: () => [caso.lon, caso.lat], getTargetPosition: (s: number) => coord(s),
      getColor: alfa(COLOR.violeta, 160), getWidth: 2 * e, widthUnits: 'pixels', updateTriggers: { getWidth: [e] },
    }),
    caso && new ScatterplotLayer({
      id: 'caso-casa', data: [caso], getPosition: (x: any) => [x.lon, x.lat], getRadius: 8 * e, radiusUnits: 'pixels',
      getFillColor: alfa(COLOR.sin, 255), stroked: true, getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 3,
      updateTriggers: { getRadius: [e] },
    }),
    (mostrarCandidatos || colegioNuevo) && new ScatterplotLayer<any>({
      id: 'candidatos', pickable: !!onTocarCandidato,
      data: [...(mostrarCandidatos ? datos.indice.colegio_nuevo : []), ...(colegioNuevo && !colegioNuevo.clave ? [{ ...colegioNuevo, clave: '' }] : [])],
      getPosition: (c: any) => [c.lon, c.lat], radiusUnits: 'pixels',
      getRadius: (c: any) => e * (colegioNuevo && ((c.clave && c.clave === colegioNuevo.clave) || (!c.clave && !colegioNuevo.clave)) ? 11 : 7),
      getFillColor: (c: any) => (colegioNuevo && ((c.clave && c.clave === colegioNuevo.clave) || (!c.clave && !colegioNuevo.clave)) ? COLOR.violeta : [255, 255, 255, 255]),
      stroked: true, getLineColor: alfa(COLOR.violeta, 255), lineWidthMinPixels: 2.5,
      updateTriggers: { getRadius: [colegioNuevo, e], getFillColor: [colegioNuevo] },
    }),
    colegioNuevo && new TextLayer({
      id: 'nuevo-etiqueta', data: [colegioNuevo], getPosition: (c: any) => [c.lon, c.lat], getText: () => '+ colegio nuevo',
      getPixelOffset: [0, -22 * e], getSize: 12.5 * e, getColor: alfa(COLOR.violeta, 255),
      fontFamily: 'Inter Tight Variable, sans-serif', fontWeight: 700, background: true, getBackgroundColor: [255, 255, 255, 235], backgroundPadding: [5, 3],
      updateTriggers: { getSize: [e], getPixelOffset: [e] },
    }),
  ].filter(Boolean)

  const alTocar = (info: PickingInfo) => {
    const id = info.layer?.id
    if (id === 'familias' && typeof info.object === 'number') return setSel({ tipo: 'familia', i: fams[info.object] })
    if (id === 'colegios' && typeof info.object === 'number') {
      if (onTocarColegio && escena === 'caso') return onTocarColegio(info.object)
      return setSel({ tipo: 'colegio', s: info.object })
    }
    if (id === 'candidatos' && info.object?.clave) return onTocarCandidato?.(info.object.clave)
    if (id === 'upz' && info.object && onTocarUpz) return onTocarUpz((info.object as any).properties.codigo)
    setSel(null)
    if (onTocarMapa && info.coordinate) onTocarMapa(info.coordinate[0], info.coordinate[1])
  }

  const epf = f.estudiantes_por_familia
  const enProceso = escena === 'proceso' && fase !== 'neutro'
  return (
    <div ref={ref} className="mapa">
      <DeckGL initialViewState={viewState} layers={capas} onClick={alTocar}
              controller={interactivo ? { dragRotate: false, touchRotate: false, doubleClickZoom: true, scrollZoom: { speed: 0.02, smooth: true } } : false}
              getCursor={({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : interactivo ? 'grab' : 'default')} />

      {escena === 'proceso' && (
        <div className="mapa__relato" aria-live="polite">
          {cuadro.paso && <span className="mapa__paso">{cuadro.paso}</span>}
          <p>{cuadro.texto}</p>
        </div>
      )}

      {enProceso && (
        <div className="mapa__contadores">
          {fase === 'llegada' && t < T1 && <span className="cont"><b>{entero(cuadro.c.llegaron * epf)}</b> llegaron</span>}
          <span className="cont"><i style={{ background: 'rgb(91,43,196)' }} /><b>{entero(cuadro.c.conColegio * epf)}</b> en sus opciones</span>
          {cuadro.c.buscando > 0 && <span className="cont"><i style={{ background: 'rgb(240,140,80)' }} /><b>{entero(cuadro.c.buscando * epf)}</b> {fase === 'llegada' ? 'sin cupo en sus opciones' : 'buscando'}</span>}
          {cuadro.c.reubicados > 0 && <span className="cont"><i style={{ background: 'rgb(38,132,132)' }} /><b>{entero(cuadro.c.reubicados * epf)}</b> reubicados</span>}
          {cuadro.c.sinCupo > 0 && <span className="cont"><i style={{ background: 'rgb(224,102,42)' }} /><b>{entero(cuadro.c.sinCupo * epf)}</b> sin cupo</span>}
        </div>
      )}

      {enProceso && (
        <div className="mapa__controles" role="group" aria-label="Controles de la animación">
          <button onClick={() => (terminado ? (setT(0), setPausado(false)) : setPausado((x) => !x))} title={terminado ? 'Repetir' : pausado ? 'Seguir' : 'Pausar'}>
            {terminado ? '↻' : pausado ? '▶' : '❚❚'}
          </button>
          {fase === 'diferida' && !terminado && <button onClick={siguienteRonda} title="Siguiente ronda">⏭</button>}
          <button onClick={() => setVelocidad((v) => (v === 1 ? 2 : v === 2 ? 0.5 : 1))} title="Velocidad">{velocidad === 0.5 ? '½×' : `${velocidad}×`}</button>
          <span className="mapa__barra"><span style={{ width: `${(100 * t) / Math.max(0.01, duracion)}%` }} /></span>
        </div>
      )}

      {escena === 'ciudad' && (
        <div className="mapa__leyenda">
          <span className="mapa__leyenda-titulo">Niños fuera de sus opciones · {coloreo === 'hoy' ? 'hoy' : 'con la política'}</span>
          <div className="mapa__escala">{ESCALA.map((x) => <span key={x.etiqueta}><i style={{ background: `rgb(${x.color.join(',')})` }} />{x.etiqueta}</span>)}</div>
          <span className="mapa__zona"><i />Zona crítica (SED)</span>
        </div>
      )}
      {escena === 'proceso' && (
        <div className="mapa__clave">
          <span><i className="k-anillo" />colegio · el relleno son sus cupos ocupados</span>
          <span><i className="k-punto" />cada punto, una familia ({epf} niños) · tócalo para ver su historia</span>
        </div>
      )}

      {sel && escena === 'proceso' && <Ficha datos={datos} r={r} sel={sel} cerrar={() => setSel(null)} />}

      {interactivo && <button className="mapa__centrar" onClick={() => setCentrar((x) => x + 1)} title="Volver a centrar">⤢</button>}
      {children}
    </div>
  )
}

function useRespiro(activo: boolean) {
  const [v, setV] = useState(1)
  useEffect(() => {
    if (!activo) return
    let id = 0, ult = 0
    const p = (ms: number) => { if (ms - ult > 60) { setV(0.5 + 0.5 * Math.sin(ms / 600)); ult = ms } id = requestAnimationFrame(p) }
    id = requestAnimationFrame(p)
    return () => cancelAnimationFrame(id)
  }, [activo])
  return activo ? v : 1
}

/** Ficha de una familia (su historia: hoy vs Matrícula+) o de un colegio. */
function Ficha({ datos, r, sel, cerrar }: { datos: Datos; r: Resultados; sel: NonNullable<Seleccion>; cerrar: () => void }) {
  const f = datos.familias
  const epf = f.estudiantes_por_familia
  if (sel.tipo === 'colegio') {
    const s = sel.s
    const usados = (sim: typeof r.hoy) => { let n = 0; for (let i = 0; i < f.n; i++) if (sim.fase1[i] === s || sim.fase2.asign[i] === s) n++; return n }
    const primera = (() => { let n = 0; const k = r.pol.pref.k; for (let i = 0; i < f.n; i++) if (r.pol.pref.prefs[i * k] === s) n++; return n })()
    return (
      <div className="ficha" role="dialog">
        <button className="ficha__cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
        <span className="etiqueta">Colegio</span>
        <h3>{nombreColegio(datos, s)}</h3>
        <dl>
          <div><dt>Cupos para nuevos</dt><dd>{entero((r.pol.cap[s] ?? 0) * epf)}</dd></div>
          <div><dt>Lo piden de 1.ª opción</dt><dd>{entero(primera * epf)}</dd></div>
          <div><dt>Ocupados hoy</dt><dd>{entero(usados(r.hoy) * epf)}</dd></div>
          <div><dt>Con Matrícula+</dt><dd>{entero(usados(r.pol) * epf)}</dd></div>
        </dl>
      </div>
    )
  }
  const i = sel.i
  const k = r.pol.pref.k
  const lista = Array.from({ length: k }, (_, o) => r.pol.pref.prefs[i * k + o]).filter((x) => x >= 0)
  const listaHoy = Array.from({ length: r.hoy.pref.k }, (_, o) => r.hoy.pref.prefs[i * r.hoy.pref.k + o]).filter((x) => x >= 0)
  const destino = (sim: typeof r.hoy) => sim.fase1[i] >= 0
    ? <><b>{nombreColegio(datos, sim.fase1[i])}</b> <span className="ficha__op">{sim.opcion[i] + 1}.ª opción</span></>
    : sim.fase2.asign[i] >= 0
      ? <><b>{nombreColegio(datos, sim.fase2.asign[i])}</b> <span className="ficha__op ficha__op--reub">reubicada a {decimal(sim.fase2.dist[i])} km</span></>
      : <b className="ficha__sin">Sin ningún cupo cercano</b>
  const upz = datos.upz.features.find((x) => datos.posUpz[x.properties.codigo] === f.upz[i])?.properties.nombre
  return (
    <div className="ficha" role="dialog">
      <button className="ficha__cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
      <span className="etiqueta">Familia sintética · {epf} niños · {upz}</span>
      <div className="ficha__rasgos">
        {r.pol.at.vulnerable[i] === 1 && <span>Vulnerable</span>}
        {r.pol.at.hermano[i] >= 0 && <span>Hermano en {nombreColegio(datos, r.pol.at.hermano[i])}</span>}
      </div>
      <span className="ficha__sub">Su lista</span>
      <ol>{lista.map((s) => <li key={s}>{nombreColegio(datos, s)}</li>)}</ol>
      {listaHoy.join() !== lista.join() && <p className="ficha__nota">Con el colegio nuevo, su lista cambió.</p>}
      <div className="ficha__resultado"><span>Hoy</span><div>{destino(r.hoy)}</div></div>
      <div className="ficha__resultado ficha__resultado--mas"><span>Matrícula+</span><div>{destino(r.pol)}</div></div>
    </div>
  )
}
