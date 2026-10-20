/**
 * Estado de la simulación: palancas de política, supuestos editables y las dos simulaciones
 * que se comparan (hoy y la política elegida). Todo corre en el navegador (~30 ms cada una).
 */
import { useMemo } from 'react'
import { metricas, porUpz, simular, type ColegioNuevo, type Metricas, type Pesos, type Simulacion, type Supuestos } from './motor'
import type { Datos } from './datos'

export interface Palancas {
  preset: string                 // clave de preset o 'personalizada'
  pesos: Pesos                   // pesos efectivos (del preset o personalizados)
  colegioNuevo: ColegioNuevo | null
  jornadaUnica: boolean
}

export const NIVELES_PESO = {
  cercania: [0, 0.5, 1, 2, 3],
  hermanos: [0, 1.5, 2.5, 5, 7.5],
  vulnerabilidad: [0, 0.75, 1.5, 3, 4.5],
}

export function palancasIniciales(d: Datos): Palancas {
  return { preset: 'equilibrada', pesos: d.indice.pesos_presets.equilibrada, colegioNuevo: null, jornadaUnica: false }
}

export function supuestosIniciales(d: Datos): Supuestos {
  const p = d.indice.parametros as Record<string, number>
  return {
    opciones: p.n_opciones, pctVulnerable: p.pct_vulnerable, pctHermano: p.pct_hermano,
    cuposColegioNuevo: p.cupos_colegio_nuevo, reduccionJornada: p.reduccion_jornada_unica,
    radioReubicacionKm: 3, umbralViajeLargoKm: 2, pesoDesempate: p.desempate_peso,
  }
}

export interface Resultados {
  hoy: Simulacion
  pol: Simulacion
  bogota: { hoy: Metricas; pol: Metricas }
  zona: { hoy: Metricas; pol: Metricas }
  upzHoy: Float64Array
  upzPol: Float64Array
}

export function useResultados(d: Datos | null, s: Supuestos | null, p: Palancas | null): Resultados | null {
  const hoy = useMemo(() => (d && s ? simular(d.familias, d, s, {
    mecanismo: 'llegada', pesos: d.indice.pesos_presets.equilibrada, colegioNuevo: null, jornadaUnica: false,
  }) : null), [d, s])
  const pol = useMemo(() => (d && s && p ? simular(d.familias, d, s, {
    mecanismo: 'diferida', pesos: p.pesos, colegioNuevo: p.colegioNuevo, jornadaUnica: p.jornadaUnica,
  }) : null), [d, s, p])
  return useMemo(() => {
    if (!d || !s || !hoy || !pol) return null
    const zonaSet = new Set(d.indice.zona_critica.map((z) => d.posUpz[z.codigo]))
    const enZona = (i: number) => zonaSet.has(d.familias.upz[i])
    const nU = d.indice.upz.length
    return {
      hoy, pol,
      bogota: { hoy: metricas(d.familias, hoy, s), pol: metricas(d.familias, pol, s) },
      zona: { hoy: metricas(d.familias, hoy, s, enZona), pol: metricas(d.familias, pol, s, enZona) },
      upzHoy: porUpz(d.familias, hoy, nU), upzPol: porUpz(d.familias, pol, nU),
    }
  }, [d, s, hoy, pol])
}

/** Métricas de las familias que viven en una localidad. */
export function metricasDe(d: Datos, r: Resultados, s: Supuestos, localidad: string) {
  const en = (i: number) => d.localidadDeUpz[d.familias.upz[i]] === localidad
  return { hoy: metricas(d.familias, r.hoy, s, en), pol: metricas(d.familias, r.pol, s, en) }
}

export function familiasDe(d: Datos, localidad: string): number[] {
  const out: number[] = []
  for (let i = 0; i < d.familias.n; i++) if (d.localidadDeUpz[d.familias.upz[i]] === localidad) out.push(i)
  return out
}

/** Nombre de un colegio (el nuevo va al final). */
export const nombreColegio = (d: Datos, s: number) => (s < d.familias.n_sedes ? d.nombresSedes[s] : 'Colegio nuevo')

/** Descripción corta de la política. */
export function describir(d: Datos, p: Palancas) {
  const preset = d.indice.presets.find((x) => x.clave === p.preset)
  const nuevo = p.colegioNuevo
    ? (d.indice.colegio_nuevo.find((c) => c.clave === p.colegioNuevo!.clave)?.etiqueta ?? 'un punto elegido en el mapa')
    : null
  return [
    `Prioridad ${preset ? preset.etiqueta.toLowerCase() : 'personalizada'}`,
    nuevo ? `colegio nuevo en ${nuevo}` : 'sin colegio nuevo',
    p.jornadaUnica ? 'con jornada única' : 'sin jornada única',
  ].join(' · ')
}
