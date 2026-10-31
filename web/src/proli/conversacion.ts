/**
 * La conversación con Proli, compartida por el panel de los demos (Asistente.tsx) y la página propia
 * de Proli (PaginaProli.tsx, /proli).
 *
 * El navegador guarda el historial y lo manda a /api/proli (api/proli.ts), que llama a Claude. Cuando
 * Proli pide acciones (tool_use), se ejecutan aquí con src/proli/ordenes.ts y se le devuelve el
 * resultado; así hasta que Proli responde sin acciones (máximo MAX_PASOS por pregunta).
 *
 * El historial es de solo agregar: se reenvía tal como lo devolvió la API (con sus bloques de
 * razonamiento), nunca se edita. Si una respuesta termina en negativa o cortada, la conversación
 * siguiente empieza de cero. Nada de esto se guarda: vive en la memoria de la pestaña. Hay una sola
 * conversación por pestaña: sigue igual al pasar de la página de Proli a un demo y al revés.
 *
 * Sin conexión (o sin clave en el servidor), las preguntas sugeridas responden con su texto preparado
 * (`sinConexion`) y sus acciones locales.
 */
import { useSyncExternalStore } from 'react'
import type Anthropic from '@anthropic-ai/sdk'
import { ejecutar, leerPantalla, type Orden } from './ordenes'

type Mensaje = Anthropic.Beta.Messages.BetaMessageParam
type Bloque = Anthropic.Beta.Messages.BetaContentBlock

const MAX_PASOS = 4            // vueltas de acciones por pregunta
const MAX_PREGUNTAS = 12       // por conversación (en el stand, cada visitante tiene la suya)
const MAX_MENSAJES_HISTORIAL = 44 // el servidor acepta 60; cada pregunta con acciones suma unos 6
export const PAUSA_ACCION_MS = 350 // entre acciones, para que la pantalla alcance a cambiar
const URL = './api/proli'

/** Cómo empieza la «pantalla actual» mientras el visitante está en la página de Proli */
export const PANTALLA_PROLI = 'la conversación con Proli'

export interface Linea { quien: 'visitante' | 'proli' | 'accion' | 'aviso'; texto: string }
/** Después de abrir la agenda, el chat muestra al final cómo enviar la solicitud */
const ES_AGENDA = new Set(['abrir_agenda', 'agendar_con_reto'])
/** `conversar`: en vez de responder con algo guardado, abre la conversación con la IA (sin conexión, usa `sinConexion`). */
export interface Sugerencia { texto: string; ordenes?: Orden[]; sinConexion: string; conversar?: boolean }

/**
 * ¿Proli terminó proponiendo una acción de sí o no («¿Te llevo a Resultados?»)? Entonces va el botón
 * «Sí, muéstramelo». Una pregunta abierta («¿En qué secretaría trabajas?») no lo lleva.
 */
export function esPropuesta(texto: string) {
  const t = texto.trim()
  if (!t.endsWith('?')) return false
  const pregunta = t.slice(t.lastIndexOf('¿') + 1).toLowerCase()
  return !/^(qu[eé]|cu[aá]l(es)?|cu[aá]nt[oa]s?|d[oó]nde|c[oó]mo|cu[aá]ndo|qui[eé]n(es)?|por qu[eé]|para qu[eé]|en qu[eé]|de qu[eé]|a qu[eé]|con qu[eé])(?=[\s,?])/.test(pregunta)
}

export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Mantiene vivo el tótem mientras Proli habla o el visitante escribe (los temporizadores de inactividad escuchan pointerdown). */
export const avisarActividad = () => window.dispatchEvent(new Event('pointerdown'))

class SinConexion extends Error {}

/** Una llamada a /api/proli: transmite el texto mientras llega y devuelve el mensaje completo. */
async function llamar(mensajes: Mensaje[], alTexto: (d: string) => void, senal: AbortSignal): Promise<{ contenido: Bloque[]; stop: string }> {
  let r: Response
  try {
    r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensajes }), signal: senal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new SinConexion('red')
  }
  if (!r.ok || !r.body) throw new SinConexion(String(r.status))
  const lector = r.body.pipeThrough(new TextDecoderStream()).getReader()
  let resto = ''
  let fin: { contenido: Bloque[]; stop: string } | null = null
  for (;;) {
    const { value, done } = await lector.read()
    if (done) break
    resto += value
    let i
    while ((i = resto.indexOf('\n')) >= 0) {
      const linea = resto.slice(0, i).trim()
      resto = resto.slice(i + 1)
      if (!linea) continue
      const ev = JSON.parse(linea) as { t: string; d?: string; contenido?: Bloque[]; stop?: string }
      if (ev.t === 'texto' && ev.d) alTexto(ev.d)
      else if (ev.t === 'fin') fin = { contenido: ev.contenido ?? [], stop: ev.stop ?? 'end_turn' }
      else if (ev.t === 'error') throw new SinConexion(ev.d ?? 'fallo')
    }
  }
  if (!fin) throw new SinConexion('incompleto')
  return fin
}

// --- Una sola conversación por pestaña: la ven igual el panel de los demos y la página de Proli, así
// que sigue cuando el visitante pasa de una a otra ---
interface Estado { lineas: Linea[]; ocupado: boolean; sinConexion: boolean; cita: boolean }
let estado: Estado = { lineas: [], ocupado: false, sinConexion: false, cita: false }
const oyentes = new Set<() => void>()
const cambiar = (c: Partial<Estado> | ((e: Estado) => Partial<Estado>)) => {
  estado = { ...estado, ...(typeof c === 'function' ? c(estado) : c) }
  oyentes.forEach((f) => f())
}
let historial: Mensaje[] = []
let contextoEnviado = ''
let preguntas = 0
let cancelar: AbortController | null = null

export function reiniciar() {
  cancelar?.abort()
  historial = []; contextoEnviado = ''; preguntas = 0
  cambiar({ lineas: [], ocupado: false, cita: false })
}

export const agregar = (l: Linea) => cambiar((e) => ({ lineas: [...e.lineas, l] }))
/** Agrega texto a la última línea de Proli (la que se está escribiendo). */
const escribir = (d: string) => cambiar(({ lineas: x }) => {
  const u = x[x.length - 1]
  return { lineas: u?.quien === 'proli' ? [...x.slice(0, -1), { ...u, texto: u.texto + d }] : [...x, { quien: 'proli', texto: d }] }
})

async function responderSinConexion(s?: Sugerencia) {
  cambiar({ sinConexion: true })
  if (s) {
    for (const o of s.ordenes ?? []) { await ejecutar(o); await dormir(PAUSA_ACCION_MS) }
    agregar({ quien: 'proli', texto: s.sinConexion })
    if (s.ordenes?.some((o) => ES_AGENDA.has(o.nombre))) cambiar({ cita: true })
  } else {
    agregar({ quien: 'proli', texto: 'Ahora no tengo conexión para conversar, pero puedo llevarte a donde quieras con estas opciones.' })
  }
}

export async function preguntar(pregunta: string, s?: Sugerencia) {
  if (estado.ocupado || !pregunta.trim()) return
  agregar({ quien: 'visitante', texto: pregunta })
  if (preguntas >= MAX_PREGUNTAS) {
    agregar({ quien: 'aviso', texto: 'Esta conversación ya va larga. Toca «Reiniciar» y seguimos con gusto.' })
    return
  }
  preguntas++
  // El servidor acepta hasta 60 mensajes: antes de llegar, Proli empieza una conversación nueva
  if (historial.length > MAX_MENSAJES_HISTORIAL) { historial = []; contextoEnviado = '' }
  cambiar({ ocupado: true })
  const control = new AbortController()
  cancelar = control
  const h = historial          // si el visitante reinicia a mitad de camino, esta conversación se abandona
  // Contexto de pantalla: va como mensaje de sistema solo cuando cambió (el historial no se edita)
  const conContexto = () => {
    const c = `Pantalla actual: ${leerPantalla()}`
    if (c !== contextoEnviado) { h.push({ role: 'system', content: c }); contextoEnviado = c }
  }
  try {
    h.push({ role: 'user', content: pregunta.slice(0, 500) })
    conContexto()
    for (let paso = 0; paso < MAX_PASOS; paso++) {
      const { contenido, stop } = await llamar(h, (d) => { escribir(d); avisarActividad() }, control.signal)
      if (control.signal.aborted || historial !== h) return
      h.push({ role: 'assistant', content: contenido as unknown as Anthropic.Beta.Messages.BetaContentBlockParam[] })
      cambiar({ sinConexion: false })
      if (stop === 'refusal' || stop === 'max_tokens') {
        // No se ejecutan acciones a medias; la próxima pregunta empieza una conversación nueva
        if (stop === 'refusal') agregar({ quien: 'proli', texto: 'Prefiero no meterme en ese tema, pero con gusto te muestro algo de los demos. ¿Te parece?' })
        historial = []; contextoEnviado = ''
        break
      }
      const acciones = contenido.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use')
      if (!acciones.length) break
      const resultados: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = []
      for (const a of acciones) {
        const resultado = await ejecutar({ nombre: a.name, entrada: (a.input ?? {}) as Record<string, unknown> })
        resultados.push({ type: 'tool_result', tool_use_id: a.id, content: resultado })
        // El visitante ve qué hizo Proli en la pantalla (y por qué cambió). Las consultas de cifras
        // traen «resumen | detalle»: en el panel va solo el resumen; Proli recibe todo
        agregar({ quien: 'accion', texto: resultado.split(' | ')[0].replace(/^Listo: /, '').replace(/ Listo: /, ' ') })
        if (ES_AGENDA.has(a.name)) cambiar({ cita: true })
        await dormir(PAUSA_ACCION_MS)
        if (control.signal.aborted || historial !== h) return
      }
      h.push({ role: 'user', content: resultados })
      conContexto()
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      // Se descarta el turno a medias para que el historial siga siendo válido
      historial = []; contextoEnviado = ''
      await responderSinConexion(s)
    }
  } finally {
    // Si el visitante reinició a mitad de camino, la conversación nueva no queda «ocupada»
    if (cancelar === control) cambiar({ ocupado: false })
    avisarActividad()
  }
}

/** La conversación (compartida) y cómo seguirla */
export function useConversacion() {
  const e = useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f) } }, () => estado, () => estado)
  return { ...e, agregar, preguntar, reiniciar }
}
