/**
 * Proli: la conversación breve de descubrimiento (POST /api/conversa). Cada petición es un turno:
 *   entrada: { token?, texto, seq, request_id, canal?, asesor? }  ·  { accion: 'reiniciar', token }
 *   salida:  { token, session_id, seq, mensaje, accion: 'chat'|'ficha'|'agenda'|'cerrado'|'terminado', ficha, estado }
 *
 * La apertura la muestra el navegador sin llamar aquí; el primer turno crea la sesión. Las transiciones las
 * decide el controlador (api/_proli/v9/controlador.ts); el modelo solo clasifica y escribe el cierre, con
 * JSON de esquema fijo. Aislamiento (V12, sección 7.4): cada sesión tiene token firmado, `seq` que solo
 * avanza de uno en uno y, con Supabase, revocación al reiniciar y reintentos idempotentes (mismo
 * `request_id` → misma respuesta, sin volver a consultar al modelo). La clave de Claude vive solo aquí.
 */
import Anthropic from '@anthropic-ai/sdk'
import { LITERAL, PROMPT_V9 } from './_proli/v9/prompt.js'
import { turno, MAX_TEXTO_VISITANTE, type Analisis, type Cierre, type Modelo } from './_proli/v9/controlador.js'
import { abrir, nuevaSesion, sellar, type Canal, type Sesion } from './_proli/v9/sesion.js'
import { asesorPorId } from './_proli/v9/asesores.js'
import { guardarSesion, hayAlmacen, leerSesion, revocarSesion } from './_proli/v9/almacen.js'

declare const process: { env: Record<string, string | undefined> }

const MODELO = 'claude-opus-5-5'
const CANALES = new Set<Canal>(['stand', 'celular', 'escritorio', 'qr'])
const PETICIONES_POR_VENTANA = 200
const VENTANA_MS = 10 * 60_000

// Solo instrucciones públicas en caché (V12, C39): nada del visitante
const SISTEMA: Anthropic.Beta.Messages.BetaTextBlockParam[] = [{
  type: 'text', text: `${PROMPT_V9}\n\nLa apertura ya se mostró en pantalla: «${LITERAL.apertura}». El primer mensaje del visitante responde a ella.`,
  cache_control: { type: 'ephemeral', ttl: '1h' },
}]

const texto = (descripcion: string) => ({ type: 'string', description: descripcion })
const ESQUEMA_ANALISIS = {
  type: 'object', additionalProperties: false,
  properties: {
    intencion: { type: 'string', enum: ['NINGUNA', 'AGENDA_DIRECTA', 'SALIR', 'PREGUNTA_PROLI', 'ABUSO_O_INYECCION'] },
    calidad: { type: 'string', enum: ['DATO_VALIDO', 'OMISION_EXPLICITA', 'FUERA_DE_TEMA', 'TEXTO_ALEATORIO_PROBABLE', 'AMBIGUO'] },
    organizacion: texto('Organización declarada en este mensaje; vacío si no la dijo.'),
    rol: texto('Rol o área declarada en este mensaje; vacío si no la dijo.'),
    objetivo: texto('Meta declarada en este mensaje, en sus palabras; vacío si no la dijo.'),
    situacion: texto('Dificultad declarada en este mensaje; vacío si no la dijo.'),
  },
  required: ['intencion', 'calidad', 'organizacion', 'rol', 'objetivo', 'situacion'],
}
const ESQUEMA_CIERRE = {
  type: 'object', additionalProperties: false,
  properties: {
    mensaje: texto('Cierre: objetivo, una hipótesis por validar, capacidad e invitación a 20 minutos.'),
    hipotesis: texto('La hipótesis sola, en una frase.'),
    por_conocer: texto('Qué habría que contrastar en una reunión, en una frase.'),
    meta_corta: texto('La meta en infinitivo y minúscula, para «En GovTech nos contaste que querías …».'),
  },
  required: ['mensaje', 'hipotesis', 'por_conocer', 'meta_corta'],
}

const visitas = new Map<string, number[]>()
function permitido(ip: string): boolean {
  const ahora = Date.now()
  const lista = (visitas.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS)
  if (lista.length >= PETICIONES_POR_VENTANA) return false
  lista.push(ahora)
  visitas.set(ip, lista)
  if (visitas.size > 5000) visitas.clear()
  return true
}

function mismoSitio(request: Request): boolean {
  const sitio = request.headers.get('sec-fetch-site')
  if (sitio && sitio !== 'same-origin') return false
  const origen = request.headers.get('origin')
  if (!origen) return true
  try { return new URL(origen).host === new URL(request.url).host } catch { return false }
}

const json = (status: number, datos: unknown) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

/** Las dos tareas del modelo, con SOLO la conversación de esta sesión (V12: aislamiento) */
function modeloPara(cliente: Anthropic, s: Sesion, signal: AbortSignal): Modelo {
  const pedir = async <T>(tarea: string, nota: string, esquema: Record<string, unknown>): Promise<Partial<T>> => {
    const mensajes: Anthropic.Beta.Messages.BetaMessageParam[] = []
    for (const linea of s.h) {
      const rol = linea.r === 'v' ? 'user' : 'assistant'
      const ultimo = mensajes[mensajes.length - 1]
      if (ultimo?.role === rol) (ultimo.content as Anthropic.Beta.Messages.BetaTextBlockParam[]).push({ type: 'text', text: linea.t })
      else mensajes.push({ role: rol, content: [{ type: 'text', text: linea.t }] })
    }
    const ultimo = mensajes[mensajes.length - 1]
    ;(ultimo.content as Anthropic.Beta.Messages.BetaTextBlockParam[]).push({ type: 'text', text: `<controlador>TAREA ${tarea}. ${nota}</controlador>` })
    const r = await cliente.beta.messages.create({
      model: MODELO,
      max_tokens: 1500,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: esquema } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SISTEMA,
      messages: mensajes,
    }, { signal })
    const u = r.usage
    console.log(`[proli-v9] ${tarea} tokens entrada=${u.input_tokens} cache_leida=${u.cache_read_input_tokens ?? 0} salida=${u.output_tokens} stop=${r.stop_reason}`)
    if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') throw new Error(`sin_respuesta ${r.stop_reason}`)
    const t = r.content.filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text').map((b) => b.text).join('')
    try { return JSON.parse(t) as Partial<T> } catch { throw new Error(`json ${r.stop_reason}`) }
  }
  return {
    analizar: async (nota) => {
      const a = await pedir<Analisis>('CLASIFICAR', nota, ESQUEMA_ANALISIS)
      return { intencion: a.intencion ?? 'NINGUNA', calidad: a.calidad ?? 'AMBIGUO', organizacion: a.organizacion ?? '', rol: a.rol ?? '', objetivo: a.objetivo ?? '', situacion: a.situacion ?? '' }
    },
    cerrar: async (nota) => {
      const c = await pedir<Cierre>('CERRAR', nota, ESQUEMA_CIERRE)
      return { mensaje: c.mensaje ?? '', hipotesis: c.hipotesis ?? '', por_conocer: c.por_conocer ?? '', meta_corta: c.meta_corta ?? '' }
    },
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'sin_clave' })
  if (!mismoSitio(request)) return json(403, { error: 'origen' })
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local'
  if (!permitido(ip)) return json(429, { error: 'demasiadas_peticiones' })
  const crudo = await request.text()
  if (crudo.length > 60_000) return json(413, { error: 'muy_largo' })
  let cuerpo: { token?: unknown; texto?: unknown; canal?: unknown; asesor?: unknown; seq?: unknown; request_id?: unknown; accion?: unknown }
  try { cuerpo = JSON.parse(crudo) } catch { return json(400, { error: 'json' }) }

  // Reiniciar (V12, reset_session): se revoca la sesión; su token ya no sirve
  if (cuerpo.accion === 'reiniciar') {
    const viejo = abrir(cuerpo.token, 24 * 60)
    if (viejo && hayAlmacen()) {
      try { await revocarSesion(viejo.id) } catch (e) { console.error('[proli-v9] revocar', e instanceof Error ? e.message : e) }
    }
    return json(200, { ok: true })
  }

  const dice = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim() : ''
  if (!dice || dice.length > MAX_TEXTO_VISITANTE) return json(400, { error: 'texto' })
  const seq = typeof cuerpo.seq === 'number' && Number.isInteger(cuerpo.seq) ? cuerpo.seq : NaN
  const peticion = typeof cuerpo.request_id === 'string' && /^[\w-]{8,64}$/.test(cuerpo.request_id) ? cuerpo.request_id : ''
  if (!peticion || !(seq >= 1)) return json(400, { error: 'secuencia' })

  let s: Sesion | null
  if (cuerpo.token !== undefined && cuerpo.token !== null) {
    s = abrir(cuerpo.token)
    if (!s) return json(401, { error: 'sesion' })
  } else {
    if (seq !== 1) return json(409, { error: 'secuencia' })
    const canal = CANALES.has(cuerpo.canal as Canal) ? (cuerpo.canal as Canal) : 'celular'
    s = nuevaSesion(canal, asesorPorId(typeof cuerpo.asesor === 'string' ? cuerpo.asesor : null)?.id ?? null)
  }

  // Estado de la sesión en el servidor: revocada, reintento idempotente o mensaje fuera de orden
  if (hayAlmacen() && s.seq > 0) {
    try {
      const fila = await leerSesion(s.id)
      if (fila?.revoked_at) return json(410, { error: 'sesion_cerrada' })
      if (fila && fila.message_seq === seq && fila.last_request_id === peticion && fila.last_response) return json(200, fila.last_response)
      if (fila && fila.message_seq >= seq) return json(409, { error: 'secuencia' })
    } catch (e) { console.error('[proli-v9] leer sesión', e instanceof Error ? e.message : e) }
  }
  if (seq !== s.seq + 1) return json(409, { error: 'secuencia' })

  try {
    const t = await turno(s, dice, modeloPara(new Anthropic(), s, request.signal))
    s.seq = seq
    const respuesta = { token: sellar(s), session_id: s.id, seq, mensaje: t.mensaje, accion: t.accion, ficha: t.ficha, estado: s.estado }
    if (hayAlmacen()) {
      // El estado (sin la conversación) en el CRM; si falla, la conversación sigue
      try { await guardarSesion(s, t.accion === 'cerrado' || t.accion === 'terminado' ? t.motivo : undefined, { seq, peticion, respuesta }) }
      catch (e) { console.error('[proli-v9] sesión no guardada', e instanceof Error ? e.message : e) }
    }
    return json(200, respuesta)
  } catch (e) {
    console.error('[proli-v9]', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    return json(502, { error: e instanceof Anthropic.RateLimitError ? 'ocupado' : 'fallo' })
  }
}
