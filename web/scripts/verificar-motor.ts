/**
 * Verifica el motor del navegador (src/motor.ts):
 *  1. Con los supuestos por defecto, la FASE 1 da exactamente lo mismo que Python en los 48
 *     escenarios de la interfaz (4 presets × 6 colegios × 2 jornadas) y en la línea base.
 *  2. Propiedades que deben cumplirse siempre (también con supuestos editados): ningún colegio
 *     supera su capacidad tras la reubicación, cada familia queda en un solo colegio y la fase 1
 *     de la asignación diferida es estable.
 *
 * Uso:  npm run verificar
 */
import fs from 'node:fs'
import { simular, type DatosFamilias, type Supuestos, type Politica, type Simulacion } from '../src/motor.ts'

const dir = new URL('../public/simulador/', import.meta.url)
const leer = (f: string) => JSON.parse(fs.readFileSync(new URL(f, dir), 'utf-8'))
const todos = leer('todos.json')
const f: DatosFamilias = leer('familias.json')
const colegios = leer('colegios.geojson')
const ind = todos.indice
const par = ind.parametros
const sedes = colegios.features.filter((x: any) => x.properties.tipo === 'sede')
const ctx = { cuposSedes: sedes.map((x: any) => x.properties.cupos), posSedes: sedes.map((x: any) => x.geometry.coordinates) }
const zona = new Set(ind.zona_critica.map((z: { codigo: string }) => ind.upz.indexOf(z.codigo)))
const SUP: Supuestos = {
  opciones: par.n_opciones, pctVulnerable: par.pct_vulnerable, pctHermano: par.pct_hermano,
  cuposColegioNuevo: par.cupos_colegio_nuevo, reduccionJornada: par.reduccion_jornada_unica,
  radioReubicacionKm: 3, umbralViajeLargoKm: 2, pesoDesempate: par.desempate_peso,
}

/** Métricas de la fase 1, igual que las calcula Python. */
function fase1(sim: Simulacion) {
  const k = sim.pref.k
  let n = 0, prim = 0, sin = 0, vul = 0, vulSin = 0, nz = 0, zSin = 0, dSum = 0, asig = 0
  for (let i = 0; i < f.n; i++) {
    n++
    const v = sim.at.vulnerable[i] === 1
    const z = zona.has(f.upz[i])
    if (v) vul++
    if (z) nz++
    if (sim.fase1[i] < 0) { sin++; if (v) vulSin++; if (z) zSin++; continue }
    if (sim.opcion[i] === 0) prim++
    asig++; dSum += sim.pref.dist[i * k + sim.opcion[i]]
  }
  return [100 * prim / n, 100 * sin / n, dSum / asig, 100 * vulSin / vul, 100 * zSin / nz]
}

let fallas = 0, tiempo = 0, corridas = 0
function comparar(nombre: string, esperado: number[], sim: Simulacion) {
  const ob = fase1(sim)
  const tol = [0.006, 0.006, 0.002, 0.006, 0.006]
  if (!ob.every((v, j) => Math.abs(v - esperado[j]) <= tol[j])) {
    fallas++
    console.log(`✗ ${nombre}\n   Python ${esperado.join(' · ')}\n   web    ${ob.map((v) => v.toFixed(3)).join(' · ')}`)
  }
}
function propiedades(nombre: string, sim: Simulacion) {
  const ocup = new Int32Array(sim.cap.length)
  for (let i = 0; i < f.n; i++) {
    if (sim.fase1[i] >= 0 && sim.fase2.asign[i] >= 0) { fallas++; console.log(`✗ ${nombre}: familia ${i} en dos colegios`); return }
    const s = sim.fase1[i] >= 0 ? sim.fase1[i] : sim.fase2.asign[i]
    if (s >= 0) ocup[s]++
  }
  for (let s = 0; s < sim.cap.length; s++) if (ocup[s] > sim.cap[s]) { fallas++; console.log(`✗ ${nombre}: colegio ${s} supera su capacidad`); return }
  if (sim.traza) {
    // Estabilidad de la fase 1: nadie prefiere un colegio que lo habría aceptado
    const k = sim.pref.k
    const peor = new Float64Array(sim.cap.length).fill(-Infinity)
    const cuenta = new Int32Array(sim.cap.length)
    const cl = (i: number, o: number) => {
      const p = sim.politica.pesos, h = sim.pref.prefs[i * k + o] === sim.at.hermano[i] ? 1 : 0
      return -(-p.cercania * sim.pref.dist[i * k + o] + p.hermanos * h + p.vulnerabilidad * sim.at.vulnerable[i] + SUP.pesoDesempate * f.desempate[i])
    }
    for (let i = 0; i < f.n; i++) if (sim.fase1[i] >= 0) { cuenta[sim.fase1[i]]++; peor[sim.fase1[i]] = Math.max(peor[sim.fase1[i]], cl(i, sim.opcion[i])) }
    for (let i = 0; i < f.n; i++) {
      const hasta = sim.fase1[i] >= 0 ? sim.opcion[i] : k
      for (let o = 0; o < hasta; o++) {
        const s = sim.pref.prefs[i * k + o]
        if (s >= 0 && (cuenta[s] < sim.cap[s] || cl(i, o) < peor[s])) { fallas++; console.log(`✗ ${nombre}: par bloqueante (${i}, ${s})`); return }
      }
    }
  }
}

// 1. Igual que Python
const base = simular(f, ctx, SUP, { mecanismo: 'llegada', pesos: ind.pesos_presets.equilibrada, colegioNuevo: null, jornadaUnica: false })
comparar('base', ind.metricas.map((m: string) => ind.base[m]), base)
propiedades('base', base)
for (const preset of ind.presets) {
  for (const c of [null, ...ind.colegio_nuevo]) {
    for (const ju of [false, true]) {
      const pol: Politica = { mecanismo: 'diferida', pesos: ind.pesos_presets[preset.clave],
        colegioNuevo: c ? { clave: c.clave, lon: c.lon, lat: c.lat } : null, jornadaUnica: ju }
      const t0 = performance.now()
      const sim = simular(f, ctx, SUP, pol)
      tiempo += performance.now() - t0; corridas++
      const id = `${preset.escenario}_${c?.clave ?? 'ninguno'}_${ju ? 'ju' : 'sinju'}`
      comparar(`${id} (${sim.traza!.rondas} rondas)`, todos.escenarios[id].m, sim)
      propiedades(id, sim)
    }
  }
}
// 2. Supuestos editados: solo propiedades (no hay referencia en Python)
const editados: [string, Partial<Supuestos>, Partial<Politica>][] = [
  ['5 opciones', { opciones: 5 }, {}],
  ['4 opciones + 40% vulnerables', { opciones: 4, pctVulnerable: 0.4 }, {}],
  ['colegio en un punto del mapa', {}, { colegioNuevo: { clave: null, lon: -74.12, lat: 4.62 } }],
  ['jornada −15% y radio 5 km', { reduccionJornada: 0.15, radioReubicacionKm: 5 }, { jornadaUnica: true }],
]
for (const [nombre, s, p] of editados) {
  for (const mecanismo of ['llegada', 'diferida'] as const) {
    const sim = simular(f, ctx, { ...SUP, ...s }, { mecanismo, pesos: ind.pesos_presets.equilibrada, colegioNuevo: null, jornadaUnica: false, ...p })
    propiedades(`${nombre} (${mecanismo})`, sim)
  }
}
console.log(fallas
  ? `✗ ${fallas} verificaciones fallaron`
  : `✓ Fase 1 idéntica a Python en ${corridas} escenarios + base · capacidad, unicidad y estabilidad OK también con supuestos editados · ${(tiempo / corridas).toFixed(0)} ms por simulación completa`)
process.exit(fallas ? 1 : 0)
