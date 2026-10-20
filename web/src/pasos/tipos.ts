import type { Datos, Palancas, Resultado } from '../datos'
import type { Modo } from '../modo'
import type { PasoId } from '../componentes/BarraProgreso'
import type { SimHoy, SimPolitica } from '../simulacion'

export interface PropsPaso {
  datos: Datos
  modo: Modo
  palancas: Palancas
  cambiarPalancas: (p: Partial<Palancas>) => void
  /** cifras de Bogotá (precalculadas) */
  base: Resultado
  actual: Resultado
  /** el proceso corrido en el navegador: hoy (orden de llegada) y la política elegida */
  hoy: SimHoy
  politica: SimPolitica
  /** localidad que eligió el visitante (null = todavía no) */
  localidad: string | null
  elegirLocalidad: (l: string | null) => void
  /** modo auto: cambia para "apretar" el botón de asignar */
  disparoAuto: number
  ir: (p: PasoId | 'espera') => void
  /** celular: abre la pestaña "Agendar" */
  alAgendar?: () => void
}

/** Resumen en texto de la política elegida: "Prioridad: Equidad · colegio nuevo en Tibabuyes · sin jornada única" */
export function describirPalancas(d: Datos, p: Palancas) {
  const preset = d.indice.presets.find((x) => x.clave === p.preset)!
  const nuevo = d.indice.colegio_nuevo.find((c) => c.clave === p.colegioNuevo)
  return [
    `Prioridad: ${preset.etiqueta}`,
    nuevo ? `colegio nuevo en ${nuevo.etiqueta}` : 'sin colegio nuevo',
    p.jornadaUnica ? 'con jornada única' : 'sin jornada única',
  ].join(' · ')
}
