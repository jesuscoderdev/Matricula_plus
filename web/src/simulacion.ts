/**
 * Corre el motor en el navegador para animar el proceso:
 *  - "hoy": orden de llegada sin palancas (la línea base)
 *  - "política": asignación diferida por rondas con las palancas elegidas
 * Ambos se recalculan en ~10 ms; se memorizan por combinación de palancas.
 */
import { useMemo } from 'react'
import { capacidades, claves, diferidaPorRondas, metricas, ordenLlegada, preferencias,
  type Llegada, type MetricasGrupo, type Preferencias, type Traza } from './motor'
import type { Datos, Palancas } from './datos'

export interface SimHoy { pref: Preferencias; cap: Int32Array; llegada: Llegada }
export interface SimPolitica { pref: Preferencias; cap: Int32Array; traza: Traza; claveColegio: string | null }

export function useSimHoy(d: Datos | null): SimHoy | null {
  return useMemo(() => {
    if (!d) return null
    const par = d.indice.parametros as Record<string, number>
    const pref = preferencias(d.familias, null)
    const cap = capacidades(d.cuposSedes, null, false, par.reduccion_jornada_unica, par.estudiantes_por_familia)
    return { pref, cap, llegada: ordenLlegada(pref.prefs, cap, d.familias.llegada, d.familias.n, d.familias.opciones) }
  }, [d])
}

export function useSimPolitica(d: Datos | null, p: Palancas): SimPolitica | null {
  return useMemo(() => {
    if (!d) return null
    const par = d.indice.parametros as Record<string, number>
    const f = d.familias
    const pref = preferencias(f, p.colegioNuevo)
    const cap = capacidades(d.cuposSedes, p.colegioNuevo ? par.cupos_colegio_nuevo : null, p.jornadaUnica,
      par.reduccion_jornada_unica, par.estudiantes_por_familia)
    const cl = claves(f, pref, d.indice.pesos_presets[p.preset], par.desempate_peso)
    return { pref, cap, traza: diferidaPorRondas(pref.prefs, cl, cap, f.n, f.opciones), claveColegio: p.colegioNuevo }
  }, [d, p.preset, p.colegioNuevo, p.jornadaUnica])
}

/** Familias que viven en una localidad. */
export function familiasDe(d: Datos, localidad: string): number[] {
  const out: number[] = []
  const f = d.familias
  for (let i = 0; i < f.n; i++) if (d.localidadDeUpz[f.upz[i]] === localidad) out.push(i)
  return out
}

export function metricasLocalidad(d: Datos, pref: Preferencias, asign: Int32Array, opcion: Int8Array,
                                  localidad: string): MetricasGrupo {
  return metricas(d.familias, pref, asign, opcion, (i) => d.localidadDeUpz[d.familias.upz[i]] === localidad)
}
