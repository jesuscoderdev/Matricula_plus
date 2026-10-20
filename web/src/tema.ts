/**
 * Tema claro / oscuro. Por defecto sigue al sistema; el botón ☾/☀ lo fija y se recuerda en
 * este navegador. Se refleja en <html data-tema="…"> (lo usan estilos.css y el mapa).
 */
import { useSyncExternalStore } from 'react'

export type Tema = 'claro' | 'oscuro'
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

const oyentes = new Set<() => void>()
function aplicar() {
  const t = actual()
  document.documentElement.dataset.tema = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'oscuro' ? '#13152b' : '#fbfaf7')
  oyentes.forEach((f) => f())
}
if (typeof document !== 'undefined') {
  aplicar()
  sistema?.addEventListener('change', aplicar)
}

export function alternarTema() {
  fijado = actual() === 'oscuro' ? 'claro' : 'oscuro'
  try { localStorage.setItem(CLAVE, fijado) } catch { /* sin almacenamiento: dura esta sesión */ }
  aplicar()
}

export function useTema(): Tema {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f) } }, actual, () => 'claro')
}
