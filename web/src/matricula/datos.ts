/**
 * Datos de Matrícula+ (public/matricula/datos/), generados por `python -m engine.reparto_v2`. Solo
 * los lee esta sección: no comparte identificadores, capas ni cifras con Movilidad+.
 *
 * Regla: la interfaz no escribe cifras a mano. Todo número visible sale de resultados.json o de
 * puntos.json; si el modelo cambia, se vuelve a correr el motor y la interfaz queda al día.
 */

export type Nivel = 'Preescolar' | 'Primaria' | 'Secundaria' | 'Media'
export const NIVELES: Nivel[] = ['Preescolar', 'Primaria', 'Secundaria', 'Media']

/** Niños de un grupo y cuántos quedan lejos hoy (orden de llegada) y con Matrícula+ */
export interface Cifra { ninos: number; lejos_antes: number; lejos_despues: number; km_antes: number | null; km_despues: number | null }
export interface CifraLocalidad extends Cifra {
  cupos: number
  lejos_antes_por_nivel: Record<Nivel, number>
  lejos_despues_por_nivel: Record<Nivel, number>
  ninos_por_nivel: Record<Nivel, number>
}
/** Por qué siguen lejos: sin ningún cupo de su nivel cerca, o con los cupos cercanos ocupados */
export interface Explicacion {
  lejos: number; sin_cupo_de_su_nivel_a_2km: number; con_cupo_cerca_ocupado: number; con_cupo_libre_cerca: number
  ocupado_por_igual_o_mas_prioridad: number; km_promedio_ocupado: number | null
}
export type Grupo = 'bogota' | 'estrato_1' | 'vulnerables' | 'menores_10' | 'grandes' | 'medianos_10_13' | 'con_hermano'
  | 'vulnerables_menores_10' | 'vulnerables_grandes' | 'vulnerables_con_hermano_menores_10'

export interface Resultados {
  version: string
  radio_km: number
  ninos_por_grupo_simulado: number
  grupos: Record<Grupo, Cifra>
  por_nivel: Record<Nivel, Cifra>
  hermanos: {
    total: number; juntos_antes: number; juntos_despues: number; separados: number
    colegio_del_hermano_sin_su_nivel: number; colegio_del_hermano_lleno: number; separados_y_lejos: number
  }
  flujos: { lejos_a_cerca: number; siguen_lejos: number; cerca_a_lejos: number; cerca_a_lejos_estrato: Record<'1' | '2', number>; cerca_a_lejos_km_promedio: number }
  lejos_km: { promedio_antes: number; promedio_despues: number; max_antes: number; max_despues: number }
  por_que_siguen_lejos: Record<'todos' | 'vulnerables_menores_10' | 'vulnerables_con_hermano_menores_10' | 'vulnerables_grandes', Explicacion>
  en_sus_opciones_antes: number
  por_localidad: Record<string, CifraLocalidad>
  simulacion: {
    fuentes_publicas: number; registros_publicos: number; colegios_con_solicitudes_por_nivel: number; manzanas_residenciales: number; upz: number
    localidades: number; sedes_con_cupos_de_nuevos: number; grupos: number; ninos: number; nuevos_oficial: number
    distancias_calculadas: number; combinaciones_nino_colegio: number; calculos_realizados: number; restricciones: number; segundos: number
    por_nivel_ninos: Record<Nivel, number>; edades_por_nivel: Record<Nivel, [number, number]>
    puntos: { estrato_1: number; estrato_2: number; edad: number; hermano: number }
    pct_hermano: number; vecinos_hermano: number
  }
  desercion: {
    noveno_no_pasa_a_decimo_pct: number; media_se_gradua_pct: number; fuente_grado: string
    alerta_critica_estudiantes: number; alerta_critica_pct: number; cambio_residencia_pct: number; fuente_causas: string
    advertencia: string
  }
  priorizados_sed: string[]
  fuentes: { datos: { dato: string; fuente: string; corte: string; url: string }[]; verificacion: string[]; privacidad: string }
}

/** Grupos de 10 niños que quedan lejos hoy o con Matrícula+ (cada punto del mapa = 10 niños) */
export interface Puntos {
  lon: number[]; lat: number[]; nivel: number[]; estrato: number[]; edad: number[]
  lejos_antes: number[]; lejos_despues: number[]; localidad: number[]
  localidades: string[]; niveles: Nivel[]
}

export type Bbox = [[number, number], [number, number]]
/** Una localidad del croquis: sus anillos, dónde va el nombre y su encuadre */
export interface Croquis { nombre: string; anillos: [number, number][][]; etiqueta: [number, number]; bbox: Bbox }

export interface DatosMatricula {
  r: Resultados
  puntos: Puntos
  croquis: Croquis[]
  bboxCiudad: Bbox
}

interface LocalidadesGeo {
  features: { properties: { nombre: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } }[]
}

// true solo en el build "archivo" (un HTML que se abre con doble clic): ver vite.config.ts
declare const __EMBEBIDO__: boolean

async function leer<T>(nombre: string): Promise<T> {
  const r = await fetch(`./matricula/datos/${nombre}`)
  if (!r.ok) throw new Error(`No se pudo leer ${nombre} (${r.status})`)
  return r.json() as Promise<T>
}

function leerTodo(): Promise<[Resultados, Puntos, LocalidadesGeo]> {
  if (__EMBEBIDO__) {
    // Datos incrustados en el HTML (file:// no permite fetch). En el build normal este bloque se elimina.
    return Promise.all([
      import('../../public/matricula/datos/resultados.json?raw'),
      import('../../public/matricula/datos/puntos.json?raw'),
      import('../../public/matricula/datos/localidades.geojson?raw'),
    ]).then(([r, p, l]) => [JSON.parse(r.default), JSON.parse(p.default), JSON.parse(l.default)])
  }
  return Promise.all([leer<Resultados>('resultados.json'), leer<Puntos>('puntos.json'), leer<LocalidadesGeo>('localidades.geojson')])
}

function bboxDe(c: [number, number][]): Bbox {
  const xs = c.map((p) => p[0]), ys = c.map((p) => p[1])
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]]
}

function armarCroquis(geo: LocalidadesGeo, p: Puntos): Croquis[] {
  const mediana = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)]
  return geo.features.map(({ properties: { nombre }, geometry: g }) => {
    const anillos = (g.type === 'Polygon' ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]))
      .map((poligono) => poligono[0] as [number, number][])
    // El nombre va donde viven sus niños lejos; sin ellos, en el promedio del anillo más largo
    const l = p.localidades.indexOf(nombre)
    const mios = p.lon.map((_, i) => i).filter((i) => p.localidad[i] === l)
    const mayor = anillos.reduce((a, b) => (b.length > a.length ? b : a))
    const etiqueta: [number, number] = mios.length > 3
      ? [mediana(mios.map((i) => p.lon[i])), mediana(mios.map((i) => p.lat[i]))]
      : [mayor.reduce((t, c) => t + c[0], 0) / mayor.length, mayor.reduce((t, c) => t + c[1], 0) / mayor.length]
    return { nombre, anillos, etiqueta, bbox: bboxDe(anillos.flat()) }
  })
}

let promesa: Promise<DatosMatricula> | null = null

/** Carga una sola vez por sesión (volver a entrar no descarga de nuevo). */
export function cargarMatricula(): Promise<DatosMatricula> {
  promesa ??= leerTodo().then(([r, puntos, geo]) => {
      // La ciudad: donde viven los niños (Usme y Ciudad Bolívar tienen una gran parte rural al sur que
      // achicaría el mapa). Los encuadres de las localidades se recortan a ese mismo marco.
      const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.round(p * (a.length - 1))]
      const m = 0.012
      const ciudad: Bbox = [[q(puntos.lon, 0.005) - m, q(puntos.lat, 0.005) - m], [q(puntos.lon, 0.995) + m, q(puntos.lat, 0.995) + m]]
      const croquis = armarCroquis(geo, puntos).map((c) => ({
        ...c, bbox: [[Math.max(c.bbox[0][0], ciudad[0][0]), Math.max(c.bbox[0][1], ciudad[0][1])],
          [Math.min(c.bbox[1][0], ciudad[1][0]), Math.min(c.bbox[1][1], ciudad[1][1])]] as Bbox,
      }))
      return { r, puntos, croquis, bboxCiudad: ciudad }
    })
  promesa.catch(() => { promesa = null })
  return promesa
}

// --- Formato (es-CO) ---
const fmt = (d: number) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
const f0 = fmt(0), f1 = fmt(1)
export const entero = (n: number) => f0.format(Math.round(n))
/** Un decimal: "1,3" */
export const decimal = (n: number) => f1.format(n)
/** "73 %" */
export const pct = (parte: number, total: number) => `${f0.format(Math.round((100 * parte) / Math.max(1, total)))} %`
/** "1 de cada 8" */
export const unoDeCada = (parte: number, total: number) => `1 de cada ${f0.format(Math.round(total / Math.max(1, parte)))}`
/** "6 de cada 10" */
export const deCada10 = (parte: number, total: number) => `${f0.format(Math.round((10 * parte) / Math.max(1, total)))} de cada 10`
/** "Casi 6 de cada 10" cuando la fracción queda por debajo del entero redondeado */
export const casiDeCada10 = (parte: number, total: number) => {
  const x = (10 * parte) / Math.max(1, total)
  return `${x < Math.round(x) ? 'casi ' : ''}${f0.format(Math.round(x))} de cada 10`
}
/** 158.960 → "unos 159.000" */
export const redondo = (n: number) => `unos ${f0.format(Math.round(n / 1000) * 1000)}`
/** Millones con un decimal: "11,1 millones" */
export const millonesDe = (n: number) => `${f1.format(n / 1e6)} millones`
/** Localidades con niños que piden cupo (las que tienen datos), de más a menos niños lejos hoy */
export const localidadesOrdenadas = (r: Resultados) =>
  Object.entries(r.por_localidad).filter(([, v]) => v.ninos > 0).sort((a, b) => b[1].lejos_antes - a[1].lejos_antes).map(([n]) => n)
/** El nivel que más le falta a una localidad (por niños que siguen lejos con Matrícula+) */
export const nivelesQueFaltan = (c: CifraLocalidad) => NIVELES.filter((k) => c.lejos_despues_por_nivel[k] > 0)
  .sort((a, b) => c.lejos_despues_por_nivel[b] - c.lejos_despues_por_nivel[a])
