/**
 * El proceso de asignación, animado dentro de una localidad.
 *
 *  - Familias: puntos en sus casas (gris = esperando, azul = con colegio, naranja = sin cupo).
 *  - Colegios: anillo = capacidad; círculo interior = cupos ocupados (lleno = anillo completo).
 *  - Líneas: cada solicitud de una familia a un colegio.
 *
 * Fases:
 *  - "llegada": así se asigna hoy. Las familias llegan una por una (en el mismo orden que la línea
 *    base de Python) y toman el primer cupo libre de su lista.
 *  - "diferida": asignación diferida por rondas. Todas piden a la vez; cada colegio retiene a las de
 *    más prioridad; las rechazadas piden su siguiente opción… hasta que nadie cambia.
 *  - "neutro": todo en espera, listo para asignar.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator, WebMercatorViewport, type PickingInfo } from '@deck.gl/core'
import { GeoJsonLayer, LineLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { COLORES } from '../config'
import { entero, type Datos, type Feature, type Palancas, type PropsUpz } from '../datos'
import { familiasDe, type SimHoy, type SimPolitica } from '../simulacion'

export type FaseProceso = 'neutro' | 'llegada' | 'diferida'

type RGBA = [number, number, number, number]
const C = {
  espera: [150, 160, 178, 200] as RGBA,
  pidiendo: [120, 160, 215, 255] as RGBA,
  primera: [47, 111, 181, 255] as RGBA,
  otra: [126, 170, 222, 255] as RGBA,
  rechazo: [232, 137, 61, 255] as RGBA,
  sin: [180, 86, 26, 255] as RGBA,
  colegio: [20, 33, 61, 255] as RGBA,
}

interface Props {
  datos: Datos
  localidad: string
  hoy: SimHoy
  politica: SimPolitica
  palancas: Palancas
  fase: FaseProceso
  /** cambia este número para volver a reproducir desde el inicio */
  reproduccion: number
  rapido?: boolean
  /** mostrar directamente el estado final (sin animar) */
  sinAnimar?: boolean
  alTerminar?: () => void
  onTocarCandidato?: (clave: string) => void
}

// --------------------------------------------------------------- utilidades
function useTamano<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [tam, setTam] = useState({ w: 390, h: 500 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setTam({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, tam] as const
}

/** Segundos desde el último cambio de `clave`, mientras `activo`. */
function useReloj(activo: boolean, clave: unknown, hasta: number) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!activo) { setT(0); return }
    let id = 0, ultimo = 0
    const inicio = performance.now()
    const paso = (ms: number) => {
      const s = (ms - inicio) / 1000
      if (ms - ultimo > 30 || s >= hasta) { setT(Math.min(s, hasta + 0.01)); ultimo = ms }
      if (s < hasta) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [activo, clave, hasta])
  return t
}

const cotaSuperior = (a: Int32Array, x: number) => {   // nº de elementos < x (a ordenado)
  let lo = 0, hi = a.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m }
  return lo
}
const suave = (x: number) => x * x * (3 - 2 * x)

function centroide(g: any): [number, number] {
  let sx = 0, sy = 0, n = 0
  const anillo = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates.reduce((a: any, p: any) => (p[0].length > a.length ? p[0] : a), [])
  for (const [x, y] of anillo) { sx += x; sy += y; n++ }
  return [sx / n, sy / n]
}

/** Duración de cada ronda: las primeras despacio (se explican), luego más rápido. */
function tiemposRondas(R: number, rapido: boolean) {
  const base = rapido ? [1.3, 1.1, 0.8] : [3.2, 2.6, 1.6, 1.1, 0.8]
  const min = rapido ? 0.3 : 0.45
  const inicio: number[] = []
  let t = 0
  for (let r = 1; r <= R; r++) { inicio[r] = t; t += base[r - 1] ?? Math.max(min, base[base.length - 1] * 0.85 ** (r - base.length)) }
  return { inicio, total: t }
}

// --------------------------------------------------------------- componente
export default function MapaProceso({
  datos, localidad, hoy, politica, palancas, fase, reproduccion, rapido = false, sinAnimar = false,
  alTerminar, onTocarCandidato,
}: Props) {
  const [ref, { w, h }] = useTamano<HTMLDivElement>()
  const f = datos.familias
  const k = f.opciones
  const S = f.n_sedes
  const fams = useMemo(() => familiasDe(datos, localidad), [datos, localidad])
  const preset = datos.indice.presets.find((p) => p.clave === palancas.preset)!
  const nuevo = datos.indice.colegio_nuevo.find((c) => c.clave === politica.claveColegio)

  // Posición de cada colegio (sedes + colegio nuevo al final)
  const posColegio = useMemo(() => {
    const pos: [number, number][] = datos.colegios.features.filter((x) => x.properties.tipo === 'sede')
      .map((x) => x.geometry.coordinates)
    return pos
  }, [datos])
  const coordColegio = (s: number): [number, number] => (s < S ? posColegio[s] : [nuevo!.lon, nuevo!.lat])

  const sim = fase === 'llegada' ? hoy : politica
  const cap = sim.cap
  const prefs = sim.pref.prefs

  // Colegios que importan para esta localidad: los que aparecen en las listas de sus familias
  const colegios = useMemo(() => {
    const set = new Set<number>()
    for (const i of fams) for (let o = 0; o < k; o++) set.add(prefs[i * k + o])
    return [...set]
  }, [fams, prefs, k])
  const capMax = useMemo(() => Math.max(1, ...colegios.map((s) => cap[s])), [colegios, cap])

  // --- Precálculos de la llegada: turnos (ordenados) de quienes ocuparon cada colegio
  const turnosPorColegio = useMemo(() => {
    const listas: number[][] = Array.from({ length: hoy.cap.length }, () => [])
    const { asign, turno } = hoy.llegada
    for (let i = 0; i < f.n; i++) if (asign[i] >= 0) listas[asign[i]].push(turno[i])
    return listas.map((l) => Int32Array.from(l.sort((a, b) => a - b)))
  }, [hoy, f.n])

  // --- Precálculos de la diferida: ocupación al final de cada ronda y solicitudes por ronda
  const rondas = useMemo(() => {
    const { rondaPropuesta, rondaRechazo, rondas: R } = politica.traza
    const nS = politica.cap.length
    const dif = new Int32Array(nS * (R + 2))
    const props = new Int32Array(nS * (R + 2))
    const p = politica.pref.prefs
    for (let ix = 0; ix < f.n * k; ix++) {
      const pr = rondaPropuesta[ix]
      if (!pr) continue
      const s = p[ix], q = rondaRechazo[ix]
      props[s * (R + 2) + pr]++
      dif[s * (R + 2) + pr]++
      dif[s * (R + 2) + (q || R + 1)]--
    }
    const ocup = new Int32Array(nS * (R + 2))      // ocupación al final de la ronda r
    for (let s = 0; s < nS; s++) {
      let acc = 0
      for (let r = 0; r <= R + 1; r++) { acc += dif[s * (R + 2) + r]; ocup[s * (R + 2) + r] = acc }
    }
    return { R, ocup, props, ...tiemposRondas(R, rapido) }
  }, [politica, f.n, k, rapido])

  const duracion = fase === 'llegada' ? (rapido ? 5 : 10) : fase === 'diferida' ? rondas.total + 0.6 : 0
  const animando = fase !== 'neutro' && !sinAnimar
  const t = useReloj(animando, `${reproduccion}-${fase}-${localidad}`, duracion)
  const terminado = !animando || t >= duracion
  const avisado = useRef('')
  useEffect(() => {
    const llave = `${reproduccion}-${fase}-${localidad}`
    if (fase !== 'neutro' && terminado && avisado.current !== llave) { avisado.current = llave; alTerminar?.() }
  }, [terminado, fase, reproduccion, localidad, alTerminar])

  // --------------------------------------------------------------- estado del cuadro actual
  const cuadro = useMemo(() => {
    const colorFam = new Array<RGBA>(fams.length)
    const radioFam = new Float32Array(fams.length)
    const lineas: { de: [number, number]; a: [number, number]; color: RGBA }[] = []
    const ocupado = new Map<number, number>()
    let conColegio = 0, buscando = 0, sinCupo = 0, llegaron = 0
    let texto = '', paso = ''

    if (fase === 'neutro') {
      fams.forEach((_, j) => { colorFam[j] = C.espera; radioFam[j] = 2.2 })
      colegios.forEach((s) => ocupado.set(s, 0))
      texto = 'Elige a quién darle prioridad y toca ▶ Asignar con Matrícula+.'
    } else if (fase === 'llegada') {
      const p = terminado ? 1 : suave(Math.min(1, t / duracion))
      const T = p * f.n
      const ventana = f.n * 0.035
      const { asign, opcion, turno } = hoy.llegada
      fams.forEach((i, j) => {
        if (turno[i] >= T) { colorFam[j] = C.espera; radioFam[j] = 2.2; return }
        llegaron++
        if (asign[i] >= 0) { conColegio++; colorFam[j] = opcion[i] === 0 ? C.primera : C.otra; radioFam[j] = 2.6 }
        else { sinCupo++; colorFam[j] = C.sin; radioFam[j] = 3.6 }
        if (!terminado && turno[i] > T - ventana) {
          const destino = asign[i] >= 0 ? asign[i] : prefs[i * k]
          lineas.push({ de: [f.lon[i], f.lat[i]], a: coordColegio(destino), color: asign[i] >= 0 ? C.primera : C.rechazo })
        }
      })
      colegios.forEach((s) => ocupado.set(s, cotaSuperior(turnosPorColegio[s], T)))
      paso = 'Así se asigna hoy'
      texto = p < 0.3 ? 'Las familias piden cupo en orden de llegada: quien llega primero, elige primero.'
        : p < 0.7 ? 'Cada familia toma el primer colegio de su lista que todavía tenga cupo.'
          : !terminado ? 'Los colegios se llenan. Quien llega tarde encuentra sus 3 opciones sin cupo.'
            : `${entero(sinCupo * f.estudiantes_por_familia)} niños de ${localidad} se quedan sin cupo por llegar tarde.`
    } else {
      const { R, ocup, props, inicio } = rondas
      const { rondaPropuesta, rondaRechazo, asign, opcion } = politica.traza
      // Ronda actual y avance dentro de ella
      let r = R, fr = 1
      if (!terminado) {
        r = 1
        while (r < R && t >= inicio[r + 1]) r++
        const fin = r < R ? inicio[r + 1] : rondas.total
        fr = Math.min(1, (t - inicio[r]) / Math.max(0.01, fin - inicio[r]))
      }
      const faseA = !terminado && fr < 0.5
      fams.forEach((i, j) => {
        if (terminado) {
          if (asign[i] >= 0) { conColegio++; colorFam[j] = opcion[i] === 0 ? C.primera : C.otra; radioFam[j] = 2.6 }
          else { sinCupo++; colorFam[j] = C.sin; radioFam[j] = 3.6 }
          return
        }
        let o = -1
        for (let x = 0; x < k; x++) { const pr = rondaPropuesta[i * k + x]; if (pr && pr <= r) o = x }
        if (o < 0) { colorFam[j] = C.espera; radioFam[j] = 2.2; buscando++; return }
        const pr = rondaPropuesta[i * k + o], q = rondaRechazo[i * k + o]
        const rechazada = q !== 0 && (q < r || (q === r && !faseA))
        if (pr === r && faseA) {
          colorFam[j] = C.pidiendo; radioFam[j] = 2.6; buscando++
          lineas.push({ de: [f.lon[i], f.lat[i]], a: coordColegio(prefs[i * k + o]), color: [...C.pidiendo.slice(0, 3), Math.round(40 + 160 * (fr / 0.5))] as RGBA })
        } else if (rechazada) {
          if (o === k - 1) { sinCupo++; colorFam[j] = C.sin; radioFam[j] = 3.6 }
          else { buscando++; colorFam[j] = C.rechazo; radioFam[j] = 3.2 }
          if (q === r) lineas.push({ de: [f.lon[i], f.lat[i]], a: coordColegio(prefs[i * k + o]), color: [...C.rechazo.slice(0, 3), Math.round(220 * (1 - (fr - 0.5) * 2) + 30)] as RGBA })
        } else {
          conColegio++; colorFam[j] = o === 0 ? C.primera : C.otra; radioFam[j] = 2.6
          if (pr === r) lineas.push({ de: [f.lon[i], f.lat[i]], a: coordColegio(prefs[i * k + o]), color: [...C.primera.slice(0, 3), Math.round(170 * (1 - (fr - 0.5) * 2) + 20)] as RGBA })
        }
      })
      const nS = R + 2
      colegios.forEach((s) => {
        const antes = ocup[s * nS + (r - 1)]
        ocupado.set(s, terminado ? ocup[s * nS + R] : faseA ? antes + Math.round(props[s * nS + r] * suave(fr / 0.5)) : ocup[s * nS + r])
      })
      paso = terminado ? `Listo en ${R} rondas` : `Ronda ${r} de ${R}`
      texto = terminado
        ? '✓ Nadie puede mejorar su colegio sin quitarle el cupo a alguien con más prioridad: la asignación es estable.'
        : r === 1 && faseA ? 'Todas las familias piden, al mismo tiempo, su colegio favorito.'
          : r === 1 ? `Donde hay más solicitudes que cupos, el colegio se queda con las de más prioridad: ${preset.descripcion.toLowerCase()}.`
            : r === 2 ? 'Las rechazadas piden su siguiente opción. Si llega alguien con más prioridad, el colegio puede cambiar a quien tenía.'
              : `Las que siguen sin colegio piden su siguiente opción…`
    }
    return { colorFam, radioFam, lineas, ocupado, conColegio, buscando, sinCupo, llegaron, texto, paso }
  }, [fase, t, terminado, fams, colegios, hoy, politica, rondas, turnosPorColegio, prefs, k, f, localidad, duracion, preset])

  // --------------------------------------------------------------- cámara y capas
  // Encuadre donde viven las familias (percentiles 2–98): las zonas casi vacías no achican el mapa
  const encuadre = useMemo(() => {
    const xs = fams.map((i) => f.lon[i]).sort((a, b) => a - b)
    const ys = fams.map((i) => f.lat[i]).sort((a, b) => a - b)
    const q = (a: number[], p: number) => a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))]
    if (!xs.length) return datos.bboxLocalidad[localidad]
    return [[q(xs, 0.02), q(ys, 0.02)], [q(xs, 0.98), q(ys, 0.98)]] as [[number, number], [number, number]]
  }, [fams, f, datos, localidad])

  const viewState = useMemo(() => {
    const vp = new WebMercatorViewport({ width: Math.max(w, 50), height: Math.max(h, 50) })
      .fitBounds(encuadre, { padding: { top: Math.round(h * 0.24), bottom: Math.round(h * 0.13), left: 18, right: 18 } })
    return { longitude: vp.longitude, latitude: vp.latitude, zoom: vp.zoom, pitch: 0, bearing: 0,
      transitionDuration: 1100, transitionInterpolator: new FlyToInterpolator({ speed: 1.8 }) }
  }, [encuadre, w, h])

  const etiquetasUpz = useMemo(() => datos.upz.features.filter((x) => x.properties.localidad === localidad)
    .map((x) => ({ nombre: x.properties.nombre, pos: centroide(x.geometry) })), [datos, localidad])

  // Tamaños de puntos y textos en proporción al tamaño raíz (se ven igual en el celular y en el tótem)
  const e = useMemo(() => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1, [w, h])
  const radioColegio = (s: number) => e * (4 + 11 * Math.sqrt(Math.max(1, cap[s]) / capMax))
  const lleno = (s: number) => (cuadro.ocupado.get(s) ?? 0) >= cap[s]
  const exceso = (s: number) => (cuadro.ocupado.get(s) ?? 0) > cap[s]
  const marca = `${fase}-${t.toFixed(2)}-${terminado}`

  const capas = [
    new GeoJsonLayer<PropsUpz>({
      id: 'upz-proceso',
      data: datos.upz as any,
      filled: true, stroked: true,
      getFillColor: (x: Feature<PropsUpz>) => (x.properties.localidad === localidad ? [255, 255, 255, 255] : [228, 224, 214, 255]),
      getLineColor: (x: Feature<PropsUpz>) => (x.properties.localidad === localidad ? [20, 33, 61, 90] : [255, 255, 255, 255]),
      lineWidthUnits: 'pixels', getLineWidth: 1,
      updateTriggers: { getFillColor: [localidad], getLineColor: [localidad] },
    }),
    new TextLayer({
      id: 'upz-nombres', data: etiquetasUpz,
      getPosition: (e: any) => e.pos, getText: (e: any) => e.nombre,
      getSize: 10.5 * e, getColor: [74, 85, 113, 210], fontFamily: 'Public Sans Variable, sans-serif', fontWeight: 600,
      characterSet: 'auto',
    }),
    new LineLayer({
      id: 'solicitudes', data: cuadro.lineas,
      getSourcePosition: (l: any) => l.de, getTargetPosition: (l: any) => l.a, getColor: (l: any) => l.color,
      getWidth: 1.3 * e, widthUnits: 'pixels',
      updateTriggers: { getColor: [marca] },
    }),
    new ScatterplotLayer<number>({
      id: 'familias', data: fams.map((_, j) => j),
      getPosition: (j) => [f.lon[fams[j]], f.lat[fams[j]]],
      getFillColor: (j) => cuadro.colorFam[j], getRadius: (j) => cuadro.radioFam[j] * e,
      radiusUnits: 'pixels', stroked: true, getLineColor: [255, 255, 255, 200], lineWidthMinPixels: 0.5 * e,
      updateTriggers: { getFillColor: [marca, localidad], getRadius: [marca, localidad, e] },
    }),
    // Anillo de capacidad de cada colegio
    new ScatterplotLayer<number>({
      id: 'colegios-anillo', data: colegios,
      getPosition: coordColegio, getRadius: radioColegio, radiusUnits: 'pixels',
      filled: true, getFillColor: (s) => (s >= S ? [232, 240, 250, 255] : [255, 255, 255, 235]),
      stroked: true, lineWidthUnits: 'pixels',
      getLineWidth: (s) => e * (exceso(s) ? 3.2 : lleno(s) ? 2.6 : 1.6),
      getLineColor: (s) => (exceso(s) ? C.rechazo : s >= S ? [47, 111, 181, 255] : C.colegio),
      pickable: !!onTocarCandidato,
      updateTriggers: { getLineWidth: [marca, e], getLineColor: [marca], getRadius: [cap, e], getFillColor: [S] },
    }),
    // Cupos ocupados (crece hasta llenar el anillo)
    new ScatterplotLayer<number>({
      id: 'colegios-ocupacion', data: colegios,
      getPosition: coordColegio,
      getRadius: (s) => radioColegio(s) * Math.sqrt(Math.min(1, (cuadro.ocupado.get(s) ?? 0) / Math.max(1, cap[s]))),
      radiusUnits: 'pixels',
      getFillColor: (s) => (s >= S ? conAlfa(COLORES.azul, 230) : [20, 33, 61, 205]),
      updateTriggers: { getRadius: [marca, cap, e], getFillColor: [S] },
    }),
    ...(nuevo ? [new TextLayer({
      id: 'nuevo-etiqueta', data: [nuevo],
      getPosition: (c: any) => [c.lon, c.lat], getText: () => '+ colegio nuevo', getPixelOffset: [0, -24 * e],
      getSize: 13 * e, getColor: conAlfa(COLORES.azul, 255), fontFamily: 'Space Grotesk Variable, sans-serif', fontWeight: 700,
      background: true, getBackgroundColor: [255, 255, 255, 230], backgroundPadding: [4, 2],
    })] : []),
  ]

  const epf = f.estudiantes_por_familia
  return (
    <div ref={ref} className="mapa-proceso">
      <DeckGL initialViewState={viewState} controller={false} layers={capas}
              onClick={(info: PickingInfo) => { if (info.layer?.id === 'colegios-anillo' && typeof info.object === 'number' && info.object >= S) onTocarCandidato?.(politica.claveColegio ?? '') }} />
      <div className="proceso__texto" aria-live="polite">
        {cuadro.paso && <span className="proceso__paso">{cuadro.paso}</span>}
        <span>{cuadro.texto}</span>
        <span className="proceso__clave">◉ colegio: el relleno son los cupos ocupados · ● = {f.estudiantes_por_familia} niños</span>
      </div>
      <div className="proceso__contadores">
        {fase === 'llegada' && <span><b>{entero(cuadro.llegaron * epf)}</b> de {entero(fams.length * epf)} llegaron</span>}
        <span className="c-azul"><i />{entero(cuadro.conColegio * epf)} con colegio</span>
        {fase === 'diferida' && !terminado && <span className="c-gris"><i />{entero(cuadro.buscando * epf)} buscando</span>}
        <span className="c-naranja"><i />{entero(cuadro.sinCupo * epf)} sin cupo</span>
      </div>
    </div>
  )
}

const conAlfa = (c: [number, number, number], a: number): RGBA => [c[0], c[1], c[2], a]
