// Croquis de Bogotá para el mapa de Movilidad+: los límites de las 19 localidades urbanas (IDECA,
// recortados al área urbana y simplificados por engine/exportar.py) con solo código y nombre.
// Uso: node scripts/movilidad-localidades.mjs  (desde web/)
import fs from 'node:fs'

const ORIGEN = '../data/processed/localidades.geojson'
const DESTINO = 'public/movilidad/datos/localidades.geojson'

const g = JSON.parse(fs.readFileSync(ORIGEN, 'utf-8'))
// 5 decimales ≈ 1 m: de sobra para un límite simplificado a ~40 m
const redondear = (c) => (typeof c[0] === 'number' ? c.map((x) => Math.round(x * 1e5) / 1e5) : c.map(redondear))
const salida = {
  type: 'FeatureCollection',
  fuente: 'IDECA · Datos Abiertos Bogotá (límites de localidad), recortados al área urbana',
  features: g.features.map((f) => ({
    type: 'Feature',
    properties: { codigo: f.properties.codigo, nombre: f.properties.nombre },
    geometry: { type: f.geometry.type, coordinates: redondear(f.geometry.coordinates) },
  })),
}
fs.writeFileSync(DESTINO, JSON.stringify(salida))
console.log(`Escrito ${DESTINO}: ${salida.features.length} localidades, ${(fs.statSync(DESTINO).size / 1024).toFixed(0)} KB`)
