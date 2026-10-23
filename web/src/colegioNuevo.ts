/**
 * Colegio nuevo según la localidad que el visitante eligió en Problema.
 *
 * Para esa localidad se ofrecen:
 *  · los proyectos reales de la SED que le ayudan (en la localidad o cerca), ordenados por cuántos
 *    niños de la localidad entran gracias a ellos a alguno de los colegios que pidieron;
 *  · «el mejor lugar en {localidad}»: el motor prueba el centro de la demanda de cada UPZ de la
 *    localidad y elige donde más niños de la localidad entran a sus colegios. Es una SUGERENCIA de
 *    la simulación, no un lote real.
 * Sin localidad, los proyectos de la SED se ordenan por su efecto en Bogotá.
 *
 * El efecto se mide con la misma simulación de Matrícula+ (asignación diferida + optimización de
 * cupos), con las reglas y supuestos que el visitante tiene en ese momento: niños de la localidad
 * fuera de sus opciones sin colegio nuevo, menos los que quedan con él.
 */
import { useEffect, useState } from 'react'
import { metricas, simular, type ColegioNuevo, type Pesos, type Supuestos } from './motor'
import type { Datos } from './datos'

export interface OpcionColegio {
  colegio: ColegioNuevo
  etiqueta: string
  /** proyecto real de la SED (true) o lugar sugerido por la simulación (false) */
  real: boolean
  /** niños (de la localidad, o de Bogotá sin localidad) que entran a sus opciones gracias a él */
  ninos: number
}

const MIN_FAMILIAS_UPZ = 10    // UPZ con muy pocas familias no se prueban
const MAX_PROYECTOS = 3

/**
 * Los pasos del cálculo, uno por simulación (~40 ms cada una), para poder repartirlos en el tiempo
 * sin congelar la pantalla. `calcularOpciones` los corre de una vez.
 */
function* pasos(d: Datos, s: Supuestos, pesos: Pesos, jornadaUnica: boolean, localidad: string | null): Generator<void, OpcionColegio[]> {
  const f = d.familias
  const incluir = localidad ? (i: number) => d.localidadDeUpz[f.upz[i]] === localidad : () => true
  const fuera = (colegioNuevo: ColegioNuevo | null) =>
    metricas(f, simular(f, d, s, { mecanismo: 'diferida', pesos, colegioNuevo, jornadaUnica }), s, incluir).fueraDeOpciones
  const base = fuera(null)
  yield
  const proyectos: OpcionColegio[] = []
  for (const u of d.indice.colegio_nuevo) {
    const colegio = { clave: u.clave, lon: u.lon, lat: u.lat }
    proyectos.push({ colegio, etiqueta: u.etiqueta, real: true, ninos: Math.max(0, base - fuera(colegio)) })
    yield
  }
  proyectos.sort((a, b) => b.ninos - a.ninos)
  if (!localidad) return proyectos
  // Proyectos de la SED: los de la localidad y los de afuera que le ayudan
  const utiles = proyectos.filter((p) => p.ninos > 0 || d.indice.colegio_nuevo.find((u) => u.clave === p.colegio.clave)?.localidad === localidad)
  // El mejor lugar: el centro de la demanda de cada UPZ de la localidad
  const nU = d.indice.upz.length
  const sx = new Float64Array(nU), sy = new Float64Array(nU), n = new Int32Array(nU)
  for (let i = 0; i < f.n; i++) if (incluir(i)) { sx[f.upz[i]] += f.lon[i]; sy[f.upz[i]] += f.lat[i]; n[f.upz[i]]++ }
  let mejor: OpcionColegio | null = null
  for (let u = 0; u < nU; u++) {
    if (n[u] < MIN_FAMILIAS_UPZ) continue
    const colegio = { clave: null, lon: sx[u] / n[u], lat: sy[u] / n[u] }
    const ninos = Math.max(0, base - fuera(colegio))
    const nombre = d.upz.features.find((x) => x.properties.codigo === d.indice.upz[u])?.properties.nombre ?? ''
    if (!mejor || ninos > mejor.ninos) mejor = { colegio: { ...colegio, etiqueta: `Mejor lugar en ${localidad}` }, etiqueta: `Mejor lugar en ${localidad} (UPZ ${nombre})`, real: false, ninos }
    yield
  }
  const lista = utiles.slice(0, MAX_PROYECTOS)
  return mejor && (!lista.length || mejor.ninos > lista[0].ninos * 1.02) ? [mejor, ...lista] : [...lista, ...(mejor ? [mejor] : [])]
}

/** Calcula las opciones de una vez (lo usa Proli cuando pide «el colegio donde más rinde»). */
export function calcularOpciones(d: Datos, s: Supuestos, pesos: Pesos, jornadaUnica: boolean, localidad: string | null): OpcionColegio[] {
  const g = pasos(d, s, pesos, jornadaUnica, localidad)
  let r = g.next()
  while (!r.done) r = g.next()
  return r.value
}

const cache = new Map<string, OpcionColegio[]>()
const claveCache = (s: Supuestos, pesos: Pesos, jornadaUnica: boolean, localidad: string | null) =>
  JSON.stringify([s, pesos, jornadaUnica, localidad])

/**
 * Las opciones de colegio nuevo para la pantalla: se calculan de a una simulación por vez (la
 * pantalla sigue respondiendo) y se guardan; mientras tanto devuelve null.
 */
export function useOpcionesColegio(d: Datos, s: Supuestos, pesos: Pesos, jornadaUnica: boolean, localidad: string | null) {
  const clave = claveCache(s, pesos, jornadaUnica, localidad)
  const [opciones, setOpciones] = useState<OpcionColegio[] | null>(() => cache.get(clave) ?? null)
  useEffect(() => {
    const guardadas = cache.get(clave)
    if (guardadas) { setOpciones(guardadas); return }
    setOpciones(null)
    const g = pasos(d, s, pesos, jornadaUnica, localidad)
    let id = 0
    const seguir = () => {
      const r = g.next()
      if (r.done) { cache.set(clave, r.value); setOpciones(r.value); return }
      id = window.setTimeout(seguir, 0)
    }
    id = window.setTimeout(seguir, 30)
    return () => window.clearTimeout(id)
  }, [clave])  // eslint-disable-line react-hooks/exhaustive-deps
  return opciones
}

/** Guarda en caché un resultado calculado de una vez (para que la pantalla no lo recalcule). */
export function recordarOpciones(s: Supuestos, pesos: Pesos, jornadaUnica: boolean, localidad: string | null, o: OpcionColegio[]) {
  cache.set(claveCache(s, pesos, jornadaUnica, localidad), o)
}
