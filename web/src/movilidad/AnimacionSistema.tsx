/**
 * Presupuesto+ · Cómo lo hicimos: la animación común (componentes/AnimacionSistema) con lo de este
 * demo: fragmentos del método de Bayes empírico y cifras de los datos (fuentes.json, resumen.json), y
 * en el mapa las zonas de barrio con siniestros graves en el último año (tenues) y las que escoge
 * Presupuesto+ con el presupuesto (verdes).
 */
import { useMemo } from 'react'
import Animacion, { type PuntoMapa, type TipoFragmento } from '../componentes/AnimacionSistema'
import { NOMBRE_MOVILIDAD } from '../config'
import { entero, millones, type DatosMovilidad } from './datos'
import { guionDe } from './guion'

export default function AnimacionSistema({ datos, auto }: { datos: DatosMovilidad; auto: boolean }) {
  const g = guionDe(datos)
  const r = datos.resumen
  const d = datos.fuentes.registros_analizados.detalle
  const [e0, e1] = r.periodo_estimacion
  const pres = datos.experiencia.pantalla_presupuesto_barrio.escenarios.bajo
  const fragmentos: [string, TipoFragmento][] = [
    ['κ = α·μ + (1 − α)·K', 'mate'], [`${entero(datos.fuentes.registros_analizados.total)} registros`, 'dato'], ['for zona in zonas:', 'codigo'],
    [`K = k${e0} + k${e1}`, 'mate'], [`${entero(d.siniestros_y_actores_viales_2023_2025)} siniestros y actores`, 'dato'], ['grupo = tipo de vía + largo', 'codigo'],
    ['α = μ / (μ + v)', 'mate'], [`${entero(d.vias_openstreetmap)} vías`, 'dato'], ['if vía == "barrio":', 'codigo'],
    ['riesgo = κ / 2 años', 'mate'], [`${entero(d.nodos_openstreetmap)} nodos`, 'dato'], [`ordenar(riesgo)[:${pres.esquinas}]`, 'codigo'],
    ['Σ costo ≤ presupuesto', 'mate'], [`${entero(r.universo.por_zona.local)} zonas de barrio`, 'dato'], ['{ "k_2024": 3 }', 'dato'],
    [`${millones(pres.presupuesto_millones)}`, 'dato'], ['μ, v por grupo', 'mate'], ['{ "zona_vial": "local" }', 'dato'],
  ]
  const s = datos.sitios
  const puntos = useMemo((): PuntoMapa[] => {
    const elegidas = new Set(g.comparacionPresupuesto.modelo.lista)
    const tenues: PuntoMapa[] = []
    for (let i = 0; i < s.n; i++) if (s.local[i] === 1 && s.k24[i] > 0 && !elegidas.has(i)) tenues.push({ lon: s.lon[i], lat: s.lat[i], clase: 'tenue' })
    return [...tenues, ...[...elegidas].map((i): PuntoMapa => ({ lon: s.lon[i], lat: s.lat[i], clase: 'elegida' }))]
  }, [g, s])
  const anillos = useMemo(() => datos.croquis.flatMap((c) => c.anillos), [datos])
  return (
    <Animacion fragmentos={fragmentos} bbox={datos.bboxCiudad} anillos={anillos} puntos={puntos} auto={auto}
               etiqueta={`Datos conectados, un modelo de Bayes empírico y las zonas que escoge ${NOMBRE_MOVILIDAD} en el mapa de Bogotá`}
               leyendas={{
                 datos: <><b>1 · Datos</b> conectados: siniestros, vías y zonas</>,
                 modelo: <><b>2 · Modelo</b>: Bayes empírico</>,
                 decision: <><b>3 · Decisión</b>: dónde invertir primero</>,
               }} />
  )
}
