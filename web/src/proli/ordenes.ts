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
 * También guarda «qué está viendo el visitante» (informarPantalla), que Proli recibe como contexto,
 * el resumen del reto del visitante (para que la cita lo lleve escrito) y los pedidos a Proli desde
 * otras pantallas («Cuéntale tu reto a Proli»).
 */
import { useSyncExternalStore } from 'react'
import { selectorDe, senalar, visible } from './cursor'

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
 * Ejecuta una orden de Proli y devuelve qué pasó, en una frase (o las cifras que pidió). Antes,
 * Proli vuela hasta el control que va a cambiar y lo toca (cursor.tsx); si el control todavía no
 * está en pantalla, lo toca cuando aparece, como confirmación.
 */
export async function ejecutar(orden: Orden): Promise<string> {
  const selector = selectorDe(orden)
  // Si el control se conoce solo al aplicar la orden (el colegio sugerido), Proli lo toca después
  const estaba = !!selector && orden.nombre !== 'matricula_colegio_sugerido' && !!visible(selector)
  if (estaba) await senalar(selector!)
  const r = await aplicarOrden(orden)
  if (selector && !estaba) {
    await new Promise((ok) => setTimeout(ok, 450))   // a que la pantalla cambie
    if (visible(selector)) await senalar(selector)
  }
  return r
}

/** Aplica la orden. Si el demo no está abierto, lo abre y espera a que cargue para responder con el resultado real. */
function aplicarOrden(orden: Orden): Promise<string> {
  // El reto del visitante: se guarda para el mensaje de la cita y se lleva a la agenda
  if (orden.nombre === 'agendar_con_reto') {
    fijarReto(String(orden.entrada.resumen ?? ''))
    return aplicarOrden({ nombre: 'abrir_agenda', entrada: { demo: orden.entrada.demo } })
      .then((r) => `Listo: el mensaje de la cita ya lleva el reto escrito. ${r}`)
  }
  // La agenda vive dentro de cada demo
  if (orden.nombre === 'abrir_agenda') {
    const demo = orden.entrada.demo === 'matricula' ? 'matricula' : 'movilidad'
    return aplicarOrden(demo === 'movilidad'
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

// --- El reto del visitante: un resumen corto, sin datos personales, que va en el mensaje de la cita ---
const MAX_RETO = 280
let reto = ''
const oyentesReto = new Set<() => void>()
export function fijarReto(texto: string) {
  const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, MAX_RETO)
  if (limpio === reto) return
  reto = limpio
  oyentesReto.forEach((f) => f())
}
const leerReto = () => reto
export function useReto(): string {
  return useSyncExternalStore((f) => { oyentesReto.add(f); return () => { oyentesReto.delete(f) } }, leerReto, leerReto)
}

// --- Pedidos a Proli desde otras pantallas: abre la conversación con ese mensaje ---
const pedidos = new Set<(texto: string) => void>()
export function pedirAProli(texto: string) { pedidos.forEach((f) => f(texto)) }
export function alPedirAProli(f: (texto: string) => void): () => void {
  pedidos.add(f)
  return () => { pedidos.delete(f) }
}
