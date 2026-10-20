/**
 * Tipos y carga de los JSON precalculados por el pipeline (public/data).
 * Nada se simula en el navegador: solo se leen y se cruzan los resultados.
 */

export type Estado = 'deficit' | 'superavit' | 'equilibrio'

export interface Kpi {
  estudiantes: number
  asignados: number
  sin_cupo: number
  pct_sin_cupo: number
  pct_primera_opcion: number
  pct_top3: number
  tiempo_prom_min: number | null
  distancia_prom_km: number | null
  viajes_largos: number
  pct_viajes_largos: number
  cupos: number
  ocupados: number
  cupos_ociosos: number
}

export interface Muestra {
  lon: number[]
  lat: number[]
  upz: string[]
  categoria: string[]
  sede: number[]        // −1 = sin cupo
  tiempo_min: number[]
  opcion: number[]      // 0 = fuera de lista o sin cupo
}

export interface Escenario {
  escenario: 'hoy' | 'matricula'
  titulo: string
  kpis: { global: Kpi; por_localidad: Record<string, Kpi>; por_upz: Record<string, Kpi> }
  muestra: Muestra
}

export interface Colegio {
  id: number
  dane: string
  nombre: string
  localidad: string
  upz: string
  lon: number
  lat: number
  cupos: number
  calidad: number
  ocupados_hoy: number
  ocupados_matricula: number
}

export interface PropsUpz {
  codigo: string
  nombre: string
  localidad: string
  demanda: number
  oferta: number
  balance: number
  balance_pct: number
  estado: Estado
  n_sedes: number
  sin_cupo_hoy: number
  sin_cupo_matricula: number
  tiempo_hoy: number | null
  tiempo_matricula: number | null
}

export interface PropsLocalidad {
  codigo: string
  nombre: string
  demanda: number
  oferta: number
  balance: number
  balance_pct: number
  estado: Estado
}

export interface Feature<P> {
  type: 'Feature'
  properties: P
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any }
}
export interface FC<P> {
  type: 'FeatureCollection'
  features: Feature<P>[]
}

export interface ResumenLocalidad {
  localidad: string
  estado: Estado
  demanda: number
  oferta: number
  balance: number
  hoy: Kpi
  matricula: Kpi
}

export interface Resumen {
  app: string
  generado: string
  fuente: 'sintetica' | 'real'
  nota: string
  factor_expansion_muestra: number
  /** solicitudes reales por estudiante simulado: los conteos ya vienen expandidos */
  escala_real: number
  totales: { estudiantes: number; muestra_simulada: number; sedes: number; cupos: number; upz: number; localidades: number; priorizados: number }
  hoy: Kpi
  matricula: Kpi
  delta: Record<'sin_cupo' | 'pct_primera_opcion' | 'pct_top3' | 'tiempo_prom_min' | 'viajes_largos' | 'cupos_ociosos', number>
  localidad_foco: string
  localidad_mayor_superavit: string
  localidades: ResumenLocalidad[]
  upz_mayor_deficit: { codigo: string; nombre: string; localidad: string; balance: number }[]
  supuestos: Record<string, unknown>
}

export type Bbox = [[number, number], [number, number]]

export interface Datos {
  resumen: Resumen
  upz: FC<PropsUpz>
  localidades: FC<PropsLocalidad>
  colegios: Colegio[]
  hoy: Escenario
  matricula: Escenario
  // Derivados
  localidadDeUpz: Record<string, string>
  bboxLocalidad: Record<string, Bbox>
  bboxCiudad: Bbox
  /** localidad de residencia de cada estudiante de la muestra */
  localidadMuestra: string[]
}

async function json<T>(nombre: string): Promise<T> {
  const r = await fetch(`./data/${nombre}`)
  if (!r.ok) throw new Error(`No se pudo cargar ${nombre} (${r.status}). ¿Corriste python pipeline/run.py?`)
  return r.json()
}

/** Caja envolvente de cualquier geometría (Polygon / MultiPolygon). */
function bboxDe(geoms: Feature<unknown>['geometry'][]): Bbox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const recorrer = (c: any) => {
    if (typeof c[0] === 'number') {
      x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]); x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1])
    } else c.forEach(recorrer)
  }
  geoms.forEach((g) => recorrer(g.coordinates))
  return [[x0, y0], [x1, y1]]
}

export async function cargarDatos(): Promise<Datos> {
  const [resumen, upz, localidades, colegios, hoy, matricula] = await Promise.all([
    json<Resumen>('resumen.json'),
    json<FC<PropsUpz>>('upz.geojson'),
    json<FC<PropsLocalidad>>('localidades.geojson'),
    json<Colegio[]>('colegios.json'),
    json<Escenario>('escenario_hoy.json'),
    json<Escenario>('escenario_matricula.json'),
  ])
  const localidadDeUpz: Record<string, string> = {}
  upz.features.forEach((f) => (localidadDeUpz[f.properties.codigo] = f.properties.localidad))
  const bboxLocalidad: Record<string, Bbox> = {}
  localidades.features.forEach((f) => (bboxLocalidad[f.properties.nombre] = bboxDe([f.geometry])))
  return {
    resumen, upz, localidades, colegios, hoy, matricula,
    localidadDeUpz,
    bboxLocalidad,
    bboxCiudad: bboxDe(localidades.features.map((f) => f.geometry)),
    localidadMuestra: hoy.muestra.upz.map((u) => localidadDeUpz[u]),
  }
}

// --- Formato de números (es-CO) ---
const fmtEntero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const fmtDecimal = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const entero = (n: number) => fmtEntero.format(Math.round(n))
export const decimal = (n: number) => fmtDecimal.format(n)
/** "+12" / "−3" con signo tipográfico */
export const conSigno = (n: number, f: (n: number) => string = entero) =>
  (n > 0 ? '+' : n < 0 ? '−' : '±') + f(Math.abs(n))
