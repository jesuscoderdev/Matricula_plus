/**
 * Datos precalculados por `python -m engine.build_scenarios` (public/simulador).
 * El navegador NO simula: solo busca el escenario de la combinación de palancas elegida.
 */

export type Nivel = 'bajo' | 'medio' | 'alto'
export type ClaveMetrica =
  | 'pct_primera_opcion' | 'pct_sin_cupo' | 'distancia_prom_km'
  | 'pct_vulnerables_sin_cupo' | 'pct_sin_cupo_zona_critica'

export interface Preset { clave: string; etiqueta: string; descripcion: string; escenario: string }
export interface UbicacionNueva {
  clave: string; etiqueta: string; proyecto: string; upz: string; upz_nombre: string
  localidad: string; lon: number; lat: number; cupos: number
}

export interface Indice {
  app: string
  generado: string
  fuente: 'real' | 'sintetica'
  metricas: ClaveMetrica[]
  presets: Preset[]
  colegio_nuevo: UbicacionNueva[]
  zona_critica: { codigo: string; nombre: string }[]
  upz: string[]
  base: Record<ClaveMetrica, number> & { estudiantes: number; sin_cupo: number }
  base_por_upz: number[]
  supuestos: Record<string, string>
  parametros: Record<string, unknown>
}

/** Escenario compacto: m = métricas en el orden de indice.metricas, s = estudiantes sin cupo, u = % sin cupo por UPZ */
export interface EscenarioCompacto { m: number[]; s: number; u: number[] }

export interface PropsUpz {
  codigo: string; nombre: string; localidad: string
  cupos: number; demanda: number; cupos_por_solicitud: number
  zona_critica: boolean; pct_sin_cupo_base: number
}
export interface PropsColegio {
  id: number; nombre: string; upz: string; localidad: string; cupos: number
  tipo: 'sede' | 'colegio_nuevo'; clave: string | null
}
export interface Feature<P, G = any> { type: 'Feature'; properties: P; geometry: G }
export interface FC<P, G = any> { type: 'FeatureCollection'; features: Feature<P, G>[] }

export type Bbox = [[number, number], [number, number]]

export interface Datos {
  indice: Indice
  escenarios: Record<string, EscenarioCompacto>
  upz: FC<PropsUpz>
  colegios: FC<PropsColegio, { type: 'Point'; coordinates: [number, number] }>
  bboxCiudad: Bbox
  bboxZonaCritica: Bbox
  posUpz: Record<string, number>          // código → posición en indice.upz
}

/** Palancas tal como las ve el visitante */
export interface Palancas {
  preset: string                 // clave de Preset
  colegioNuevo: string | null    // clave de UbicacionNueva o null
  jornadaUnica: boolean
}

export function idEscenario(d: Datos, p: Palancas): string {
  const pesos = d.indice.presets.find((x) => x.clave === p.preset)!.escenario
  return `${pesos}_${p.colegioNuevo ?? 'ninguno'}_${p.jornadaUnica ? 'ju' : 'sinju'}`
}

export interface Resultado {
  metricas: Record<ClaveMetrica, number>
  sinCupo: number
  porUpz: number[]
}

export function resultado(d: Datos, p: Palancas): Resultado {
  const e = d.escenarios[idEscenario(d, p)]
  const metricas = Object.fromEntries(d.indice.metricas.map((k, i) => [k, e.m[i]])) as Record<ClaveMetrica, number>
  return { metricas, sinCupo: e.s, porUpz: e.u }
}

export function resultadoBase(d: Datos): Resultado {
  const metricas = Object.fromEntries(d.indice.metricas.map((k) => [k, d.indice.base[k]])) as Record<ClaveMetrica, number>
  return { metricas, sinCupo: d.indice.base.sin_cupo, porUpz: d.indice.base_por_upz }
}

async function json<T>(ruta: string): Promise<T> {
  const r = await fetch(ruta)
  if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status}). ¿Corriste python -m engine.build_scenarios?`)
  return r.json()
}

function bboxDe(geoms: any[]): Bbox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const recorrer = (c: any) => {
    if (typeof c[0] === 'number') {
      x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]); x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1])
    } else c.forEach(recorrer)
  }
  geoms.forEach((g) => recorrer(g.coordinates))
  return [[x0, y0], [x1, y1]]
}

// true solo en el build "archivo" (un HTML que se abre con doble clic): ver vite.config.ts
declare const __EMBEBIDO__: boolean

type Crudos = [{ indice: Indice; escenarios: Record<string, EscenarioCompacto> }, FC<PropsUpz>,
  FC<PropsColegio, { type: 'Point'; coordinates: [number, number] }>]

async function leerCrudos(): Promise<Crudos> {
  if (__EMBEBIDO__) {
    // Datos incrustados en el HTML (file:// no permite fetch). En el build normal este bloque se elimina.
    const [t, u, c] = await Promise.all([
      import('../public/simulador/todos.json?raw'),
      import('../public/simulador/upz.geojson?raw'),
      import('../public/simulador/colegios.geojson?raw'),
    ])
    return [JSON.parse(t.default), JSON.parse(u.default), JSON.parse(c.default)]
  }
  return Promise.all([
    json<Crudos[0]>('./simulador/todos.json'),
    json<Crudos[1]>('./simulador/upz.geojson'),
    json<Crudos[2]>('./simulador/colegios.geojson'),
  ])
}

export async function cargarDatos(): Promise<Datos> {
  const [todos, upz, colegios] = await leerCrudos()
  const posUpz = Object.fromEntries(todos.indice.upz.map((c, i) => [c, i]))
  const zona = upz.features.filter((f) => f.properties.zona_critica)
  return {
    ...todos, upz, colegios, posUpz,
    bboxCiudad: bboxDe(upz.features.map((f) => f.geometry)),
    bboxZonaCritica: bboxDe(zona.map((f) => f.geometry)),
  }
}

// --- Formato de números (es-CO) ---
const fmtEntero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const fmtDecimal = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmtDos = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const entero = (n: number) => fmtEntero.format(Math.round(n))
export const decimal = (n: number) => fmtDecimal.format(n)
export const dosDecimales = (n: number) => fmtDos.format(n)
/** "+12" / "−3" con signo tipográfico */
export const conSigno = (n: number, f: (n: number) => string = entero) =>
  (n > 0 ? '+' : n < 0 ? '−' : '±') + f(Math.abs(n))
