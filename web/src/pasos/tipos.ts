import type { Datos, Palancas, Resultado } from '../datos'
import type { Modo } from '../modo'
import type { PasoId } from '../componentes/BarraProgreso'

export interface PropsPaso {
  datos: Datos
  modo: Modo
  palancas: Palancas
  cambiarPalancas: (p: Partial<Palancas>) => void
  base: Resultado
  actual: Resultado
  ir: (p: PasoId | 'espera') => void
  /** celular: abre la pestaña "Agendar" */
  alAgendar?: () => void
}

/** Resumen en texto de la política elegida: "Equidad · colegio en Tibabuyes · sin jornada única" */
export function describirPalancas(d: Datos, p: Palancas) {
  const preset = d.indice.presets.find((x) => x.clave === p.preset)!
  const nuevo = d.indice.colegio_nuevo.find((c) => c.clave === p.colegioNuevo)
  return [
    `Prioridad: ${preset.etiqueta}`,
    nuevo ? `colegio nuevo en ${nuevo.etiqueta}` : 'sin colegio nuevo',
    p.jornadaUnica ? 'con jornada única' : 'sin jornada única',
  ].join(' · ')
}
