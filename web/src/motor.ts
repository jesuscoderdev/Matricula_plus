/**
 * Motor de asignación en el navegador.
 *
 * Es la misma lógica de `engine/simulador` (Python), escrita para correr en vivo y poder
 * ANIMAR el proceso. Usa los mismos datos redondeados, así que la asignación final es
 * idéntica a la precalculada (lo verifica `web/scripts/verificar-motor.ts`).
 *
 * - Orden de llegada: las familias llegan en un orden fijo y cada una toma su primera opción con cupo.
 * - Asignación diferida por rondas (Gale-Shapley sincrónico, propuesta de las familias): en cada ronda
 *   todas las familias libres piden su siguiente opción; cada colegio retiene a las de más prioridad
 *   hasta llenar su capacidad y rechaza al resto. Da el mismo resultado estable que la versión por cola.
 */

export interface Variante { familias: number[]; prefs: number[]; dist: number[] }

export interface DatosFamilias {
  n: number
  n_sedes: number
  opciones: number
  estudiantes_por_familia: number
  lon: number[]
  lat: number[]
  upz: number[]            // posición en indice.upz
  vulnerable: string       // "0101…"
  hermano: number[]        // sede del hermano o −1
  desempate: number[]
  prefs: number[]          // n × opciones, sin colegio nuevo
  dist: number[]           // n × opciones (km, 4 decimales)
  variantes: Record<string, Variante>
  llegada: number[]        // orden de llegada (índices de familia)
}

export interface Pesos { cercania: number; hermanos: number; vulnerabilidad: number }

export interface Preferencias { prefs: Int32Array; dist: Float64Array }

/** Preferencias con (o sin) colegio nuevo: las base más las familias que cambian. */
export function preferencias(f: DatosFamilias, colegioNuevo: string | null): Preferencias {
  const prefs = Int32Array.from(f.prefs)
  const dist = Float64Array.from(f.dist)
  const v = colegioNuevo ? f.variantes[colegioNuevo] : undefined
  if (v) {
    const k = f.opciones
    v.familias.forEach((i, j) => {
      for (let o = 0; o < k; o++) {
        prefs[i * k + o] = v.prefs[j * k + o]
        dist[i * k + o] = v.dist[j * k + o]
      }
    })
  }
  return { prefs, dist }
}

/** Capacidad en familias (misma fórmula que mecanismos.capacidades). El colegio nuevo va al final. */
export function capacidades(cuposSedes: number[], cuposNuevo: number | null, jornadaUnica: boolean,
                            reduccion: number, estudiantesPorFamilia: number): Int32Array {
  const cupos = cuposNuevo !== null ? [...cuposSedes, cuposNuevo] : cuposSedes
  return Int32Array.from(cupos, (c) => Math.floor((jornadaUnica ? c * (1 - reduccion) : c) / estudiantesPorFamilia))
}

/** Clave de prioridad de cada (familia, opción): menor = más prioridad. */
export function claves(f: DatosFamilias, p: Preferencias, pesos: Pesos, pesoDesempate: number): Float64Array {
  const k = f.opciones
  const out = new Float64Array(f.n * k)
  for (let i = 0; i < f.n; i++) {
    const v = f.vulnerable.charCodeAt(i) === 49 ? 1 : 0
    for (let o = 0; o < k; o++) {
      const h = p.prefs[i * k + o] === f.hermano[i] ? 1 : 0
      // Mismo orden de operaciones que Python, para obtener exactamente el mismo número
      const puntaje = -pesos.cercania * p.dist[i * k + o] + pesos.hermanos * h + pesos.vulnerabilidad * v
        + pesoDesempate * f.desempate[i]
      out[i * k + o] = -puntaje
    }
  }
  return out
}

export interface Traza {
  /** sede asignada (−1 = sin cupo) */
  asign: Int32Array
  /** posición de la sede asignada en la lista (0, 1, 2) o −1 */
  opcion: Int8Array
  /** ronda en que la familia pidió su opción o (0 = nunca la pidió), n × opciones */
  rondaPropuesta: Int16Array
  /** ronda en que la rechazaron de su opción o (0 = no la rechazaron), n × opciones */
  rondaRechazo: Int16Array
  rondas: number
}

export function diferidaPorRondas(prefs: Int32Array, cl: Float64Array, cap: Int32Array, n: number, k: number): Traza {
  const siguiente = new Int8Array(n)
  const rondaPropuesta = new Int16Array(n * k)
  const rondaRechazo = new Int16Array(n * k)
  const retenidos: number[][] = Array.from({ length: cap.length }, () => [])   // índices (familia·k + opción)
  let libres: number[] = Array.from({ length: n }, (_, i) => i)
  let ronda = 0
  while (true) {
    const tocadas = new Set<number>()
    const nuevosLibres: number[] = []
    let propuestas = 0
    for (const i of libres) {
      const o = siguiente[i]
      if (o >= k) continue                      // agotó su lista: queda sin cupo
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
      const lista = retenidos[s]
      if (lista.length <= cap[s]) continue
      lista.sort((a, b) => cl[a] - cl[b])
      for (const ix of lista.slice(Math.max(0, cap[s]))) {
        rondaRechazo[ix] = ronda
        nuevosLibres.push(Math.floor(ix / k))
      }
      lista.length = Math.max(0, cap[s])
    }
    libres = nuevosLibres
  }
  const asign = new Int32Array(n).fill(-1)
  const opcion = new Int8Array(n).fill(-1)
  retenidos.forEach((lista, s) => lista.forEach((ix) => { asign[Math.floor(ix / k)] = s; opcion[Math.floor(ix / k)] = ix % k }))
  return { asign, opcion, rondaPropuesta, rondaRechazo, rondas: ronda }
}

export interface Llegada {
  asign: Int32Array
  opcion: Int8Array
  /** posición de cada familia en la fila de llegada */
  turno: Int32Array
}

export function ordenLlegada(prefs: Int32Array, cap: Int32Array, llegada: number[], n: number, k: number): Llegada {
  const libres = Int32Array.from(cap)
  const asign = new Int32Array(n).fill(-1)
  const opcion = new Int8Array(n).fill(-1)
  const turno = new Int32Array(n)
  llegada.forEach((i, t) => {
    turno[i] = t
    for (let o = 0; o < k; o++) {
      const s = prefs[i * k + o]
      if (libres[s] > 0) { libres[s]--; asign[i] = s; opcion[i] = o; break }
    }
  })
  return { asign, opcion, turno }
}

export interface MetricasGrupo {
  familias: number
  estudiantes: number
  sinCupo: number           // estudiantes
  pctSinCupo: number
  pctPrimera: number
  pctVulnerablesSinCupo: number
  distanciaKm: number
}

/** Métricas de un grupo de familias (por ejemplo, las que viven en una localidad). */
export function metricas(f: DatosFamilias, p: Preferencias, asign: Int32Array, opcion: Int8Array,
                         incluir: (i: number) => boolean = () => true): MetricasGrupo {
  const k = f.opciones
  let n = 0, sin = 0, primera = 0, vul = 0, vulSin = 0, distSuma = 0, asignados = 0
  for (let i = 0; i < f.n; i++) {
    if (!incluir(i)) continue
    n++
    const esVul = f.vulnerable.charCodeAt(i) === 49
    if (esVul) vul++
    if (asign[i] < 0) { sin++; if (esVul) vulSin++; continue }
    if (opcion[i] === 0) primera++
    asignados++
    distSuma += p.dist[i * k + opcion[i]]
  }
  const pct = (a: number, b: number) => (b ? (100 * a) / b : 0)
  return {
    familias: n, estudiantes: n * f.estudiantes_por_familia, sinCupo: sin * f.estudiantes_por_familia,
    pctSinCupo: pct(sin, n), pctPrimera: pct(primera, n), pctVulnerablesSinCupo: pct(vulSin, vul),
    distanciaKm: asignados ? distSuma / asignados : 0,
  }
}
