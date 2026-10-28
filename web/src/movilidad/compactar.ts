/**
 * Movilidad+: convierte sitios.geojson (un polígono por hexágono de 115 m) en columnas compactas:
 * el centro de cada hexágono y una sola "forma" (los 6 vértices relativos al centro, iguales en
 * todos). Así pesa ~10 veces menos y se dibuja igual.
 *
 * Lo usan el navegador (si no hay derivado) y el build (vite.config.ts), que genera
 * movilidad/datos/sitios.compacto.json y lo incrusta en el HTML de doble clic. No escribe
 * ninguna cifra: todo sale del archivo.
 */

export interface SitiosCompactos {
  /** versión del modelo (de experiencia.json) con que se generó; si no coincide, se usa el geojson */
  version: string | null
  n: number
  id: string[]
  lon: number[]
  lat: number[]
  /** vértices del hexágono relativos al centro [dlon, dlat] */
  forma: [number, number][]
  /** 1 = calle de barrio (zona_vial "local"), 0 = avenida (arterial) */
  local: number[]
  /** posición en `localidades` */
  loc: number[]
  localidades: string[]
  k23: number[]
  k24: number[]
  k25: number[]
  bruto: number[]
  kappa: number[]
  icInf: number[]
  icSup: number[]
  /** peso de las esquinas parecidas en el riesgo corregido (Bayes empírico) */
  alpha: number[]
  /** posición en `grupos` (el grupo de esquinas parecidas, como en resumen.grupos_referencia) */
  grupo: number[]
  grupos: string[]
  /** esquinas elegidas por el escenario de barrio: bit 1 = bajo, 2 = medio, 4 = alto */
  sel: number[]
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6
const r4 = (x: number) => Math.round(x * 1e4) / 1e4

export function compactar(geo: { features: { properties: Record<string, any>; geometry: { coordinates: number[][][] } }[] }, version: string | null = null): SitiosCompactos {
  const F = geo.features
  const localidades = [...new Set(F.map((f) => String(f.properties.localidad)))].sort((a, b) => a.localeCompare(b, 'es'))
  const posLoc = new Map(localidades.map((l, i) => [l, i]))
  const grupos = [...new Set(F.map((f) => String(f.properties.grupo)))].sort()
  const posGrupo = new Map(grupos.map((g, i) => [g, i]))
  const s: SitiosCompactos = {
    version, n: F.length, id: [], lon: [], lat: [], forma: [], local: [], loc: [], localidades,
    k23: [], k24: [], k25: [], bruto: [], kappa: [], icInf: [], icSup: [], alpha: [], grupo: [], grupos, sel: [],
  }
  // Forma media: promedio de los vértices relativos al centro (los hexágonos son regulares)
  const suma: [number, number][] = []
  let nForma = 0
  for (const f of F) {
    const p = f.properties
    const anillo = f.geometry.coordinates[0].slice(0, 6)
    let cx = 0, cy = 0
    for (const [x, y] of anillo) { cx += x; cy += y }
    cx /= anillo.length; cy /= anillo.length
    if (anillo.length === 6) {
      anillo.forEach(([x, y], j) => { suma[j] = suma[j] ?? [0, 0]; suma[j][0] += x - cx; suma[j][1] += y - cy })
      nForma++
    }
    s.id.push(String(p.hex_115m)); s.lon.push(r6(cx)); s.lat.push(r6(cy))
    s.local.push(p.zona_vial === 'local' ? 1 : 0); s.loc.push(posLoc.get(String(p.localidad))!)
    s.k23.push(p.k_2023); s.k24.push(p.k_2024); s.k25.push(p.k_2025)
    s.bruto.push(r4(p.bruto_anual)); s.kappa.push(r4(p.kappa_anual)); s.icInf.push(r4(p.ic_inf_anual)); s.icSup.push(r4(p.ic_sup_anual))
    s.alpha.push(r4(p.alpha)); s.grupo.push(posGrupo.get(String(p.grupo))!)
    s.sel.push((p.sel_barrio_bajo ? 1 : 0) | (p.sel_barrio_medio ? 2 : 0) | (p.sel_barrio_alto ? 4 : 0))
  }
  s.forma = suma.map(([x, y]) => [x / Math.max(1, nForma), y / Math.max(1, nForma)].map((v) => Math.round(v * 1e7) / 1e7) as [number, number])
  return s
}
