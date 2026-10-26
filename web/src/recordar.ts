/**
 * Dónde iba el visitante, para que recargar la página no lo devuelva a la portada. Se guarda en
 * esta pestaña (sessionStorage): al cerrarla se olvida. En el modo automático no se recuerda nada:
 * el recorrido siempre empieza en la portada.
 */
import { leerModo } from './modo'

const PREFIJO = 'matricula-donde:'
const activo = () => leerModo() !== 'auto'

export function recordado<T>(clave: string): T | null {
  if (!activo()) return null
  try {
    const v = sessionStorage.getItem(PREFIJO + clave)
    return v ? (JSON.parse(v) as T) : null
  } catch { return null }
}

export function recordar(clave: string, valor: unknown) {
  if (!activo()) return
  try { sessionStorage.setItem(PREFIJO + clave, JSON.stringify(valor)) } catch { /* sin almacenamiento: no se recuerda */ }
}
