import type { Datos } from '../datos'
import type { Modo } from '../modo'

export type EscenaId = 'espera' | 'problema' | 'hoy' | 'matricula' | 'como' | 'cierre'

export const ORDEN_ESCENAS: EscenaId[] = ['espera', 'problema', 'hoy', 'matricula', 'como', 'cierre']

export interface PropsEscena {
  datos: Datos
  localidad: string
  modo: Modo
  ir: (e: EscenaId) => void
  /** celular: abre la pantalla "Agendar cita" */
  alAgendar?: () => void
}
