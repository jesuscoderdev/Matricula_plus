/**
 * Modo de la app según la URL:
 *  ?modo=stand → tótem vertical táctil (1080×1920, sin scroll, vuelve a "espera" tras inactividad)
 *  ?modo=auto  → tótem no táctil: el recorrido corre solo en bucle
 *  (sin parámetro) → celular (el visitante entra con el QR)
 */
export type Modo = 'stand' | 'auto' | 'celular'

export function leerModo(): Modo {
  const m = new URLSearchParams(window.location.search).get('modo')
  return m === 'stand' || m === 'auto' ? m : 'celular'
}

export const esTotem = (m: Modo) => m === 'stand' || m === 'auto'
