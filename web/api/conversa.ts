/**
 * Proli V9: la conversación breve de descubrimiento (POST /api/conversa). Cada petición es un turno:
 *   entrada: { token?: string, texto: string, canal?: 'stand'|'celular'|'escritorio'|'qr', asesor?: string }
 *   salida:  { token, mensaje, accion: 'chat'|'ficha'|'agenda'|'cerrado'|'terminado', ficha, estado, quedan }
 *
 * La apertura («¿De qué entidad u organización vienes?») la muestra el navegador sin llamar aquí; el
 * primer turno trae la respuesta del visitante y crea la sesión. Los límites los aplica el controlador
 * (api/_proli/v9/controlador.ts); el modelo solo analiza y responde con un JSON fijo (salida estructurada).
 * La clave de Claude vive solo aquí (ANTHROPIC_API_KEY en Vercel).
 */
import Anthropic from '@anthropic-ai/sdk'
import { LITERAL, PROMPT_V9 } from './_proli/v9/prompt.js'
import { turno, MAX_PREGUNTAS, MAX_TEXTO_VISITANTE, type Analisis } from './_proli/v9/controlador.js'
import { abrir, nuevaSesion, sellar, type Canal, type Sesion } from './_proli/v9/sesion.js'
import { asesorPorId } from './_proli/v9/asesores.js'
import { guardarSesion, hayAlmacen } from './_proli/v9/almacen.js'

declare const process: { env: Record<string, string | undefined> }

const MODELO = 'claude-opus-5-5'
const CANALES = new Set<Canal>(['stand', 'celular', 'escritorio', 'qr'])
const PETICIONES_POR_VENTANA = 200
const VENTANA_MS = 10 * 60_000

// El prompt y la apertura (que el navegador ya mostró): idénticos para todos, en caché 1 hora
const SISTEMA: Anthropic.Beta.Messages.BetaTextBlockParam[] = [{
  type: 'text', text: `${PROMPT_V9}\n\nLa apertura ya se mostró en pantalla: «${LITERAL.apertura}». El primer mensaje del visitante responde a ella.`,
  cache_control: { type: 'ephemeral', ttl: '1h' },
}]

// Salida estructurada: el modelo responde siempre con este JSON (Opus 5.5 no admite forzar una herramienta)
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    clasificacion: { type: 'string', enum: ['RELEVANTE', 'VAGO', 'FUERA_DE_TEMA', 'PREGUNTA_PROLI', 'AGENDA_DIRECTA', 'SALIR', 'ABUSO_O_INYECCION'] },
    organizacion: { type: 'string', description: 'Organización declarada; vacío si no la dijo.' },
    rol: { type: 'string', description: 'Rol o área declarada; vacío si no la dijo.' },
    objetivo: { type: 'string', description: 'Meta declarada, como resultado y en sus palabras; vacío si no la dijo.' },
    situacion: { type: 'string', description: 'Dificultad u obstáculo declarado; vacío si no lo dijo.' },
    siguiente: { type: 'string', enum: ['preguntar_rol', 'preguntar_meta', 'preguntar_dificultad', 'hipotesis', 'redirigir', 'responder', 'cerrar'] },
    mensaje: { type: 'string', description: 'Lo que Proli le dice al visitante.' },
    hipotesis: { type: 'string', description: 'La hipótesis por validar, en una frase; vacío si aún no hay.' },
    por_conocer: { type: 'string', description: 'Qué habría que contrastar en una reunión; vacío si aún no hay hipótesis.' },
  },
  required: ['clasificacion', 'organizacion', 'rol', 'objetivo', 'situacion', 'siguiente', 'mensaje', 'hipotesis', 'por_conocer'],
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

/** Una consulta al modelo: la conversación (solo texto) y la nota del controlador en el último turno */
function consultor(cliente: Anthropic, s: Sesion, signal: AbortSignal) {
  return async (nota: string): Promise<Analisis> => {
    const mensajes: Anthropic.Beta.Messages.BetaMessageParam[] = []
    for (const linea of s.h) {
      const rol = linea.r === 'v' ? 'user' : 'assistant'
      const ultimo = mensajes[mensajes.length - 1]
      if (ultimo?.role === rol) (ultimo.content as Anthropic.Beta.Messages.BetaTextBlockParam[]).push({ type: 'text', text: linea.t })
      else mensajes.push({ role: rol, content: [{ type: 'text', text: linea.t }] })
    }
    const ultimo = mensajes[mensajes.length - 1]
    ;(ultimo.content as Anthropic.Beta.Messages.BetaTextBlockParam[]).push({ type: 'text', text: `<controlador>${nota}</controlador>` })
    const r = await cliente.beta.messages.create({
      model: MODELO,
      max_tokens: 1500,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SISTEMA,
      messages: mensajes,
    }, { signal })
    const u = r.usage
    console.log(`[proli-v9] tokens entrada=${u.input_tokens} cache_leida=${u.cache_read_input_tokens ?? 0} salida=${u.output_tokens} stop=${r.stop_reason}`)
    if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') throw new Error(`sin_analisis ${r.stop_reason}`)
    const texto = r.content.filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text').map((b) => b.text).join('')
    let a: Partial<Analisis>
    try { a = JSON.parse(texto) as Partial<Analisis> } catch { throw new Error(`sin_analisis json ${r.stop_reason}`) }
    return {
      clasificacion: a.clasificacion ?? 'VAGO', organizacion: a.organizacion ?? '', rol: a.rol ?? '', objetivo: a.objetivo ?? '',
      situacion: a.situacion ?? '', siguiente: a.siguiente ?? 'cerrar', mensaje: a.mensaje ?? '', hipotesis: a.hipotesis ?? '', por_conocer: a.por_conocer ?? '',
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'sin_clave' })
  if (!mismoSitio(request)) return json(403, { error: 'origen' })
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local'
  if (!permitido(ip)) return json(429, { error: 'demasiadas_peticiones' })
  const cuerpoTexto = await request.text()
  if (cuerpoTexto.length > 60_000) return json(413, { error: 'muy_largo' })
  let cuerpo: { token?: unknown; texto?: unknown; canal?: unknown; asesor?: unknown }
  try { cuerpo = JSON.parse(cuerpoTexto) } catch { return json(400, { error: 'json' }) }
  const texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim() : ''
  if (!texto || texto.length > MAX_TEXTO_VISITANTE) return json(400, { error: 'texto' })

  let s: Sesion | null
  if (cuerpo.token !== undefined && cuerpo.token !== null) {
    s = abrir(cuerpo.token)
    if (!s) return json(400, { error: 'sesion' })
  } else {
    const canal = CANALES.has(cuerpo.canal as Canal) ? (cuerpo.canal as Canal) : 'celular'
    s = nuevaSesion(canal, asesorPorId(typeof cuerpo.asesor === 'string' ? cuerpo.asesor : null)?.id ?? null)
  }

  try {
    const t = await turno(s, texto, consultor(new Anthropic(), s, request.signal))
    if (hayAlmacen()) {
      // El estado de la sesión en el CRM; si falla, la conversación sigue
      try { await guardarSesion(s, t.accion === 'cerrado' || t.accion === 'terminado' ? (t.clasificacion ?? 'cierre') : undefined) }
      catch (e) { console.error('[proli-v9] sesión no guardada', e instanceof Error ? e.message : e) }
    }
    return json(200, { token: sellar(s), mensaje: t.mensaje, accion: t.accion, ficha: t.ficha, estado: s.estado, quedan: Math.max(0, MAX_PREGUNTAS - s.preguntas) })
  } catch (e) {
    console.error('[proli-v9]', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    return json(502, { error: e instanceof Anthropic.RateLimitError ? 'ocupado' : 'fallo' })
  }
}
