/**
 * Canal entre Proli y la interfaz. Proli (la IA) pide acciones con nombre y entrada
 * (p. ej. movilidad_lista {lista: 'modelo'}); aquí se reparten al componente que las sabe hacer:
 *  · «inicio»    → Inicio.tsx (portada, conozca a Proli, elegir demo, abrir un demo)
 *  · «movilidad» → movilidad/Movilidad.tsx
 *  · «matricula» → matricula/Matricula.tsx (Matrícula+)
 * Si el demo de una orden no está abierto, se abre y la orden espera a que el demo cargue sus datos.
 *
 * Cada componente valida la entrada contra sus propios datos (nombres de localidad, capítulos…):
 * la IA no puede mover nada que no exista. Solo se mueven pantallas y controles; nada sale de aquí.
 *
 * También guarda «qué está viendo el visitante» (informarPantalla), que Proli recibe como contexto,
 * el resumen del reto del visitante (para que la cita lo lleve escrito) y el paso a la página de
 * Proli desde otras pantallas («Contarle mi reto a Proli»).
 */
import { useSyncExternalStore } from 'react'
import { selectorDe, senalar, visible } from './cursor'
import { NOMBRE_MOVILIDAD } from '../config'
import { esTotem, leerModo } from '../modo'

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
  const estaba = !!selector && !!visible(selector)
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
  // Proli V9: el reto se cuenta y la cita se agenda en la página de Proli (descubrimiento breve, ficha y
  // formulario), no en el panel. El panel solo lleva al visitante allá
  if (orden.nombre === 'agendar_con_reto') {
    irAProli()
    return Promise.resolve('Listo: abrí la conversación de Proli para que cuentes tu meta. | La conversación sigue en esa pantalla, que hace sus propias preguntas: no hagas más preguntas aquí ni pidas datos.')
  }
  // El visitante retiró su permiso: el mensaje y el QR de la cita vuelven a ser genéricos
  if (orden.nombre === 'borrar_reto') {
    fijarReto('')
    return Promise.resolve('Listo: se borraron el nombre, la entidad y el reto del mensaje de WhatsApp y del código QR; ahora son genéricos.')
  }
  if (orden.nombre === 'abrir_agenda') {
    irAProli({ agenda: true })
    return Promise.resolve('Listo: abrí el formulario para agendar 20 minutos con el equipo. | El visitante llena ahí sus datos y elige cuándo le queda mejor; el equipo le confirma el horario por correo. No pidas datos en este chat ni digas que la cita quedó confirmada.')
  }
  const ambito = ambitoDe(orden.nombre)
  const manejador = manejadores.get(ambito)
  if (manejador) return Promise.resolve(aplicar(manejador, orden))
  if (ambito === 'inicio') return Promise.resolve('La pantalla todavía no está lista; intenta de nuevo en un momento.')
  const nombreDemo = ambito === 'movilidad' ? NOMBRE_MOVILIDAD : 'Matrícula+'
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

/**
 * Lo que cada demo responde cuando abre la agenda («resumen | detalle»): el resumen lo ve el visitante
 * en el chat; el detalle le dice a Proli qué hay de verdad en pantalla para enviar la solicitud, que
 * cambia según el modo. En el tótem solo sirve el código QR (nadie escanea su propia pantalla en el
 * celular); en celular y computador, el botón abre WhatsApp con el mensaje ya escrito.
 */
export function agendaAbierta(): string {
  const resumen = reto ? 'Listo: tu reto quedó escrito en el mensaje para el equipo.' : 'Listo: en pantalla, cómo escribirle al equipo.'
  const modo = leerModo()
  const boton = `En la pantalla y en este chat está el botón «${BOTON_WHATSAPP(!!reto)}», que abre WhatsApp con el mensaje ya escrito.`
  const como = esTotem(modo)
    ? 'Es el tótem: el visitante envía la solicitud escaneando con su celular el código QR, que está en la pantalla y en este chat. No hay botón para enviarla desde aquí: no menciones ningún botón.'
    : modo === 'celular'
      ? `${boton} Está en su celular: dile que toque ese botón (no menciones el código QR).`
      : `${boton} Está en un computador: también puede escanear el código QR de la pantalla con su celular.`
  return `${resumen} | ${como} El visitante envía el mensaje él mismo y el equipo le responde para confirmar un horario: todavía no es una cita.`
}
/** El botón que abre WhatsApp (celular y computador): con el reto ya escrito o para escribir desde cero. */
export const BOTON_WHATSAPP = (conReto: boolean) => (conReto ? 'Enviar mi reto por WhatsApp' : 'Agendar conversación')

// --- El reto del visitante: un resumen corto, sin datos personales, que va en el mensaje de la cita ---
const MAX_RETO = 500
let reto = ''
const oyentesReto = new Set<() => void>()
export function fijarReto(texto: string) {
  const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, MAX_RETO)
  if (limpio === reto) return
  reto = limpio
  oyentesReto.forEach((f) => f())
}
export const leerReto = () => reto
export function useReto(): string {
  return useSyncExternalStore((f) => { oyentesReto.add(f); return () => { oyentesReto.delete(f) } }, leerReto, leerReto)
}

// --- «Contarle mi reto a Proli» (al final de cada demo y al elegir reto): lleva a la página de Proli ---
export interface IrAProli { agenda?: boolean }
const pedidos = new Set<(o: IrAProli) => void>()
/** A la página de Proli; con `agenda`, directo al formulario de la cita (V9, caso C11) */
export function irAProli(o: IrAProli = {}) { pedidos.forEach((f) => f(o)) }
export function alIrAProli(f: (o: IrAProli) => void): () => void {
  pedidos.add(f)
  return () => { pedidos.delete(f) }
}

// --- La agenda dentro de la página de Proli: mientras está abierta, la cita (QR o botón de WhatsApp)
// aparece en su chat y Proli no saca al visitante a un demo para agendar ---
let agendaEnPagina: (() => string) | null = null
export function fijarAgendaEnPagina(f: () => string): () => void {
  agendaEnPagina = f
  return () => { if (agendaEnPagina === f) agendaEnPagina = null }
}
