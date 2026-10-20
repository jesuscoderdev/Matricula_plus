/**
 * Verifica que el motor del navegador (src/motor.ts) dé EXACTAMENTE lo mismo que el motor de
 * Python en los 36 escenarios de la interfaz y en la línea base.
 *
 * Uso:  npm run verificar        (node ejecuta TypeScript directamente)
 */
import fs from 'node:fs'
import { capacidades, claves, diferidaPorRondas, metricas, ordenLlegada, preferencias, type DatosFamilias } from '../src/motor.ts'

const dir = new URL('../public/simulador/', import.meta.url)
const leer = (f: string) => JSON.parse(fs.readFileSync(new URL(f, dir), 'utf-8'))
const todos = leer('todos.json')
const f: DatosFamilias = leer('familias.json')
const colegios = leer('colegios.geojson')

const ind = todos.indice
const par = ind.parametros
const cuposSedes: number[] = colegios.features.filter((x: any) => x.properties.tipo === 'sede').map((x: any) => x.properties.cupos)
const zona = new Set(ind.zona_critica.map((z: { codigo: string }) => ind.upz.indexOf(z.codigo)))
const k = f.opciones

function comparar(nombre: string, esperado: number[], p: ReturnType<typeof preferencias>, asign: Int32Array, opcion: Int8Array) {
  const g = metricas(f, p, asign, opcion)
  const z = metricas(f, p, asign, opcion, (i) => zona.has(f.upz[i]))
  const obtenido = [g.pctPrimera, g.pctSinCupo, g.distanciaKm, g.pctVulnerablesSinCupo, z.pctSinCupo]
  const tol = [0.006, 0.006, 0.002, 0.006, 0.006]   // los valores precalculados vienen redondeados
  const ok = obtenido.every((v, j) => Math.abs(v - esperado[j]) <= tol[j])
  if (!ok) console.log(`✗ ${nombre}\n   esperado ${esperado.join(' · ')}\n   obtenido ${obtenido.map((v) => v.toFixed(3)).join(' · ')}`)
  return ok
}

let fallas = 0, t = 0

// Línea base: orden de llegada, sin palancas
{
  const p = preferencias(f, null)
  const cap = capacidades(cuposSedes, null, false, par.reduccion_jornada_unica, par.estudiantes_por_familia)
  const r = ordenLlegada(p.prefs, cap, f.llegada, f.n, k)
  if (!comparar('base', ind.metricas.map((m: string) => ind.base[m]), p, r.asign, r.opcion)) fallas++
}

for (const preset of ind.presets) {
  for (const nuevo of [null, ...ind.colegio_nuevo.map((c: { clave: string }) => c.clave)]) {
    for (const ju of [false, true]) {
      const id = `${preset.escenario}_${nuevo ?? 'ninguno'}_${ju ? 'ju' : 'sinju'}`
      const t0 = performance.now()
      const p = preferencias(f, nuevo)
      const cap = capacidades(cuposSedes, nuevo ? par.cupos_colegio_nuevo : null, ju, par.reduccion_jornada_unica, par.estudiantes_por_familia)
      const cl = claves(f, p, ind.pesos_presets[preset.clave], par.desempate_peso)
      const r = diferidaPorRondas(p.prefs, cl, cap, f.n, k)
      t += performance.now() - t0
      if (!comparar(`${id} (${r.rondas} rondas)`, todos.escenarios[id].m, p, r.asign, r.opcion)) fallas++
    }
  }
}
console.log(fallas ? `✗ ${fallas} escenarios no coinciden` : `✓ Los 36 escenarios y la línea base coinciden con Python · ${(t / 36).toFixed(0)} ms por escenario en promedio`)
process.exit(fallas ? 1 : 0)
