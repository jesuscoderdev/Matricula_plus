/**
 * Tema claro / oscuro. El visitante elige en el selector: «Sistema» (sigue al dispositivo, por
 * defecto), «Claro» u «Oscuro»; la elección se recuerda en este navegador. El tema que resulta se
 * refleja en <html data-tema="…"> (lo usan estilos.css y el mapa).
 */
import { useSyncExternalStore } from 'react'

export type Tema = 'claro' | 'oscuro'
export type Preferencia = 'sistema' | Tema
const CLAVE = 'matricula-tema'
const sistema = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function leerFijado(): Tema | null {
  try {
    const v = localStorage.getItem(CLAVE)
    return v === 'claro' || v === 'oscuro' ? v : null
  } catch { return null }
}
let fijado = leerFijado()
const actual = (): Tema => fijado ?? (sistema?.matches ? 'oscuro' : 'claro')
const preferencia = (): Preferencia => fijado ?? 'sistema'

const oyentes = new Set<() => void>()
function aplicar() {
  const t = actual()
  document.documentElement.dataset.tema = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'oscuro' ? '#162b2a' : '#ffffff')
  oyentes.forEach((f) => f())
}
if (typeof document !== 'undefined') {
  aplicar()
  sistema?.addEventListener('change', aplicar)
}

/** Fija el tema (o vuelve a seguir al sistema). */
export function elegirTema(p: Preferencia) {
  fijado = p === 'sistema' ? null : p
  try {
    if (fijado) localStorage.setItem(CLAVE, fijado)
    else localStorage.removeItem(CLAVE)
  } catch { /* sin almacenamiento: dura esta sesión */ }
  aplicar()
}

const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f) } }
export function useTema(): Tema {
  return useSyncExternalStore(suscribir, actual, () => 'claro')
}
export function usePreferenciaTema(): Preferencia {
  return useSyncExternalStore(suscribir, preferencia, () => 'sistema')
}
