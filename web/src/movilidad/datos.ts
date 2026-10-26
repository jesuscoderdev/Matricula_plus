/**
 * Datos de Movilidad+ (public/movilidad/datos/). Solo los lee esta sección: no comparte
 * identificadores, capas ni cifras con Matrícula+.
 *
 * Regla: la interfaz no escribe cifras a mano. Todo número visible sale de experiencia.json,
 * fuentes.json, resumen.json o sitios.geojson; si el modelo cambia, se reemplaza la carpeta
 * datos/ y la interfaz queda al día.
 */
import { compactar, type SitiosCompactos } from './compactar'

interface Comparacion { promete: number; ocurrio: number; sobrestimacion_pct: number }
interface ComparacionTop { regla_simple: Comparacion; metodo_proliferante: Comparacion; esquinas_en_comun: number }
export type Nivel = 'bajo' | 'medio' | 'alto'
export interface Escenario {
  presupuesto_millones: number
  esquinas: number
  se_esperaria_evitar_por_anio: number
  la_practica_intuitiva_prometeria: number
}

export interface Experiencia {
  version_modelo: string
  contexto_ciudad: {
    fallecidos_2025: number; lesionados_2025: number; fallecidos_2024_segun_anuario_2025: number
    variacion_fallecidos_2025_pct: number; peatones_aumento_muertes_2025_pct: number
    mayores_60_entre_peatones_fallecidos_pct: number; fuente: string
  }
  pantalla_1_usted_decide: {
    titulo_sugerido: string; instruccion: string; anio_mostrado: number; campo_a_mostrar: string
    hexagonos_con_graves_2024: { local: number; toda_la_red: number }
  }
  pantalla_2_pasa_un_anio: {
    titulo_sugerido: string
    referencia_30_peores_esquinas_de_barrio_2024: {
      graves_2024: number; graves_2025: number; esquinas_que_bajaron: number; de_un_total_de: number
      hexagonos: string[]; advertencia: string
    }
  }
  pantalla_3_el_giro: { texto_sugerido: string }
  pantalla_4_el_metodo: {
    titulo_sugerido: string; explicacion: string
    calles_de_barrio_30_sitios: ComparacionTop
    avenidas_30_sitios: ComparacionTop
    caida_general_2025_pct: number
    mensaje_clave: string
  }
  pantalla_presupuesto_barrio: {
    intervencion: string; reduccion_supuesta_pct: number; costo_por_esquina_millones: number
    escenarios: Record<Nivel, Escenario>
    como_decirlo: string
  }
  cierre: { texto_sugerido: string; accion: string }
  /** Con cada monto (barrio): esquinas, lo que se esperaría evitar con el método y lo que prometería una lista a ojo */
  presupuesto_curva: { costo_por_esquina_millones: number; esquinas_candidatas: number; puntos: PuntoCurva[] }
  /** Barrio y avenidas a la vez: la mejor combinación frente a todo en una sola clase de vía */
  presupuesto_reparto: {
    intervenciones: Record<'local' | 'arterial', string>
    costos_millones: Record<'local' | 'arterial', number>
    reducciones_pct: Record<'local' | 'arterial', number>
    filas: FilaReparto[]
    advertencia_costos: string
  }
  /** Una obra hipotética en las 30 peores esquinas de 2024: antes y después frente al método */
  evaluacion_obra: {
    esquinas: number; antes_2024: number; despues_2025: number
    esperado_sin_obra: number; esperado_sin_obra_con_tendencia: number; tendencia_ciudad_pct: number
    efecto_antes_despues_pct: number; efecto_con_metodo_pct: number; efecto_con_metodo_y_tendencia_pct: number
    nota: string
  }
  /** Por qué la caída de las peores esquinas no se explica por obras */
  pruebas_regresion_a_la_media: {
    un_anio_antes: { anio: number; graves_antes: number; graves_despues: number; bajaron: number; de: number }
    por_nivel_2024_2025: { graves_2024: string; hexagonos: number; promedio_2024: number; promedio_2025: number }[]
    sin_graves_en_2024: { hexagonos: number; con_alguno_en_2025: number; graves_en_2025: number }
    total_barrio_por_anio: Record<string, number>
  }
}

export interface PuntoCurva { presupuesto_millones: number; esquinas: number; metodo_esperado: number; a_ojo_promete: number; a_ojo_esperado: number }
export interface FilaReparto {
  presupuesto_millones: number
  mejor_combinacion: { esperado: number; esquinas_barrio: number; intersecciones_avenida: number; millones_barrio: number; millones_avenidas: number }
  todo_en_barrio: number
  todo_en_avenidas: number
  avenidas_compiten_si_cuestan_menos_de_millones: number
}

export interface Fuentes {
  titulo_sugerido: string
  fuentes: { dato: string; fuente: string; anio: string; url: string }[]
  cruces: string
  metodo_validacion: string
  advertencia: string
}

export interface Resumen {
  version: string
  periodo_estimacion: number[]
  anio_validacion: number
  unidad: string
  fuentes: Record<string, string>
  validacion_2025: Record<'local' | 'arterial', { graves_por_anio: Record<string, number>; tendencia_2025_vs_promedio: number }>
  /** Presupuesto: la mejor combinación de esquinas (mochila con riesgo corregido) frente a una lista por conteo bruto */
  asignacion_presupuesto?: Record<string, Record<string, Record<'optimo_mochila_eb' | 'lista_por_conteo_bruto', ListaPresupuesto>>>
}

export interface ListaPresupuesto {
  sitios: number
  promesa_evitados_anual: number
  esperado_evitados_anual_eb: number
}

export type Bbox = [[number, number], [number, number]]

export interface DatosMovilidad {
  experiencia: Experiencia
  fuentes: Fuentes
  resumen: Resumen
  sitios: SitiosCompactos
  /** posición de cada hexágono por su id */
  posId: Map<string, number>
  /** las peores esquinas de barrio de 2024 (posiciones) */
  peores: number[]
  /**
   * Orden de cada calle de barrio con algún siniestro en 2023–2024 según el riesgo corregido (0 = la de
   * más riesgo; −1 = no compite). Con un monto, alcanzan las primeras floor(monto / costo): es la misma
   * regla del modelo (todas cuestan lo mismo, así que la mejor combinación es la lista ordenada).
   */
  rangoBarrio: Int32Array
  /** encuadre de la ciudad (sin los extremos: Sumapaz queda fuera del cuadro inicial) */
  bboxCiudad: Bbox
  bboxLocalidad: Bbox[]
}

// true solo en el build "archivo" (un HTML que se abre con doble clic): ver vite.config.ts
declare const __EMBEBIDO__: boolean

async function json<T>(ruta: string): Promise<T> {
  const r = await fetch(ruta)
  if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status}).`)
  return r.json()
}
const DIR = './movilidad/datos/'

async function leer(): Promise<[Experiencia, Fuentes, Resumen, SitiosCompactos]> {
  if (__EMBEBIDO__) {
    // Incrustados en el HTML (file:// no permite fetch); el build normal deja este módulo vacío
    const m = (await import('virtual:movilidad-embebido')).default as unknown as [Experiencia, Fuentes, Resumen, SitiosCompactos]
    return m
  }
  const [experiencia, fuentes, resumen] = await Promise.all([
    json<Experiencia>(DIR + 'experiencia.json'), json<Fuentes>(DIR + 'fuentes.json'), json<Resumen>(DIR + 'resumen.json'),
  ])
  // El build genera un derivado compacto; si no está o es de otra versión del modelo (alguien
  // reemplazó datos/), se lee el geojson original y se compacta aquí
  let sitios: SitiosCompactos | null = null
  try {
    const c = await json<SitiosCompactos>(DIR + 'sitios.compacto.json')
    if (c.version === experiencia.version_modelo && c.n > 0) sitios = c
  } catch { /* sin derivado: geojson */ }
  sitios ??= compactar(await json(DIR + 'sitios.geojson'), experiencia.version_modelo)
  return [experiencia, fuentes, resumen, sitios]
}

/** Encuadre con cuantiles (deja fuera los hexágonos sueltos de los bordes). */
function bboxDe(s: SitiosCompactos, idx: number[], q = 0.01): Bbox {
  const xs = idx.map((i) => s.lon[i]).sort((a, b) => a - b)
  const ys = idx.map((i) => s.lat[i]).sort((a, b) => a - b)
  const c = (a: number[], p: number) => a[Math.round(p * (a.length - 1))]
  return [[c(xs, q), c(ys, q)], [c(xs, 1 - q), c(ys, 1 - q)]]
}

let promesa: Promise<DatosMovilidad> | null = null

/** Carga una sola vez por sesión (volver a entrar no descarga de nuevo). */
export function cargarMovilidad(): Promise<DatosMovilidad> {
  promesa ??= leer().then(([experiencia, fuentes, resumen, sitios]) => {
    const posId = new Map(sitios.id.map((x, i) => [x, i]))
    const peores = experiencia.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.hexagonos
      .map((h) => posId.get(h)).filter((x): x is number => x != null)
    const todos = sitios.id.map((_, i) => i)
    const bboxLocalidad = sitios.localidades.map((_, l) => bboxDe(sitios, todos.filter((i) => sitios.loc[i] === l), 0))
    const rangoBarrio = new Int32Array(sitios.n).fill(-1)
    todos.filter((i) => sitios.local[i] === 1 && sitios.k23[i] + sitios.k24[i] > 0)
      .sort((a, b) => sitios.kappa[b] - sitios.kappa[a] || (sitios.id[a] < sitios.id[b] ? -1 : 1))
      .forEach((i, r) => { rangoBarrio[i] = r })
    return { experiencia, fuentes, resumen, sitios, posId, peores, rangoBarrio, bboxCiudad: bboxDe(sitios, todos), bboxLocalidad }
  })
  promesa.catch(() => { promesa = null })
  return promesa
}

// --- Formato (es-CO) ---
const fmt = (d: number) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
const f0 = fmt(0), f1 = fmt(1)
export const entero = (n: number) => f0.format(Math.round(n))
/** Porcentaje con signo: "+59 %", "−10,8 %" (decimales solo si los trae el dato) */
export const pct = (n: number, conSigno = true) => {
  const t = Number.isInteger(n) ? f0.format(Math.abs(n)) : f1.format(Math.abs(n))
  return `${conSigno ? (n > 0 ? '+' : n < 0 ? '−' : '') : ''}${t} %`
}
export const pctFraccion = (x: number) => pct(Math.round(x * 1000) / 10)
/** "$1.000 millones" */
export const millones = (n: number) => `$${f0.format(n)} millones`
/** Cuántas esquinas de barrio alcanzan con un monto */
export const esquinasCon = (d: DatosMovilidad, monto: number) => Math.floor(monto / d.experiencia.presupuesto_curva.costo_por_esquina_millones)
/** "BOSA" → "Bosa", "LOS MÁRTIRES" → "Los Mártires" */
export const nombreLocalidad = (l: string) => l.toLocaleLowerCase('es').replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('es'))
