/** Tabla rápida de métricas (con reubicación) para escribir la narrativa. Uso: node scripts/explorar-metricas.ts */
import fs from 'node:fs'
import { metricas, simular, type DatosFamilias, type Supuestos } from '../src/motor.ts'

const dir = new URL('../public/simulador/', import.meta.url)
const leer = (x: string) => JSON.parse(fs.readFileSync(new URL(x, dir), 'utf-8'))
const ind = leer('todos.json').indice, f: DatosFamilias = leer('familias.json'), col = leer('colegios.geojson')
const sedes = col.features.filter((x: any) => x.properties.tipo === 'sede')
const ctx = { cuposSedes: sedes.map((x: any) => x.properties.cupos), posSedes: sedes.map((x: any) => x.geometry.coordinates) }
const zona = new Set(ind.zona_critica.map((z: any) => ind.upz.indexOf(z.codigo)))
const S: Supuestos = { opciones: 3, pctVulnerable: 0.3, pctHermano: 0.15, cuposColegioNuevo: 1200, reduccionJornada: 0.1,
  radioReubicacionKm: 3, umbralViajeLargoKm: 2, pesoDesempate: 0.01 }
const fila = (n: string, s: Supuestos, p: any) => {
  const sim = simular(f, ctx, s, p)
  const m = metricas(f, sim, s), z = metricas(f, sim, s, (i) => zona.has(f.upz[i]))
  console.log(`${n.padEnd(34)} 1ª ${m.pctPrimera.toFixed(1)} · fuera ${m.pctFueraDeOpciones.toFixed(1)} · reubic ${m.pctReubicados.toFixed(1)} · sin cupo ${m.pctSinCupo.toFixed(1)} · dist ${m.distanciaKm.toFixed(2)} · >2km ${m.pctViajeLargo.toFixed(1)} · vulFuera ${m.pctVulnerablesFuera.toFixed(1)} · zonaFuera ${z.pctFueraDeOpciones.toFixed(1)}`)
}
const W = ind.pesos_presets
fila('Hoy (orden de llegada)', S, { mecanismo: 'llegada', pesos: W.equilibrada, colegioNuevo: null, jornadaUnica: false })
for (const k of ['equilibrada', 'cercania', 'familias', 'equidad'])
  fila(`Diferida · ${k}`, S, { mecanismo: 'diferida', pesos: W[k], colegioNuevo: null, jornadaUnica: false })
for (const o of [4, 5]) {
  fila(`Hoy · ${o} opciones`, { ...S, opciones: o }, { mecanismo: 'llegada', pesos: W.equilibrada, colegioNuevo: null, jornadaUnica: false })
  fila(`Diferida equilibrada · ${o} opciones`, { ...S, opciones: o }, { mecanismo: 'diferida', pesos: W.equilibrada, colegioNuevo: null, jornadaUnica: false })
}
const t = ind.colegio_nuevo[0]
fila('Diferida + Tibabuyes 1.200', S, { mecanismo: 'diferida', pesos: W.equilibrada, colegioNuevo: { clave: t.clave, lon: t.lon, lat: t.lat }, jornadaUnica: false })
fila('Diferida + Tibabuyes 2.400', { ...S, cuposColegioNuevo: 2400 }, { mecanismo: 'diferida', pesos: W.equilibrada, colegioNuevo: { clave: t.clave, lon: t.lon, lat: t.lat }, jornadaUnica: false })
fila('Diferida + jornada única', S, { mecanismo: 'diferida', pesos: W.equilibrada, colegioNuevo: null, jornadaUnica: true })
