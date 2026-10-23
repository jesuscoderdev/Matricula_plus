import type { Datos } from '../datos'
import type { Supuestos } from '../motor'
import type { Palancas, Resultados } from '../estado'
import type { Modo } from '../modo'

export type Capitulo = 'problema' | 'accion' | 'resultado' | 'laboratorio' | 'metodo'
export type Extra = 'caso' | 'explorar' | 'agendar'
export type Vista = 'portada' | Capitulo | Extra

export const CAPITULOS: { id: Capitulo; nombre: string }[] = [
  { id: 'problema', nombre: 'Problema' },
  { id: 'accion', nombre: 'Acción' },
  { id: 'resultado', nombre: 'Resultado' },
  { id: 'laboratorio', nombre: 'Supuestos' },
  { id: 'metodo', nombre: 'Método' },
]
export const numeroDe = (c: Capitulo) => String(CAPITULOS.findIndex((x) => x.id === c) + 1).padStart(2, '0')
export const kicker = (c: Capitulo, extra?: string) =>
  `${numeroDe(c)} · ${CAPITULOS.find((x) => x.id === c)!.nombre}${extra ? ` · ${extra}` : ''}`

/** Lo que todos los capítulos reciben de App */
export interface PropsCapitulo {
  datos: Datos
  r: Resultados
  modo: Modo
  supuestos: Supuestos
  cambiarSupuestos: (c: Partial<Supuestos>) => void
  restaurarSupuestos: () => void
  palancas: Palancas
  cambiarPalancas: (c: Partial<Palancas>) => void
  localidad: string | null
  elegirLocalidad: (l: string | null) => void
  ir: (v: Vista) => void
  /** proceso animado en el mapa */
  terminado: boolean
  repetir: () => void
  /** volver a la página de inicio (elegir proyecto) */
  alInicio?: () => void
  /** el logo de Proliferante lleva a la portada del stand */
  alPortada?: () => void
}
