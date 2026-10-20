/**
 * Modo de la app según la URL (y la pantalla, si no se indica):
 *  ?modo=stand      → tótem vertical táctil (1080×1920, sin scroll, vuelve a "espera" tras inactividad)
 *  ?modo=auto       → tótem no táctil: el recorrido corre solo en bucle
 *  ?modo=celular    → celular (diseño 390×844, barra inferior)
 *  ?modo=escritorio → PC / pantalla ancha (mapa grande a la izquierda, panel a la derecha)
 *  sin parámetro    → escritorio si la pantalla es ancha y horizontal; si no, celular
 */
export type Modo = 'stand' | 'auto' | 'celular' | 'escritorio'

const forzado = () => {
  const m = new URLSearchParams(window.location.search).get('modo')
  if (m === 'web') return 'escritorio'
  return m === 'stand' || m === 'auto' || m === 'celular' || m === 'escritorio' ? m : null
}

export const esPantallaAncha = () => window.innerWidth >= 900 && window.innerWidth > window.innerHeight

export function leerModo(): Modo {
  return forzado() ?? (esPantallaAncha() ? 'escritorio' : 'celular')
}

/** ¿El modo se decidió por el tamaño de la pantalla? (entonces cambia al redimensionar) */
export const modoAutomatico = () => forzado() === null

export const esTotem = (m: Modo) => m === 'stand' || m === 'auto'

/** URL de la app en otro modo (para los accesos de la pantalla de inicio) */
export const urlModo = (m: Modo) => `${window.location.pathname}?modo=${m}`
