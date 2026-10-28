/**
 * Las cifras de las pantallas de Movilidad+, calculadas en el navegador con los mismos datos del
 * sitio (sitios, experiencia, resumen). Ninguna va escrita a mano.
 *
 * Tres formas de escoger esquinas de barrio con datos hasta 2024, verificadas con 2025:
 *  · contar solo 2024   — las de más siniestros graves en 2024; espera que se repita 2024
 *  · contar 2023 y 2024 — las de más siniestros en los dos años; espera el promedio anual
 *  · modelo             — las de mayor riesgo corregido (Bayes empírico); espera ese riesgo
 * Los empates se rompen como en el modelo (pipeline_modelo.py): el año más reciente y luego el id
 * de la zona. Así las cifras coinciden con las publicadas (resumen.json). No se afirma cuál forma
 * usa hoy Bogotá: no está publicado.
 *
 * El mensaje tiene dos patas: el modelo cambia qué esquinas se escogen frente a mirar solo el último
 * año (`cambios`), y espera lo que de verdad pasa (`espera` frente a `hubo`). Frente a contar los dos
 * años escoge casi lo mismo: ahí su valor es la promesa.
 */
import type { DatosMovilidad } from './datos'

export type Forma = 'contar1' | 'contar2' | 'modelo'
export const FORMAS: Forma[] = ['contar1', 'contar2', 'modelo']

export interface Lista { lista: number[]; espera: number; hubo: number; comun: number }
export interface Comparacion { esquinas: number; contar1: Lista; contar2: Lista; modelo: Lista }
/** Siniestros graves por año de un grupo de esquinas */
export interface Anios { n: number; k23: number; k24: number; k25: number }
/** Las esquinas que salen (las escoge contar solo 2024, no el modelo) y las que entran (al revés) */
export interface Cambio { salen: Anios; entran: Anios }
export interface FilaLocalidad { loc: number; esquinas: Record<Forma, number>; espera: Record<Forma, number>; hubo: Record<Forma, number> }

export interface Guion {
  barrio: number[]
  conGraves: number
  comparacion30: Comparacion
  comparacionPresupuesto: Comparacion
  cambios30: Cambio
  cambiosPresupuesto: Cambio
  /** las esquinas de «¿Cuáles 3 arreglarías tú?» (las primeras de «contar solo 2024») */
  tabla: number[]
  /** de las 30 de contar solo 2024, cuántas bajaron en 2025 */
  bajaron: number
  /** la esquina con más siniestros en 2024: el ejemplo de la animación */
  ejemplo: number
  porLocalidad: FilaLocalidad[]
}

const ESQUINAS_TABLA = 12

let cache: { datos: DatosMovilidad; guion: Guion } | null = null

export function guionDe(d: DatosMovilidad): Guion {
  if (cache?.datos === d) return cache.guion
  const s = d.sitios
  const barrio = s.id.map((_, i) => i).filter((i) => s.local[i] === 1)
  const porId = (a: number, b: number) => (s.id[a] < s.id[b] ? -1 : s.id[a] > s.id[b] ? 1 : 0)
  const orden: Record<Forma, number[]> = {
    contar1: [...barrio].sort((a, b) => s.k24[b] - s.k24[a] || s.k23[b] - s.k23[a] || porId(a, b)),
    contar2: [...barrio].sort((a, b) => (s.k23[b] + s.k24[b]) - (s.k23[a] + s.k24[a]) || s.k24[b] - s.k24[a] || porId(a, b)),
    modelo: [...barrio].sort((a, b) => s.kappa[b] - s.kappa[a] || porId(a, b)),
  }
  // Lo que espera cada forma de una esquina, por año
  const espera: Record<Forma, (i: number) => number> = {
    contar1: (i) => s.k24[i],
    contar2: (i) => (s.k23[i] + s.k24[i]) / 2,
    modelo: (i) => s.kappa[i],
  }
  const suma = (l: number[], f: (i: number) => number) => l.reduce((t, i) => t + f(i), 0)
  const comparar = (n: number): Comparacion => {
    const enModelo = new Set(orden.modelo.slice(0, n))
    const lista = (f: Forma): Lista => {
      const l = orden[f].slice(0, n)
      return { lista: l, espera: suma(l, espera[f]), hubo: suma(l, (i) => s.k25[i]), comun: l.filter((i) => enModelo.has(i)).length }
    }
    return { esquinas: n, contar1: lista('contar1'), contar2: lista('contar2'), modelo: lista('modelo') }
  }
  const anios = (l: number[]): Anios => ({ n: l.length, k23: suma(l, (i) => s.k23[i]), k24: suma(l, (i) => s.k24[i]), k25: suma(l, (i) => s.k25[i]) })
  const cambio = (c: Comparacion): Cambio => {
    const uno = new Set(c.contar1.lista), modelo = new Set(c.modelo.lista)
    return { salen: anios(c.contar1.lista.filter((i) => !modelo.has(i))), entran: anios(c.modelo.lista.filter((i) => !uno.has(i))) }
  }
  const c30 = comparar(d.experiencia.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.de_un_total_de)
  const cP = comparar(d.experiencia.pantalla_presupuesto_barrio.escenarios.bajo.esquinas)

  // Por localidad, con el primer presupuesto: cuántas esquinas le tocan con cada forma, y qué esperaba y qué hubo
  const filas = new Map<number, FilaLocalidad>()
  const cero = (): Record<Forma, number> => ({ contar1: 0, contar2: 0, modelo: 0 })
  for (const f of FORMAS) {
    for (const i of cP[f].lista) {
      const fila = filas.get(s.loc[i]) ?? filas.set(s.loc[i], { loc: s.loc[i], esquinas: cero(), espera: cero(), hubo: cero() }).get(s.loc[i])!
      fila.esquinas[f]++; fila.espera[f] += espera[f](i); fila.hubo[f] += s.k25[i]
    }
  }
  const porLocalidad = [...filas.values()].sort((a, b) => b.esquinas.modelo - a.esquinas.modelo || b.esquinas.contar2 - a.esquinas.contar2)

  const guion: Guion = {
    barrio,
    conGraves: barrio.filter((i) => s.k24[i] > 0).length,
    comparacion30: c30,
    comparacionPresupuesto: cP,
    cambios30: cambio(c30),
    cambiosPresupuesto: cambio(cP),
    tabla: orden.contar1.slice(0, ESQUINAS_TABLA),
    bajaron: c30.contar1.lista.filter((i) => s.k25[i] < s.k24[i]).length,
    ejemplo: orden.contar1[0],
    porLocalidad,
  }
  cache = { datos: d, guion }
  return guion
}

/** Las esquinas parecidas a la del índice: cuántas son y su promedio de siniestros graves al año */
export function parecidas(d: DatosMovilidad, i: number): { sitios: number; porAnio: number } {
  const g = d.resumen.grupos_referencia[d.sitios.grupos[d.sitios.grupo[i]]]
  return { sitios: g.sitios, porAnio: g.media_K / d.resumen.periodo_estimacion.length }
}
