/**
 * Canal entre Proli y la interfaz. Proli (la IA) pide acciones con nombre y entrada
 * (p. ej. movilidad_presupuesto {nivel: 'medio'}); aquí se reparten al componente que las sabe hacer:
 *  · «inicio»    → Inicio.tsx (portada, conozca a Proli, elegir demo, abrir un demo)
 *  · «movilidad» → movilidad/Movilidad.tsx
 *  · «matricula» → App.tsx (Matrícula+)
 * Si el demo de una orden no está abierto, se abre y la orden espera a que el demo cargue sus datos.
 *
 * Cada componente valida la entrada contra sus propios datos (nombres de localidad, capítulos…):
 * la IA no puede mover nada que no exista. Solo se mueven pantallas y controles; nada sale de aquí.
 *
 * También guarda «qué está viendo el visitante» (informarPantalla), que Proli recibe como contexto.
 */
import { useSyncExternalStore } from 'react'

export type Ambito = 'inicio' | 'movilidad' | 'matricula'
export interface Orden { nombre: string; entrada: Record<string, unknown> }
/** Devuelve el texto que Proli recibe como resultado de la acción. */
export type Manejador = (o: Orden) => string

const manejadores = new Map<Ambito, Manejador>()
// Órdenes para un demo que se está abriendo: se aplican (y responden) cuando el demo carga
let pendientes: { orden: Orden; responder: (r: string) => void }[] = []
const ESPERA_DEMO_MS = 15_000

const ambitoDe = (nombre: string): Ambito =>
  nombre.startsWith('movilidad_') ? 'movilidad' : nombre.startsWith('matricula_') ? 'matricula' : 'inicio'

const aplicar = (manejador: Manejador, o: Orden) => {
  try { return manejador(o) } catch (e) { return `No se pudo: ${String(e)}` }
}

/**
 * Un componente se registra cuando ya puede atender órdenes (con sus datos cargados) y atiende en
 * ese momento las que estaban esperando. Devuelve la función para darse de baja.
 */
export function registrar(ambito: Ambito, manejador: Manejador): () => void {
  manejadores.set(ambito, manejador)
  const mias = pendientes.filter((p) => ambitoDe(p.orden.nombre) === ambito)
  pendientes = pendientes.filter((p) => ambitoDe(p.orden.nombre) !== ambito)
  mias.forEach((p) => p.responder(aplicar(manejador, p.orden)))
  return () => { if (manejadores.get(ambito) === manejador) manejadores.delete(ambito) }
}

/**
 * Ejecuta una orden de Proli y devuelve qué pasó, en una frase (o las cifras que pidió). Si el demo
 * no está abierto, lo abre y espera a que cargue para responder con el resultado real.
 */
export function ejecutar(orden: Orden): Promise<string> {
  // La agenda vive dentro de cada demo
  if (orden.nombre === 'abrir_agenda') {
    const demo = orden.entrada.demo === 'matricula' ? 'matricula' : 'movilidad'
    return ejecutar(demo === 'movilidad'
      ? { nombre: 'movilidad_capitulo', entrada: { capitulo: 'cierre' } }
      : { nombre: 'matricula_capitulo', entrada: { capitulo: 'agendar' } })
  }
  const ambito = ambitoDe(orden.nombre)
  const manejador = manejadores.get(ambito)
  if (manejador) return Promise.resolve(aplicar(manejador, orden))
  if (ambito === 'inicio') return Promise.resolve('La pantalla todavía no está lista; intente de nuevo en un momento.')
  const nombreDemo = ambito === 'movilidad' ? 'Movilidad+' : 'Matrícula+'
  return new Promise((resolver) => {
    const pendiente = { orden, responder: (r: string) => { window.clearTimeout(id); resolver(`Se abrió ${nombreDemo}. ${r}`) } }
    const id = window.setTimeout(() => {
      pendientes = pendientes.filter((p) => p !== pendiente)
      resolver(`${nombreDemo} tardó en cargar; la acción no se aplicó.`)
    }, ESPERA_DEMO_MS)
    pendientes.push(pendiente)
    manejadores.get('inicio')?.({ nombre: 'abrir_demo', entrada: { demo: ambito } })
  })
}

// --- Qué está viendo el visitante ---
let pantalla = 'portada del stand'
const oyentes = new Set<() => void>()
export function informarPantalla(texto: string) {
  if (texto === pantalla) return
  pantalla = texto
  oyentes.forEach((f) => f())
}
export const leerPantalla = () => pantalla
export function usePantalla(): string {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f) } }, leerPantalla, leerPantalla)
}
