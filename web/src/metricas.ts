/**
 * Las 5 métricas del simulador: cómo se llaman, en qué unidad van y cuál dirección es "mejor".
 * El significado nunca va solo en el color: cada delta lleva signo, flecha y palabra.
 */
import { conSigno, decimal, dosDecimales, type ClaveMetrica } from './datos'

export interface InfoMetrica {
  clave: ClaveMetrica
  etiqueta: string
  unidad: '%' | 'km'
  mejorSiBaja: boolean
  fmt: (n: number) => string
}

// Orden de las tarjetas: primero lo que más importa a un tomador de decisión
export const METRICAS: InfoMetrica[] = [
  { clave: 'pct_sin_cupo_zona_critica', etiqueta: 'sin cupo en la zona crítica', unidad: '%', mejorSiBaja: true, fmt: decimal },
  { clave: 'pct_sin_cupo', etiqueta: 'sin cupo en sus 3 opciones', unidad: '%', mejorSiBaja: true, fmt: decimal },
  { clave: 'pct_vulnerables_sin_cupo', etiqueta: 'de los niños vulnerables, sin cupo', unidad: '%', mejorSiBaja: true, fmt: decimal },
  { clave: 'pct_primera_opcion', etiqueta: 'en su 1.ª opción', unidad: '%', mejorSiBaja: false, fmt: decimal },
  { clave: 'distancia_prom_km', etiqueta: 'distancia promedio casa–colegio', unidad: 'km', mejorSiBaja: true, fmt: dosDecimales },
]

export type Sentido = 'mejor' | 'peor' | 'igual'

/** Cambio frente a la base, con texto: "−0,8 pts · mejor" */
export function describirDelta(info: InfoMetrica, valor: number, base: number) {
  const d = valor - base
  const umbral = info.unidad === 'km' ? 0.005 : 0.05
  const sentido: Sentido = Math.abs(d) < umbral ? 'igual' : (d < 0) === info.mejorSiBaja ? 'mejor' : 'peor'
  const unidad = info.unidad === '%' ? ' pts' : ' km'
  const flecha = sentido === 'igual' ? '=' : d < 0 ? '▼' : '▲'
  const texto = sentido === 'igual' ? 'igual que hoy' : `${conSigno(d, info.fmt)}${unidad} · ${sentido}`
  return { d, sentido, flecha, texto }
}
