/**
 * Motor de asignación en el navegador (v2).
 *
 * Corre TODO el modelo en vivo, así los supuestos se pueden editar y el proceso se puede animar:
 *  1. Listas de preferencias de 3 a 5 colegios (con la misma regla que Python: distancia + ruido,
 *     y si la familia tiene hermano, su colegio entra de primero).
 *  2. Fase 1 — asignación en las opciones de la familia:
 *       · "llegada": orden de llegada (como hoy): cada familia toma su primera opción con cupo.
 *       · "diferida": asignación diferida por rondas (Gale-Shapley, propuesta de las familias).
 *  3. Fase 2 — reubicación (como hace la SED): quien no cupo en sus opciones recibe un cupo libre
 *     cercano, hasta una distancia máxima. Hoy, por orden de llegada al más cercano; con Matrícula+,
 *     con la misma regla de prioridad sobre los cupos que quedaron.
 *
 * Con 3 opciones, sin cambiar supuestos, la fase 1 da exactamente lo mismo que Python
 * (lo verifica `scripts/verificar-motor.ts`).
 */

export interface DatosCandidato { familias: number[]; puntaje: number[]; dist: number[] }

export interface DatosFamilias {
  n: number
  n_sedes: number
  max_opciones: number
  estudiantes_por_familia: number
  lon: number[]
  lat: number[]
  upz: number[]
  u_vulnerable: number[]
  u_hermano: number[]
  hermano_elegida: number[]
  hermano_dist: number[]
  desempate: number[]
  top: number[]              // n × max_opciones, sedes existentes ordenadas por puntaje
  top_puntaje: number[]      // float32 exacto
  top_dist: number[]         // km, 4 decimales
  candidatos: Record<string, DatosCandidato>
  llegada: number[]
}

/** Supuestos editables del modelo */
export interface Supuestos {
  opciones: number              // colegios que puede pedir cada familia (3–5)
  pctVulnerable: number
  pctHermano: number
  cuposColegioNuevo: number
  reduccionJornada: number      // fracción de capacidad que se pierde con jornada única
  radioReubicacionKm: number    // distancia máxima para reubicar a quien no cupo
  umbralViajeLargoKm: number
  pesoDesempate: number
}

export interface Pesos { cercania: number; hermanos: number; vulnerabilidad: number }

/** Colegio nuevo: uno de los proyectos de la SED (clave) o un punto del mapa (el visitante lo
 * pone, o la simulación lo sugiere: entonces trae `etiqueta`, p. ej. «Mejor lugar en Usme»). */
export interface ColegioNuevo { clave: string | null; lon: number; lat: number; etiqueta?: string }

export interface Politica {
  mecanismo: 'llegada' | 'diferida'
  pesos: Pesos
  colegioNuevo: ColegioNuevo | null
  jornadaUnica: boolean
}

// ------------------------------------------------------------------ geometría
const KM_LAT = 110.57
const KM_LON = 111.32 * Math.cos((4.6 * Math.PI) / 180)
export const distanciaKm = (lon1: number, lat1: number, lon2: number, lat2: number) =>
  Math.hypot((lon2 - lon1) * KM_LON, (lat2 - lat1) * KM_LAT)
const redondear4 = (x: number) => Math.round(x * 1e4) / 1e4

/** Ruido determinístico en [0, 1.5) para un colegio puesto a mano en el mapa. */
function ruidoPin(i: number): number {
  let h = (i + 1) * 2654435761
  h = (h ^ (h >>> 16)) * 2246822519
  h = (h ^ (h >>> 13)) * 3266489917
  h ^= h >>> 16
  return ((h >>> 0) / 4294967296) * 1.5
}

// ------------------------------------------------------------------ atributos y preferencias
export interface Atributos { vulnerable: Uint8Array; hermano: Int32Array }

export function atributos(f: DatosFamilias, s: Supuestos): Atributos {
  const vulnerable = new Uint8Array(f.n)
  const hermano = new Int32Array(f.n)
  for (let i = 0; i < f.n; i++) {
    vulnerable[i] = f.u_vulnerable[i] < s.pctVulnerable ? 1 : 0
    hermano[i] = f.u_hermano[i] < s.pctHermano ? f.hermano_elegida[i] : -1
  }
  return { vulnerable, hermano }
}

export interface Preferencias { k: number; prefs: Int32Array; dist: Float64Array }

/**
 * Lista de k colegios por familia. El colegio nuevo, si existe, tiene el índice n_sedes.
 * Si la familia tiene hermano y su colegio no quedó en la lista, entra de primero.
 */
export function preferencias(f: DatosFamilias, s: Supuestos, at: Atributos, nuevo: ColegioNuevo | null): Preferencias {
  const K = f.max_opciones
  const k = Math.min(Math.max(1, s.opciones), K)
  const S = f.n_sedes
  const prefs = new Int32Array(f.n * k).fill(-1)
  const dist = new Float64Array(f.n * k)
  // Puntaje del colegio nuevo para cada familia (solo las que podrían incluirlo)
  const pNuevo = new Map<number, [number, number]>()
  if (nuevo) {
    const c = nuevo.clave ? f.candidatos[nuevo.clave] : undefined
    if (c) c.familias.forEach((i, j) => pNuevo.set(i, [Math.fround(c.puntaje[j]), c.dist[j]]))
    else {
      for (let i = 0; i < f.n; i++) {
        const d = distanciaKm(f.lon[i], f.lat[i], nuevo.lon, nuevo.lat)
        const p = Math.fround(Math.fround(d) + Math.fround(ruidoPin(i)))
        if (p < Math.fround(f.top_puntaje[i * K + K - 1])) pNuevo.set(i, [p, redondear4(d)])
      }
    }
  }
  const lista: number[] = [], dl: number[] = []
  for (let i = 0; i < f.n; i++) {
    lista.length = 0; dl.length = 0
    const pn = pNuevo.get(i)
    let puesto = !pn
    for (let o = 0; o < K && lista.length < k; o++) {
      if (!puesto && pn![0] < Math.fround(f.top_puntaje[i * K + o])) {
        lista.push(S); dl.push(pn![1]); puesto = true
        if (lista.length >= k) break
      }
      lista.push(f.top[i * K + o]); dl.push(f.top_dist[i * K + o])
    }
    if (!puesto && lista.length < k) { lista.push(S); dl.push(pn![1]) }
    const h = at.hermano[i]
    if (h >= 0 && !lista.includes(h)) { lista.unshift(h); dl.unshift(f.hermano_dist[i]); lista.length = k; dl.length = k }
    for (let o = 0; o < k; o++) { prefs[i * k + o] = lista[o] ?? -1; dist[i * k + o] = dl[o] ?? 0 }
  }
  return { k, prefs, dist }
}

/** Capacidad en familias (misma fórmula que Python). El colegio nuevo va al final. */
export function capacidades(cuposSedes: number[], cuposNuevo: number | null, jornadaUnica: boolean,
                            reduccion: number, estudiantesPorFamilia: number): Int32Array {
  const cupos = cuposNuevo !== null ? [...cuposSedes, cuposNuevo] : cuposSedes
  return Int32Array.from(cupos, (c) => Math.floor((jornadaUnica ? c * (1 - reduccion) : c) / estudiantesPorFamilia))
}

/** Clave de prioridad de cada (familia, opción): menor = más prioridad. Mismo orden de operaciones que Python. */
export function clave(i: number, sede: number, d: number, f: DatosFamilias, at: Atributos, w: Pesos, pd: number): number {
  const h = sede === at.hermano[i] ? 1 : 0
  const puntaje = -w.cercania * d + w.hermanos * h + w.vulnerabilidad * at.vulnerable[i] + pd * f.desempate[i]
  return -puntaje
}

export function claves(f: DatosFamilias, at: Atributos, p: Preferencias, w: Pesos, pd: number): Float64Array {
  const out = new Float64Array(f.n * p.k)
  for (let i = 0; i < f.n; i++)
    for (let o = 0; o < p.k; o++) out[i * p.k + o] = clave(i, p.prefs[i * p.k + o], p.dist[i * p.k + o], f, at, w, pd)
  return out
}

// ------------------------------------------------------------------ mecanismos de la fase 1
export interface Traza {
  asign: Int32Array            // sede (−1 = no cupo en sus opciones)
  opcion: Int8Array            // posición en la lista (−1)
  rondaPropuesta: Int16Array   // n × k (0 = no pidió)
  rondaRechazo: Int16Array     // n × k (0 = no la rechazaron)
  rondas: number
}

/** Asignación diferida por rondas. `prefs` puede traer −1 (lista más corta). */
export function diferidaPorRondas(prefs: Int32Array, cl: Float64Array, cap: Int32Array, n: number, k: number,
                                  activas?: number[]): Traza {
  const siguiente = new Int8Array(n)
  const rondaPropuesta = new Int16Array(n * k)
  const rondaRechazo = new Int16Array(n * k)
  const retenidos: number[][] = Array.from({ length: cap.length }, () => [])
  let libres: number[] = activas ? [...activas] : Array.from({ length: n }, (_, i) => i)
  let ronda = 0
  while (true) {
    const tocadas = new Set<number>()
    const nuevos: number[] = []
    let propuestas = 0
    for (const i of libres) {
      const o = siguiente[i]
      if (o >= k || prefs[i * k + o] < 0) continue
      if (propuestas === 0) ronda++
      propuestas++
      siguiente[i] = o + 1
      const s = prefs[i * k + o]
      rondaPropuesta[i * k + o] = ronda
      retenidos[s].push(i * k + o)
      tocadas.add(s)
    }
    if (propuestas === 0) break
    for (const s of tocadas) {
      const l = retenidos[s]
      if (l.length <= cap[s]) continue
      l.sort((a, b) => cl[a] - cl[b])
      for (const ix of l.slice(Math.max(0, cap[s]))) { rondaRechazo[ix] = ronda; nuevos.push(Math.floor(ix / k)) }
      l.length = Math.max(0, cap[s])
    }
    libres = nuevos
  }
  const asign = new Int32Array(n).fill(-1)
  const opcion = new Int8Array(n).fill(-1)
  retenidos.forEach((l, s) => l.forEach((ix) => { asign[Math.floor(ix / k)] = s; opcion[Math.floor(ix / k)] = ix % k }))
  return { asign, opcion, rondaPropuesta, rondaRechazo, rondas: ronda }
}

export interface Optimizacion { asign: Int32Array; opcion: Int8Array; movidos: number; ganados: number }

/**
 * Optimización de cupos (Matrícula+). Parte de una asignación (la diferida) y busca cadenas de
 * cambios: un niño pasa a otra de SUS opciones que tiene cupo y deja su lugar a quien no tenía
 * ninguno. Se repite hasta que no quede ninguna cadena; entonces el número de niños en alguna de sus
 * opciones es el máximo posible con esos cupos (teorema de Berge, emparejamiento de cardinalidad
 * máxima). Nadie que ya tenía cupo lo pierde: a lo sumo pasa a otra de las opciones que pidió.
 * Se atiende primero a quien tiene más prioridad y, para abrir espacio, se mueve primero a quien
 * tiene menos. `cl` es la clave de prioridad (menor = más prioridad), como en la diferida.
 * `fijos` marca familias que no se mueven: en Matrícula+, las que quedaron en el colegio de su
 * hermano (no se separan hermanos). Con familias fijas el máximo es «el máximo posible sin moverlas».
 * Ojo: para que quepa una familia más, otra con más prioridad puede pasar a otra de sus opciones; por
 * eso el resultado final no es estable en el sentido de Gale-Shapley (la diferida sí lo es).
 */
export function optimizarCupos(prefs: Int32Array, cl: Float64Array, cap: Int32Array, asign0: Int32Array, opcion0: Int8Array,
                               n: number, k: number, activas?: number[], fijos?: Uint8Array): Optimizacion {
  const asign = Int32Array.from(asign0), opcion = Int8Array.from(opcion0)
  const S = cap.length
  const libres = Int32Array.from(cap)
  const inscritos: number[][] = Array.from({ length: S }, () => [])
  const quienes = activas ?? Array.from({ length: n }, (_, i) => i)
  for (const i of quienes) if (asign[i] >= 0) { libres[asign[i]]--; inscritos[asign[i]].push(i) }
  // Para abrir espacio, primero se intenta mover a quien tiene menos prioridad en ese colegio
  inscritos.forEach((l) => l.sort((a, b) => cl[b * k + opcion[b]] - cl[a * k + opcion[a]]))
  const sinCupo = quienes.filter((i) => asign[i] < 0 && prefs[i * k] >= 0)
  sinCupo.sort((a, b) => cl[a * k] - cl[b * k])            // más prioridad, primero
  const muerta = new Uint8Array(S)                          // sin cadena posible: nunca la habrá
  const visto = new Int32Array(S)
  const via = new Int32Array(S)                             // niño que llega a la sede por una de sus opciones
  const desde = new Int32Array(n)                           // sede de la que sale ese niño para abrir espacio
  let marca = 0, movidos = 0, ganados = 0
  const cola: number[] = []
  for (const u of sinCupo) {
    marca++
    cola.length = 0
    let fin = -1
    for (let o = 0; o < k && fin < 0; o++) {
      const s = prefs[u * k + o]
      if (s < 0 || muerta[s] || visto[s] === marca) continue
      visto[s] = marca; via[s] = u; cola.push(s)
      if (libres[s] > 0) fin = s
    }
    for (let q = 0; q < cola.length && fin < 0; q++) {
      const s = cola[q]
      for (const x of inscritos[s]) {
        if (fijos && fijos[x]) continue            // familias que no se mueven (p. ej., en el colegio de su hermano)
        for (let o = 0; o < k; o++) {
          const s2 = prefs[x * k + o]
          if (s2 < 0 || s2 === s || muerta[s2] || visto[s2] === marca) continue
          visto[s2] = marca; via[s2] = x; desde[x] = s; cola.push(s2)
          if (libres[s2] > 0) { fin = s2; break }
        }
        if (fin >= 0) break
      }
    }
    if (fin < 0) { for (const s of cola) muerta[s] = 1; continue }
    // Se recorre la cadena desde el final: cada niño pasa a la sede siguiente
    libres[fin]--
    let actual = fin
    while (true) {
      const x = via[actual]
      const o = prefs.subarray(x * k, x * k + k).indexOf(actual)
      if (x === u) { asign[u] = actual; opcion[u] = o; inscritos[actual].push(u); ganados++; break }
      const anterior = desde[x]
      const l = inscritos[anterior]; l.splice(l.indexOf(x), 1)
      asign[x] = actual; opcion[x] = o; inscritos[actual].push(x); movidos++
      actual = anterior
    }
  }
  return { asign, opcion, movidos, ganados }
}

/** Familias que quedaron en el colegio de su hermano: la optimización no las mueve. */
export function conHermano(asign: Int32Array, hermano: Int32Array): Uint8Array {
  const fijos = new Uint8Array(asign.length)
  for (let i = 0; i < asign.length; i++) if (asign[i] >= 0 && asign[i] === hermano[i]) fijos[i] = 1
  return fijos
}

export interface Llegada { asign: Int32Array; opcion: Int8Array; turno: Int32Array }

export function ordenLlegada(prefs: Int32Array, cap: Int32Array, llegada: number[], n: number, k: number): Llegada {
  const libres = Int32Array.from(cap)
  const asign = new Int32Array(n).fill(-1)
  const opcion = new Int8Array(n).fill(-1)
  const turno = new Int32Array(n)
  llegada.forEach((i, t) => {
    turno[i] = t
    for (let o = 0; o < k; o++) {
      const s = prefs[i * k + o]
      if (s >= 0 && libres[s] > 0) { libres[s]--; asign[i] = s; opcion[i] = o; break }
    }
  })
  return { asign, opcion, turno }
}

// ------------------------------------------------------------------ fase 2: reubicación
export interface Reubicacion {
  asign: Int32Array     // sede de reubicación (−1 = no reubicado)
  dist: Float64Array    // km a la sede de reubicación
}

function libresTras(cap: Int32Array, asign: Int32Array): Int32Array {
  const libres = Int32Array.from(cap)
  for (const s of asign) if (s >= 0) libres[s]--
  return libres
}

/** Hoy: en orden de llegada, cada familia sin cupo va al colegio más cercano con cupo libre (hasta R km). */
export function reubicarHoy(f: DatosFamilias, pos: [number, number][], cap: Int32Array, fase1: Int32Array,
                            radio: number): Reubicacion {
  const libres = libresTras(cap, fase1)
  const asign = new Int32Array(f.n).fill(-1)
  const dist = new Float64Array(f.n)
  for (const i of f.llegada) {
    if (fase1[i] >= 0) continue
    let mejor = -1, dm = radio
    for (let s = 0; s < pos.length; s++) {
      if (libres[s] <= 0) continue
      const d = distanciaKm(f.lon[i], f.lat[i], pos[s][0], pos[s][1])
      if (d <= dm) { dm = d; mejor = s }
    }
    if (mejor >= 0) { libres[mejor]--; asign[i] = mejor; dist[i] = dm }
  }
  return { asign, dist }
}

/**
 * Matrícula+: los cupos libres se reparten con la misma regla de prioridad. Cada familia sin cupo
 * "pide" los colegios con cupo libre más cercanos (hasta R km), se corre otra asignación diferida y
 * se optimiza para reubicar al máximo de niños posible.
 */
export function reubicarDiferida(f: DatosFamilias, at: Atributos, pos: [number, number][], cap: Int32Array,
                                 fase1: Int32Array, radio: number, w: Pesos, pd: number, m = 12): Reubicacion {
  const libres = libresTras(cap, fase1)
  const conCupo: number[] = []
  libres.forEach((l, s) => { if (l > 0) conCupo.push(s) })
  const sin = []
  for (let i = 0; i < f.n; i++) if (fase1[i] < 0) sin.push(i)
  const prefs = new Int32Array(f.n * m).fill(-1)
  const dd = new Float64Array(f.n * m)
  const cl = new Float64Array(f.n * m)
  for (const i of sin) {
    const cerca: [number, number][] = []
    for (const s of conCupo) {
      const d = distanciaKm(f.lon[i], f.lat[i], pos[s][0], pos[s][1])
      if (d <= radio) cerca.push([d, s])
    }
    cerca.sort((a, b) => a[0] - b[0])
    cerca.slice(0, m).forEach(([d, s], o) => {
      prefs[i * m + o] = s; dd[i * m + o] = d; cl[i * m + o] = clave(i, s, d, f, at, w, pd)
    })
  }
  const t = diferidaPorRondas(prefs, cl, libres, f.n, m, sin)
  // Y se optimiza: el máximo de niños reubicados con esos cupos libres
  const opt = optimizarCupos(prefs, cl, libres, t.asign, t.opcion, f.n, m, sin)
  const asign = opt.asign
  const dist = new Float64Array(f.n)
  for (const i of sin) if (asign[i] >= 0) dist[i] = dd[i * m + opt.opcion[i]]
  return { asign, dist }
}

// ------------------------------------------------------------------ simulación completa y métricas
export interface Contexto { cuposSedes: number[]; posSedes: [number, number][] }

export interface Simulacion {
  politica: Politica
  pref: Preferencias
  at: Atributos
  cap: Int32Array
  pos: [number, number][]      // posición de cada colegio (con el nuevo al final)
  fase1: Int32Array            // sede en sus opciones (−1)
  opcion: Int8Array
  traza: Traza | null          // solo Matrícula+: las rondas de la asignación diferida, antes de optimizar
  optimizados: number          // solo Matrícula+: niños (familias) que entraron gracias a la optimización
  llegada: Llegada | null      // solo orden de llegada
  fase2: Reubicacion
}

export function simular(f: DatosFamilias, ctx: Contexto, s: Supuestos, p: Politica): Simulacion {
  const at = atributos(f, s)
  const pref = preferencias(f, s, at, p.colegioNuevo)
  const cap = capacidades(ctx.cuposSedes, p.colegioNuevo ? s.cuposColegioNuevo : null, p.jornadaUnica,
    s.reduccionJornada, f.estudiantes_por_familia)
  const pos: [number, number][] = p.colegioNuevo ? [...ctx.posSedes, [p.colegioNuevo.lon, p.colegioNuevo.lat]] : ctx.posSedes
  if (p.mecanismo === 'llegada') {
    const l = ordenLlegada(pref.prefs, cap, f.llegada, f.n, pref.k)
    return { politica: p, pref, at, cap, pos, fase1: l.asign, opcion: l.opcion, traza: null, llegada: l, optimizados: 0,
      fase2: reubicarHoy(f, pos, cap, l.asign, s.radioReubicacionKm) }
  }
  const cl = claves(f, at, pref, p.pesos, s.pesoDesempate)
  const t = diferidaPorRondas(pref.prefs, cl, cap, f.n, pref.k)
  const opt = optimizarCupos(pref.prefs, cl, cap, t.asign, t.opcion, f.n, pref.k, undefined, conHermano(t.asign, at.hermano))
  return { politica: p, pref, at, cap, pos, fase1: opt.asign, opcion: opt.opcion, traza: t, llegada: null, optimizados: opt.ganados,
    fase2: reubicarDiferida(f, at, pos, cap, opt.asign, s.radioReubicacionKm, p.pesos, s.pesoDesempate) }
}

export interface Metricas {
  familias: number
  estudiantes: number
  pctPrimera: number
  pctFueraDeOpciones: number     // no quedó en ninguna de sus opciones (la métrica del brief)
  pctReubicados: number          // de esos, recibió un cupo cercano en la reubicación
  pctSinCupo: number             // no hay ningún cupo dentro de la distancia máxima
  distanciaKm: number            // promedio casa–colegio de todos los que tienen colegio
  pctViajeLargo: number          // de los que tienen colegio, más lejos que el umbral
  pctVulnerablesFuera: number    // vulnerables fuera de sus opciones
  fueraDeOpciones: number        // estudiantes
  sinCupo: number                // estudiantes
  vulnerablesFuera: number       // estudiantes vulnerables fuera de sus opciones
}

export function metricas(f: DatosFamilias, sim: Simulacion, s: Supuestos, incluir: (i: number) => boolean = () => true): Metricas {
  const k = sim.pref.k
  let n = 0, primera = 0, fuera = 0, reub = 0, sin = 0, vul = 0, vulFuera = 0, conCol = 0, distSuma = 0, largos = 0
  for (let i = 0; i < f.n; i++) {
    if (!incluir(i)) continue
    n++
    const esVul = sim.at.vulnerable[i] === 1
    if (esVul) vul++
    let d = -1
    if (sim.fase1[i] >= 0) { d = sim.pref.dist[i * k + sim.opcion[i]]; if (sim.opcion[i] === 0) primera++ }
    else {
      fuera++; if (esVul) vulFuera++
      if (sim.fase2.asign[i] >= 0) { reub++; d = sim.fase2.dist[i] } else sin++
    }
    if (d >= 0) { conCol++; distSuma += d; if (d > s.umbralViajeLargoKm) largos++ }
  }
  const pct = (a: number, b: number) => (b ? (100 * a) / b : 0)
  const e = f.estudiantes_por_familia
  return {
    familias: n, estudiantes: n * e,
    pctPrimera: pct(primera, n), pctFueraDeOpciones: pct(fuera, n), pctReubicados: pct(reub, n), pctSinCupo: pct(sin, n),
    distanciaKm: conCol ? distSuma / conCol : 0, pctViajeLargo: pct(largos, conCol), pctVulnerablesFuera: pct(vulFuera, vul),
    fueraDeOpciones: fuera * e, sinCupo: sin * e, vulnerablesFuera: vulFuera * e,
  }
}

/** % de familias fuera de sus opciones por UPZ (para colorear el mapa). */
export function porUpz(f: DatosFamilias, sim: Simulacion, nUpz: number): Float64Array {
  const tot = new Float64Array(nUpz), fuera = new Float64Array(nUpz)
  for (let i = 0; i < f.n; i++) { tot[f.upz[i]]++; if (sim.fase1[i] < 0) fuera[f.upz[i]]++ }
  return tot.map((t, u) => (t ? (100 * fuera[u]) / t : 0))
}

// ------------------------------------------------------------------ un caso: una familia más
export interface Caso {
  lon: number
  lat: number
  vulnerable: boolean
  hermanoEn: number | null       // sede donde ya estudia un hermano
  colegios: number[]             // su lista, en orden (sedes; el nuevo = n_sedes)
  llegada: number                // 0 = primera en llegar … 1 = última
}

export interface ResultadoCaso {
  hoy: { sede: number; opcion: number; reubicado: boolean; dist: number }
  matricula: { sede: number; opcion: number; reubicado: boolean; dist: number }
  /** por qué no quedó en las opciones anteriores con Matrícula+ */
  razones: { sede: number; motivo: 'lleno' | 'prioridad' | 'optimizacion'; ultimaDist?: number }[]
}

/**
 * Agrega la familia del caso como una más (al final de los datos) y vuelve a correr ambos
 * mecanismos. Devuelve en qué colegio queda y, con Matrícula+, por qué no quedó en las anteriores.
 */
export function simularCaso(f: DatosFamilias, ctx: Contexto, s: Supuestos, p: Politica, c: Caso): ResultadoCaso {
  const n = f.n + 1
  const fc: DatosFamilias = {
    ...f, n,
    lon: [...f.lon, c.lon], lat: [...f.lat, c.lat], upz: [...f.upz, f.upz[0]],
    desempate: [...f.desempate, 0.5],
    llegada: (() => { const l = [...f.llegada]; l.splice(Math.round(c.llegada * f.n), 0, f.n); return l })(),
  }
  const at = atributos(f, s)
  const at2: Atributos = {
    vulnerable: Uint8Array.from([...at.vulnerable, c.vulnerable ? 1 : 0]),
    hermano: Int32Array.from([...at.hermano, c.hermanoEn ?? -1]),
  }
  const base = preferencias(f, s, at, p.colegioNuevo)
  const k = base.k
  const prefs = new Int32Array(n * k).fill(-1); prefs.set(base.prefs)
  const dist = new Float64Array(n * k); dist.set(base.dist)
  const pos: [number, number][] = p.colegioNuevo ? [...ctx.posSedes, [p.colegioNuevo.lon, p.colegioNuevo.lat]] : ctx.posSedes
  c.colegios.slice(0, k).forEach((sd, o) => {
    prefs[f.n * k + o] = sd
    dist[f.n * k + o] = redondear4(distanciaKm(c.lon, c.lat, pos[sd][0], pos[sd][1]))
  })
  const cap = capacidades(ctx.cuposSedes, p.colegioNuevo ? s.cuposColegioNuevo : null, p.jornadaUnica,
    s.reduccionJornada, f.estudiantes_por_familia)
  const i = f.n
  // Hoy
  const l = ordenLlegada(prefs, cap, fc.llegada, n, k)
  const r1 = reubicarHoy(fc, pos, cap, l.asign, s.radioReubicacionKm)
  // Matrícula+
  const cl = new Float64Array(n * k)
  for (let x = 0; x < n; x++) for (let o = 0; o < k; o++) cl[x * k + o] = clave(x, prefs[x * k + o], dist[x * k + o], fc, at2, p.pesos, s.pesoDesempate)
  const d = diferidaPorRondas(prefs, cl, cap, n, k)
  // igual que Matrícula+ en el resto de la app: diferida + optimización (sin separar hermanos)
  const t = optimizarCupos(prefs, cl, cap, d.asign, d.opcion, n, k, undefined, conHermano(d.asign, at2.hermano))
  const r2 = reubicarDiferida(fc, at2, pos, cap, t.asign, s.radioReubicacionKm, p.pesos, s.pesoDesempate)
  // Por qué no quedó en sus opciones anteriores. Se mira la asignación por prioridad (la diferida):
  // ahí el colegio se llenó con familias de más prioridad. Si en la diferida sí quedaba en esa
  // opción, fue la optimización la que la pasó a otra para que cupiera otra familia.
  const razones: ResultadoCaso['razones'] = []
  const hasta = t.opcion[i] >= 0 ? t.opcion[i] : k
  for (let o = 0; o < hasta; o++) {
    const sd = prefs[i * k + o]
    if (sd < 0) continue
    if (d.asign[i] === sd) { razones.push({ sede: sd, motivo: 'optimizacion' }); continue }
    let ultima = -Infinity, ud: number | undefined
    for (let x = 0; x < n; x++) if (d.asign[x] === sd) {
      const kx = cl[x * k + d.opcion[x]]
      if (kx > ultima) { ultima = kx; ud = dist[x * k + d.opcion[x]] }
    }
    razones.push({ sede: sd, motivo: cap[sd] === 0 ? 'lleno' : 'prioridad', ultimaDist: ud })
  }
  const res = (a: number, o: number, rb: Reubicacion) => a >= 0
    ? { sede: a, opcion: o, reubicado: false, dist: dist[i * k + o] }
    : { sede: rb.asign[i], opcion: -1, reubicado: rb.asign[i] >= 0, dist: rb.dist[i] }
  return { hoy: res(l.asign[i], l.opcion[i], r1), matricula: res(t.asign[i], t.opcion[i], r2), razones }
}
