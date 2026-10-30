/**
 * Matrícula+ · Cómo lo hicimos: la animación común (componentes/AnimacionSistema) con lo de este demo:
 * fragmentos de la programación lineal y cifras de resultados.json, y en el mapa los estudiantes de la
 * simulación (verde = ahora cerca; violeta = siguen lejos).
 */
import { useMemo } from 'react'
import Animacion, { type PuntoMapa, type TipoFragmento } from '../componentes/AnimacionSistema'
import { entero, millonesDe, type DatosMatricula } from './datos'

export default function AnimacionSistema({ datos, auto }: { datos: DatosMatricula; auto: boolean }) {
  const s = datos.r.simulacion
  const fragmentos: [string, TipoFragmento][] = [
    ['linprog(costo, A_ub, b_ub)', 'codigo'], ['min Σ wᵢ · dᵢⱼ · xᵢⱼ', 'mate'], [`${entero(s.ninos)} estudiantes`, 'dato'],
    ['d = distancia(casa, colegio)', 'codigo'], ['Σⱼ xᵢⱼ = 1', 'mate'], [`${entero(s.sedes_con_cupos_de_nuevos)} sedes`, 'dato'],
    ['if estrato <= 2: w += 1', 'codigo'], ['Σᵢ xᵢⱼ ≤ cupoⱼ', 'mate'], [`${entero(s.manzanas_residenciales)} manzanas`, 'dato'],
    ['for niño in niños:', 'codigo'], ['d > 2 km', 'mate'], [`${millonesDe(s.distancias_calculadas)} de distancias`, 'dato'],
    ['xᵢⱼ ∈ {0, 1}', 'mate'], ['{ "nivel": "Primaria" }', 'dato'], ['edad < 10 → +1', 'codigo'],
    [`${entero(s.combinaciones_nino_colegio)} combinaciones`, 'dato'], ['w = 1 + estrato + edad', 'mate'], ['{ "estrato": 1 }', 'dato'],
  ]
  const p = datos.puntos
  const puntos = useMemo((): PuntoMapa[] => p.lon.map((lon, i) => ({ lon, lat: p.lat[i], clase: p.lejos_despues[i] ? 'lejos' : 'cerca' })), [p])
  const anillos = useMemo(() => datos.croquis.flatMap((c) => c.anillos), [datos])
  return (
    <Animacion fragmentos={fragmentos} bbox={datos.bboxCiudad} anillos={anillos} puntos={puntos} auto={auto}
               etiqueta="Datos conectados, un modelo de programación lineal y la asignación de cada estudiante en el mapa de Bogotá"
               leyendas={{
                 datos: <><b>1 · Datos</b> conectados de fuentes públicas</>,
                 modelo: <><b>2 · Modelo</b>: programación lineal</>,
                 decision: <><b>3 · Decisión</b>: dónde puede estudiar cada niño</>,
               }} />
  )
}
