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
 *  · "caso"    — una familia de ejemplo, sus colegios y su viaje animado: pide cada opción en orden,
 *                la rechazan (✕) o queda (✓); si no cabe, la reubican o queda sin cupo. En bucle.
 *
 * Con `conexiones` (portada) las familias se van conectando con su colegio en bucle, como si la
 * simulación corriera de fondo. Los colores siguen el tema claro/oscuro.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator, type PickingInfo } from '@deck.gl/core'
import { encuadrar } from './encuadre'
import { GeoJsonLayer, LineLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { decimal, entero, type Bbox, type Datos, type Feature, type PropsUpz } from '../datos'
import type { ColegioNuevo, Supuestos } from '../motor'
import { familiasDe, nombreColegio, type Resultados } from '../estado'
import { useTema, type Tema } from '../tema'
import type { Cual, Viaje } from '../capitulos/Caso'

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
// En oscuro la escala va al revés: más niños fuera = más brillante
const ESCALA_OSCURA: RGB[] = [[36, 33, 74], [62, 46, 132], [100, 64, 204], [144, 104, 246], [206, 186, 255]]
const escalaDe = (tema: Tema) => (tema === 'oscuro' ? ESCALA.map((x, i) => ({ ...x, color: ESCALA_OSCURA[i] })) : ESCALA)
const colorEscala = (escala: typeof ESCALA, pct: number) => (escala.find((e) => pct < e.hasta) ?? escala[escala.length - 1]).color

/** Colores del mapa que dependen del tema (fondos, bordes, textos). */
const PALETA = {
  claro: {
    tinta: COLOR.tinta, upzFuera: [234, 232, 240, 255] as RGBA, upzDentro: [255, 255, 255, 255] as RGBA,
    bordeCiudad: [255, 255, 255, 220] as RGBA, bordeDentro: [22, 19, 43, 70] as RGBA, bordeFuera: [255, 255, 255, 255] as RGBA,
    texto: [90, 88, 112, 220] as RGBA, superficie: [255, 255, 255, 240] as RGBA, contorno: [255, 255, 255, 200] as RGBA,
    ocupacion: [22, 19, 43, 205] as RGBA, nuevo: [241, 235, 254, 255] as RGBA,
  },
  oscuro: {
    tinta: [236, 233, 250, 255] as RGBA, upzFuera: [26, 28, 56, 255] as RGBA, upzDentro: [40, 42, 82, 255] as RGBA,
    bordeCiudad: [13, 15, 34, 230] as RGBA, bordeDentro: [255, 255, 255, 60] as RGBA, bordeFuera: [13, 15, 34, 255] as RGBA,
    texto: [176, 172, 204, 220] as RGBA, superficie: [30, 32, 66, 245] as RGBA, contorno: [13, 15, 34, 210] as RGBA,
    ocupacion: [236, 233, 250, 215] as RGBA, nuevo: [52, 40, 110, 255] as RGBA,
  },
}
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
const N_CONEXIONES = 220       // portada: familias conectándose a la vez
const PERIODO_CONEXION = 4.2   // s que dura cada conexión (crece, late el colegio, se desvanece)
const PASO_VIAJE = 1.35        // caso: s por colegio pedido (la línea crece 0.8 s y luego se marca)
const CRECE_VIAJE = 0.8
const PAUSA_VIAJE = 2.8        // caso: s quieto al final antes de repetir

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
  caso?: { lon: number; lat: number; colegios: number[]; hermanoEn: number | null; viaje?: Viaje | null; cual?: Cual } | null
  onCual?: (c: Cual) => void
  onTocarColegio?: (sede: number) => void
  /** interacción */
  onTocarUpz?: (codigo: string) => void
  onTocarMapa?: (lon: number, lat: number) => void
  interactivo?: boolean
  /** portada: familias que se conectan con su colegio en bucle */
  conexiones?: boolean
  /** espacio arriba/abajo que tapan los paneles flotantes (px) */
  margen?: { arriba?: number; abajo?: number; izquierda?: number; derecha?: number }
  children?: ReactNode
}

type Seleccion = { tipo: 'familia'; i: number } | { tipo: 'colegio'; s: number } | null

export default function MapaEscena(props: Props) {
  const {
    datos, r, supuestos, escena, localidad, coloreo = 'hoy', respirar = false, upzSeleccionada = null,
    fase = 'neutro', reproduccion = 0, rapido = false, alTerminar, textoNeutro,
    colegioNuevo = null, mostrarCandidatos = false, onTocarCandidato, caso = null, onTocarColegio, onCual,
    onTocarUpz, onTocarMapa, interactivo = true, margen = {}, children, conexiones = false,
  } = props
  const tema = useTema()
  const P = PALETA[tema]
  const escala = escalaDe(tema)
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
      const m = 0.016
      let [x0, y0, x1, y1] = [caso.lon - m, caso.lat - m * 0.8, caso.lon + m, caso.lat + m * 0.8]
      for (const s of caso.viaje?.sedes ?? []) {
        const p = r.pol.pos[s]
        if (p) { x0 = Math.min(x0, p[0] - 0.006); y0 = Math.min(y0, p[1] - 0.006); x1 = Math.max(x1, p[0] + 0.006); y1 = Math.max(y1, p[1] + 0.006) }
      }
      return [[x0, y0], [x1, y1]]
    }
    if (!localidad) return datos.bboxCiudad
    if (fams.length) {
      const xs = fams.map((i) => f.lon[i]).sort((a, b) => a - b)
      const ys = fams.map((i) => f.lat[i]).sort((a, b) => a - b)
      const q = (a: number[], p: number) => a[Math.round(p * (a.length - 1))]
      return [[q(xs, 0.02), q(ys, 0.02)], [q(xs, 0.98), q(ys, 0.98)]]
    }
    return datos.bboxLocalidad[localidad]
  }, [escena, caso?.lon, caso?.lat, caso?.viaje?.sedes.join(), localidad, fams, f, datos])  // eslint-disable-line react-hooks/exhaustive-deps
  const viewState = useMemo(() => {
    const vp = encuadrar(encuadre, w, h, margen)
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
      const l = cerca.sort((a, b) => a[0] - b[0]).slice(0, 30).map((x) => x[1])
      return [...new Set([...l, ...(caso.viaje?.sedes ?? [])])]
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

  // ---------------------------------------------------------------- conexiones (portada)
  // Familias de toda la ciudad piden su colegio: la línea crece desde la casa, el colegio late al
  // recibirla y la línea se desvanece. Cada vuelta toma otras familias (asignación con Matrícula+).
  const reloj = useReloj(conexiones)
  const conAsignacion = useMemo(() => {
    if (!conexiones) return []
    const l: number[] = []
    for (let i = 0; i < f.n; i++) if (r.pol.fase1[i] >= 0 || r.pol.fase2.asign[i] >= 0) l.push(i)
    return l
  }, [conexiones, f.n, r.pol])
  const enlaces = useMemo(() => {
    if (!conAsignacion.length) return []
    const out: { de: [number, number]; a: [number, number]; punta: [number, number]; color: RGBA; alfa: number; llegada: number }[] = []
    for (let n = 0; n < N_CONEXIONES; n++) {
      const tt = reloj + ((n * 0.6180339887) % 1) * PERIODO_CONEXION
      const vuelta = Math.floor(tt / PERIODO_CONEXION)
      const u = (tt % PERIODO_CONEXION) / PERIODO_CONEXION
      const i = conAsignacion[(n * 7919 + vuelta * 104729) % conAsignacion.length]
      const s = r.pol.fase1[i] >= 0 ? r.pol.fase1[i] : r.pol.fase2.asign[i]
      const de: [number, number] = [f.lon[i], f.lat[i]], a = r.pol.pos[s] ?? de
      const p = suave(Math.min(1, u / 0.4))
      out.push({
        de, a, punta: [de[0] + (a[0] - de[0]) * p, de[1] + (a[1] - de[1]) * p],
        color: r.pol.fase1[i] < 0 ? COLOR.reubicado : r.pol.opcion[i] === 0 ? COLOR.primera : COLOR.otra,
        alfa: u < 0.7 ? Math.min(1, u / 0.08) : Math.max(0, 1 - (u - 0.7) / 0.3),
        llegada: u >= 0.4 && u < 0.75 ? (u - 0.4) / 0.35 : -1,
      })
    }
    return out
  }, [conAsignacion, reloj, r.pol, f])
  const latidos = enlaces.filter((x) => x.llegada >= 0)

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

  // ---------------------------------------------------------------- viaje de la familia (caso)
  // Desde la casa, una línea crece hacia cada opción en orden: ✕ si no hay cupo para ella, ✓ si
  // queda. Si no cupo en ninguna, la reubican (verde azulado) o queda sin cupo (naranja). En bucle.
  const viaje = escena === 'caso' && caso ? caso.viaje ?? null : null
  const [vez, setVez] = useState(0)
  const quieto = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const relojViaje = useReloj(!!viaje && !quieto, `${viaje?.llave}-${vez}`)
  const recorrido = useMemo(() => {
    if (!viaje || !caso) return null
    const n = viaje.pasos.length
    const total = n * PASO_VIAJE + (viaje.final === 'sin' ? 0.8 : 0) + PAUSA_VIAJE
    const tv = quieto ? Infinity : relojViaje % total
    const casa: [number, number] = [caso.lon, caso.lat]
    const lineas: { de: [number, number]; a: [number, number]; color: RGBA; ancho: number }[] = []
    const anillos: { p: [number, number]; color: RGBA; u: number; radio: number }[] = []
    const marcas: { p: [number, number]; texto: string; color: RGBA }[] = []
    let punta: { p: [number, number]; color: RGBA } | null = null
    let texto = ''
    viaje.pasos.forEach((paso, j) => {
      const t0 = j * PASO_VIAJE
      if (tv < t0) return
      const a = coord(paso.sede)
      const nombre = nombreColegio(datos, paso.sede)
      const pc = suave(Math.min(1, (tv - t0) / CRECE_VIAJE))
      const reub = paso.resultado === 'reubicado', rech = paso.resultado === 'rechazo'
      if (pc < 1) {
        const c = reub ? COLOR.reubicado : COLOR.pidiendo
        const p: [number, number] = [casa[0] + (a[0] - casa[0]) * pc, casa[1] + (a[1] - casa[1]) * pc]
        lineas.push({ de: casa, a: p, color: c, ancho: 3 })
        punta = { p, color: c }
        texto = reub ? `No cupo en sus opciones: la reubican en ${nombre}` : `Pide su ${j + 1}.ª opción: ${nombre}`
        return
      }
      const u = Math.min(1, (tv - t0 - CRECE_VIAJE) / 0.35)   // la marca aparece
      const color = rech ? COLOR.rechazo : reub ? COLOR.reubicado : tema === 'oscuro' ? COLOR.otra : COLOR.primera
      lineas.push({ de: casa, a, color: rech ? alfa(COLOR.rechazo, Math.round(230 - 130 * u)) : color, ancho: rech ? 2 : 3.6 })
      anillos.push({ p: a, color, u, radio: radioCol(paso.sede) })
      marcas.push({ p: a, texto: rech ? '✕' : '✓', color })
      // Donde queda, el colegio late
      if (!rech) { const l = quieto ? 0.5 : ((tv - t0 - CRECE_VIAJE) % 1.4) / 1.4; anillos.push({ p: a, color, u: 1 - l, radio: radioCol(paso.sede) + 14 * e * l }) }
      texto = rech ? `✕ ${nombre}: no hubo cupo para ella` : reub ? `Reubicada en ${nombre}, fuera de sus opciones` : `✓ Queda en ${nombre}, su ${j + 1}.ª opción`
    })
    if (viaje.final === 'sin' && tv >= n * PASO_VIAJE) {
      const l = quieto ? 0.5 : ((tv - n * PASO_VIAJE) % 1.4) / 1.4
      anillos.push({ p: casa, color: COLOR.sin, u: 1, radio: 13 * e }, { p: casa, color: COLOR.sin, u: 1 - l, radio: (13 + 16 * l) * e })
      texto = `Sin cupo: ningún colegio con cupo a menos de ${decimal(supuestos.radioReubicacionKm)} km`
    }
    return { lineas, anillos, marcas, punta: punta as { p: [number, number]; color: RGBA } | null, texto, avance: Math.min(1, tv / (total - PAUSA_VIAJE)) }
  }, [viaje, caso, relojViaje, quieto, datos, supuestos, e, pos, capMax, tema])  // eslint-disable-line react-hooks/exhaustive-deps


  const capas: any[] = [
    new GeoJsonLayer<PropsUpz>({
      id: 'upz', data: datos.upz as any, filled: true, stroked: true,
      pickable: !!onTocarUpz,
      opacity: respirar ? 0.75 + 0.25 * respiro : 1,
      getFillColor: (x: Feature<PropsUpz>) => {
        if (escena === 'ciudad') return alfa(colorEscala(escala, colorUpz[datos.posUpz[x.properties.codigo]] ?? 0), 255)
        return x.properties.localidad === localidad ? P.upzDentro : P.upzFuera
      },
      getLineColor: (x: Feature<PropsUpz>) => (x.properties.codigo === upzSeleccionada ? P.tinta
        : escena === 'ciudad' ? P.bordeCiudad : x.properties.localidad === localidad ? P.bordeDentro : P.bordeFuera),
      getLineWidth: (x: Feature<PropsUpz>) => (x.properties.codigo === upzSeleccionada ? 3.5 : 1),
      lineWidthUnits: 'pixels',
      updateTriggers: { getFillColor: [escena, colorUpz, localidad, tema], getLineColor: [upzSeleccionada, escena, localidad, tema], getLineWidth: [upzSeleccionada] },
      transitions: { getFillColor: 450 },
    }),
    escena === 'ciudad' && new GeoJsonLayer({
      id: 'zona', data: zona as any, filled: false, stroked: true,
      getLineColor: P.tinta, getLineWidth: 2.5 * e, lineWidthUnits: 'pixels',
      getDashArray: [4, 3], updateTriggers: { getLineWidth: [e], getLineColor: [tema] },
    }),
    etiquetas.length && new TextLayer({
      id: 'upz-nombres', data: etiquetas, getPosition: (x: any) => x.p, getText: (x: any) => x.n,
      getSize: 10.5 * e, getColor: P.texto, updateTriggers: { getColor: [tema] }, fontFamily: 'Inter Tight Variable, sans-serif', fontWeight: 600, characterSet: 'auto',
    }),
    escena === 'ciudad' && new ScatterplotLayer({
      id: 'sedes', data: datos.posSedes, getPosition: (p: any) => p, getRadius: 1.4 * e, radiusUnits: 'pixels',
      getFillColor: alfa(P.tinta, 130), updateTriggers: { getRadius: [e], getFillColor: [tema] },
    }),
    enlaces.length && new LineLayer({
      id: 'conexiones', data: enlaces, getSourcePosition: (x: any) => x.de, getTargetPosition: (x: any) => x.punta,
      getColor: (x: any) => alfa(P.tinta, Math.round((tema === 'oscuro' ? 190 : 175) * x.alfa)), getWidth: 1.7 * e, widthUnits: 'pixels',
    }),
    latidos.length && new ScatterplotLayer({
      id: 'conexiones-latido', data: latidos, getPosition: (x: any) => x.a, radiusUnits: 'pixels',
      getRadius: (x: any) => e * (3 + 13 * x.llegada), stroked: true, filled: false, lineWidthUnits: 'pixels', getLineWidth: 1.8 * e,
      getLineColor: (x: any) => alfa(tema === 'oscuro' ? COLOR.otra : COLOR.primera, Math.round(230 * (1 - x.llegada))),
    }),
    enlaces.length && new ScatterplotLayer({
      id: 'conexiones-puntos', data: enlaces, radiusUnits: 'pixels',
      getPosition: (x: any) => x.punta, getRadius: 3.4 * e, getFillColor: (x: any) => alfa(x.color, Math.round(255 * x.alfa)),
      stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1 * e, getLineColor: (x: any) => alfa(P.contorno, Math.round(220 * x.alfa)),
    }),
    enlaces.length && new ScatterplotLayer({
      id: 'conexiones-casas', data: enlaces, radiusUnits: 'pixels',
      getPosition: (x: any) => x.de, getRadius: 1.8 * e, getFillColor: (x: any) => alfa(P.tinta, Math.round(200 * x.alfa)),
    }),
    cuadro.lineas.length && new LineLayer({
      id: 'solicitudes', data: cuadro.lineas, getSourcePosition: (l: any) => l.de, getTargetPosition: (l: any) => l.a,
      getColor: (l: any) => l.color, getWidth: (l: any) => (l.ancho ?? 1.3) * e, widthUnits: 'pixels', updateTriggers: { getColor: [marca], getWidth: [e] },
    }),
    escena === 'proceso' && new ScatterplotLayer<number>({
      id: 'familias', data: fams.map((_, j) => j), pickable: true,
      getPosition: (j) => [f.lon[fams[j]], f.lat[fams[j]]],
      getFillColor: (j) => cuadro.colorFam[j], getRadius: (j) => cuadro.radioFam[j] * e, radiusUnits: 'pixels',
      stroked: true, getLineColor: (j) => (sel?.tipo === 'familia' && sel.i === fams[j] ? P.tinta : P.contorno),
      getLineWidth: (j) => (sel?.tipo === 'familia' && sel.i === fams[j] ? 2.5 : 0.6) * e, lineWidthUnits: 'pixels',
      updateTriggers: { getFillColor: [marca], getRadius: [marca, e], getLineColor: [sel, tema], getLineWidth: [sel, e] },
    }),
    colegios.length && new ScatterplotLayer<number>({
      id: 'colegios', data: colegios, pickable: true,
      getPosition: coord, getRadius: radioCol, radiusUnits: 'pixels',
      getFillColor: (s) => (s >= S ? P.nuevo : P.superficie),
      stroked: true, lineWidthUnits: 'pixels',
      getLineWidth: (s) => e * (ocup(s) > (sim.cap[s] ?? 0) ? 3.2 : (caso && caso.colegios.includes(s)) || (sel?.tipo === 'colegio' && sel.s === s) ? 3 : 1.6),
      getLineColor: (s) => (ocup(s) > (sim.cap[s] ?? 0) ? COLOR.rechazo : (caso && caso.colegios.includes(s)) ? COLOR.violeta : s >= S ? COLOR.violeta : P.tinta),
      updateTriggers: { getFillColor: [tema], getLineWidth: [marca, caso, sel, e], getLineColor: [marca, caso, tema], getRadius: [capMax, e] },
    }),
    escena === 'proceso' && colegios.length && new ScatterplotLayer<number>({
      id: 'ocupacion', data: colegios,
      getPosition: coord, getRadius: (s) => radioCol(s) * Math.sqrt(Math.min(1, ocup(s) / Math.max(1, sim.cap[s] ?? 1))), radiusUnits: 'pixels',
      getFillColor: (s) => (s >= S ? alfa(COLOR.violeta, 230) : P.ocupacion),
      updateTriggers: { getRadius: [marca, capMax, e], getFillColor: [tema] },
    }),
    caso && escena === 'caso' && new TextLayer({
      id: 'caso-numeros', data: caso.colegios.map((s, o) => ({ s, o })),
      getPosition: (x: any) => coord(x.s), getText: (x: any) => String(x.o + 1), getSize: 13 * e,
      getColor: alfa(COLOR.violeta, 255), getPixelOffset: [0, -(caso.viaje ? 30 : 20) * e], fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600,
      background: true, getBackgroundColor: P.superficie, backgroundPadding: [4, 2], updateTriggers: { getSize: [e], getPixelOffset: [e], getBackgroundColor: [tema] },
    }),
    caso && escena === 'caso' && new LineLayer({
      id: 'caso-lineas', data: caso.colegios, getSourcePosition: () => [caso.lon, caso.lat], getTargetPosition: (s: number) => coord(s),
      getColor: alfa(COLOR.violeta, recorrido ? 55 : 160), getWidth: (recorrido ? 1.4 : 2) * e, widthUnits: 'pixels',
      updateTriggers: { getWidth: [e, !!recorrido], getColor: [!!recorrido] },
    }),
    recorrido && new LineLayer({
      id: 'caso-viaje', data: recorrido.lineas, getSourcePosition: (l: any) => l.de, getTargetPosition: (l: any) => l.a,
      getColor: (l: any) => l.color, getWidth: (l: any) => l.ancho * e, widthUnits: 'pixels',
    }),
    recorrido && new ScatterplotLayer({
      id: 'caso-anillos', data: recorrido.anillos, getPosition: (x: any) => x.p, radiusUnits: 'pixels',
      getRadius: (x: any) => x.radio + e * (4 + 10 * (1 - x.u)), stroked: true, filled: false, lineWidthUnits: 'pixels', getLineWidth: 3 * e,
      getLineColor: (x: any) => alfa(x.color, Math.round(255 * x.u)),
    }),
    recorrido && new TextLayer({
      id: 'caso-marcas', data: recorrido.marcas, getPosition: (x: any) => x.p, getText: (x: any) => x.texto, getSize: 15 * e,
      getColor: (x: any) => x.color, fontFamily: 'Inter Tight Variable, sans-serif', fontWeight: 800, characterSet: ['✕', '✓'],
    }),
    recorrido?.punta && new ScatterplotLayer({
      id: 'caso-punta', data: [recorrido.punta], getPosition: (x: any) => x.p, getRadius: 5 * e, radiusUnits: 'pixels',
      getFillColor: (x: any) => x.color, stroked: true, getLineColor: alfa(P.superficie, 255), lineWidthMinPixels: 2,
    }),
    caso && new ScatterplotLayer({
      id: 'caso-casa', data: [caso], getPosition: (x: any) => [x.lon, x.lat], getRadius: 8 * e, radiusUnits: 'pixels',
      getFillColor: alfa(COLOR.sin, 255), stroked: true, getLineColor: alfa(P.superficie, 255), lineWidthMinPixels: 3,
      updateTriggers: { getRadius: [e], getLineColor: [tema] },
    }),
    (mostrarCandidatos || colegioNuevo) && new ScatterplotLayer<any>({
      id: 'candidatos', pickable: !!onTocarCandidato,
      data: [...(mostrarCandidatos ? datos.indice.colegio_nuevo : []), ...(colegioNuevo && !colegioNuevo.clave ? [{ ...colegioNuevo, clave: '' }] : [])],
      getPosition: (c: any) => [c.lon, c.lat], radiusUnits: 'pixels',
      getRadius: (c: any) => e * (colegioNuevo && ((c.clave && c.clave === colegioNuevo.clave) || (!c.clave && !colegioNuevo.clave)) ? 11 : 7),
      getFillColor: (c: any) => (colegioNuevo && ((c.clave && c.clave === colegioNuevo.clave) || (!c.clave && !colegioNuevo.clave)) ? COLOR.violeta : alfa(P.superficie, 255)),
      stroked: true, getLineColor: alfa(COLOR.violeta, 255), lineWidthMinPixels: 2.5,
      updateTriggers: { getRadius: [colegioNuevo, e], getFillColor: [colegioNuevo, tema] },
    }),
    colegioNuevo && new TextLayer({
      id: 'nuevo-etiqueta', data: [colegioNuevo], getPosition: (c: any) => [c.lon, c.lat], getText: () => '+ colegio nuevo',
      getPixelOffset: [0, -22 * e], getSize: 12.5 * e, getColor: alfa(COLOR.violeta, 255),
      fontFamily: 'Inter Tight Variable, sans-serif', fontWeight: 700, background: true, getBackgroundColor: P.superficie, backgroundPadding: [5, 3],
      updateTriggers: { getSize: [e], getPixelOffset: [e], getBackgroundColor: [tema] },
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
          <div className="mapa__escala">{escala.map((x) => <span key={x.etiqueta}><i style={{ background: `rgb(${x.color.join(',')})` }} />{x.etiqueta}</span>)}</div>
          <span className="mapa__zona"><i />Zona crítica (SED)</span>
        </div>
      )}
      {escena === 'proceso' && (
        <div className="mapa__clave">
          <span><i className="k-anillo" />colegio · el relleno son sus cupos ocupados</span>
          <span><i className="k-punto" />cada punto, una familia ({epf} niños) · tócalo para ver su historia</span>
        </div>
      )}

      {recorrido && (
        <div className="mapa__viaje">
          <div className="mapa__viaje-fila">
            {onCual ? (
              <div className="segmentos" role="group" aria-label="Qué viaje ver">
                <button className={`segmento ${caso?.cual === 'hoy' ? 'segmento--activo' : ''}`} onClick={() => onCual('hoy')}>Hoy</button>
                <button className={`segmento ${caso?.cual !== 'hoy' ? 'segmento--activo' : ''}`} onClick={() => onCual('matricula')}>Matrícula+</button>
              </div>
            ) : <span className="mapa__paso">Viaje · {caso?.cual === 'hoy' ? 'Hoy' : 'Matrícula+'}</span>}
            {!quieto && onCual && <button className="mapa__repetir" onClick={() => setVez((x) => x + 1)} title="Repetir el viaje" aria-label="Repetir el viaje">↻</button>}
          </div>
          <p aria-live="polite">{recorrido.texto || ' '}</p>
          {!quieto && <span className="mapa__barra"><span style={{ width: `${100 * recorrido.avance}%` }} /></span>}
        </div>
      )}

      {sel && escena === 'proceso' && <Ficha datos={datos} r={r} sel={sel} cerrar={() => setSel(null)} />}

      {interactivo && <button className="mapa__centrar" onClick={() => setCentrar((x) => x + 1)} title="Volver a centrar">⤢</button>}
      {children}
    </div>
  )
}

/** Segundos desde que se activó (o cambió la llave), a ~30 cuadros por segundo. Con "reducir movimiento" se queda quieto. */
function useReloj(activo: boolean, llave = '') {
  const [s, setS] = useState({ llave, s: 0 })
  useEffect(() => {
    if (!activo || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let id = 0, ult = 0
    const inicio = performance.now()
    const p = (ms: number) => { if (ms - ult > 33) { setS({ llave, s: Math.max(0, ms - inicio) / 1000 }); ult = ms } id = requestAnimationFrame(p) }
    id = requestAnimationFrame(p)
    return () => cancelAnimationFrame(id)
  }, [activo, llave])
  return activo && s.llave === llave ? s.s : 0
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
