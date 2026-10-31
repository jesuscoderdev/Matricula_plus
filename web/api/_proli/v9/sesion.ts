/**
 * La sesión de Proli V9 viaja firmada (HMAC-SHA256) entre el navegador y el servidor: el navegador la
 * guarda y la devuelve en cada turno, pero no puede cambiar los contadores ni el estado sin invalidar la
 * firma. Así el servidor aplica los límites (sección 3 de la especificación) aunque cada petición sea
 * independiente y sin depender de la base de datos en cada turno. Cada visitante es una sesión aislada.
 *
 * El secreto es PROLI_SECRETO (variable de entorno); si no existe, se deriva de la clave de la API de
 * Claude, que tampoco sale nunca del servidor.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

// Estados de negocio de V12 (sección 3): el campo esperado sale siempre de la etapa de ESTA sesión
export type Estado = 'ESPERA_ORGANIZACION' | 'ESPERA_ROL' | 'ESPERA_OBJETIVO' | 'HIPOTESIS_Y_FICHA' | 'AGENDA' | 'TERMINADO'
export type Canal = 'stand' | 'celular' | 'escritorio' | 'qr'

export interface Ficha {
  organizacion: string
  rol: string
  objetivo: string
  situacion: string
  hipotesis: string
  por_conocer: string
  meta_corta: string     // la meta en infinitivo, para el correo de recordatorio
}

export interface Sesion {
  v: 2
  id: string
  canal: Canal
  asesor: string | null
  estado: Estado
  seq: number             // último mensaje procesado (V12: se rechazan repetidos y fuera de orden)
  preguntas: number       // de descubrimiento, incluida la de la apertura (máximo 3)
  invalidos: number       // respuestas ajenas o sin sentido SEGUIDAS (a la segunda se cierra)
  desvios: number         // total de respuestas ajenas o sin sentido (para el CRM)
  candidato: string | null  // nombre atípico de organización esperando confirmación
  respuestas: number      // mensajes de Proli en la sesión (máximo global)
  h: { r: 'v' | 'p'; t: string }[]   // la conversación, solo texto (se descarta al cerrar)
  datos: { organizacion: string; rol: string; objetivo: string; situacion: string }
  ficha: Ficha | null
  creada: number
  ultima: number
}

export const MINUTOS_SESION = 30

const secreto = () => {
  const s = process.env.PROLI_SECRETO || (process.env.ANTHROPIC_API_KEY ? createHash('sha256').update(`proli-v9:${process.env.ANTHROPIC_API_KEY}`).digest('hex') : '')
  if (!s) throw new Error('sin_secreto')
  return s
}
const firmar = (cuerpo: string) => createHmac('sha256', secreto()).update(cuerpo).digest('base64url')

export function nuevaSesion(canal: Canal, asesor: string | null): Sesion {
  const ahora = Date.now()
  return {
    v: 2, id: randomUUID(), canal, asesor, estado: 'ESPERA_ORGANIZACION', seq: 0, preguntas: 1, invalidos: 0, desvios: 0, candidato: null, respuestas: 1,
    h: [], datos: { organizacion: '', rol: '', objetivo: '', situacion: '' }, ficha: null, creada: ahora, ultima: ahora,
  }
}

export function sellar(s: Sesion): string {
  const cuerpo = Buffer.from(JSON.stringify(s)).toString('base64url')
  return `${cuerpo}.${firmar(cuerpo)}`
}

/** La sesión si la firma es válida y no venció (minutos de gracia: el registro llega después del chat) */
export function abrir(token: unknown, minutos = MINUTOS_SESION): Sesion | null {
  if (typeof token !== 'string' || token.length > 40_000) return null
  const [cuerpo, firma] = token.split('.')
  if (!cuerpo || !firma) return null
  const esperada = Buffer.from(firmar(cuerpo))
  const recibida = Buffer.from(firma)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null
  try {
    const s = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf-8')) as Sesion
    if (s.v !== 2 || Date.now() - s.ultima > minutos * 60_000) return null
    return s
  } catch { return null }
}
