/**
 * Proli: función de Vercel (POST /api/proli). Es el único lugar que conoce la clave de la API de
 * Claude (variable de entorno ANTHROPIC_API_KEY, configurada en Vercel; nunca en el código ni en el
 * navegador). El navegador manda la conversación; aquí se le agregan las instrucciones, el
 * conocimiento y las herramientas (el visitante no puede cambiarlos), se llama a Claude y se
 * devuelve la respuesta en vivo, línea por línea (NDJSON):
 *   {"t":"texto","d":"..."}                     trozos del texto de Proli
 *   {"t":"fin","contenido":[...],"stop":"..."}  el mensaje completo (con las acciones pedidas)
 *   {"t":"error","d":"..."}                     algo falló; el navegador pasa a respuestas preparadas
 *
 * Las acciones (tool_use) las ejecuta el navegador y vuelve a llamar con su resultado: aquí cada
 * petición es UNA llamada a Claude, sin bucle.
 */
import Anthropic from '@anthropic-ai/sdk'
// Con "type": "module" (package.json), Node necesita la extensión .js en los imports relativos
import { INSTRUCCIONES } from './_proli/instrucciones.js'
import { CONOCIMIENTO } from './_proli/conocimiento.js'
import { HERRAMIENTAS } from './_proli/herramientas.js'

declare const process: { env: Record<string, string | undefined> }
type Mensaje = Anthropic.Beta.Messages.BetaMessageParam

const MODELO = 'claude-opus-5-5'
const MAX_MENSAJES = 60            // una conversación de stand es corta; más es abuso
const MAX_BYTES = 120_000          // tamaño máximo de la conversación que manda el navegador
const MAX_TEXTO_USUARIO = 500      // caracteres por pregunta
const PETICIONES_POR_VENTANA = 40  // por IP, cada 10 minutos (por instancia del servidor)
const VENTANA_MS = 10 * 60_000

// Instrucciones + conocimiento: idénticos para todos los visitantes, así que se guardan en caché
// (1 hora: en el stand hay ratos sin visitantes y la caché de 5 minutos se perdería)
const SISTEMA: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
  { type: 'text', text: `${INSTRUCCIONES}\n\n${CONOCIMIENTO}`, cache_control: { type: 'ephemeral', ttl: '1h' } },
]

// Límite sencillo por IP. Es por instancia (Vercel puede tener varias), así que es una barrera
// contra abuso casual; el tope real de gasto está en la consola de Claude (límite del espacio de trabajo).
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

const CONTEXTO = /^Pantalla actual: [^\n]{1,300}$/

/**
 * Revisa la conversación que manda el navegador. El visitante podría alterarla, así que solo se
 * aceptan: preguntas de texto cortas, resultados de acciones, mensajes de sistema con el formato
 * exacto de contexto de pantalla y los mensajes de Proli tal como los devolvió la API.
 */
function validar(cuerpo: unknown): Mensaje[] | string {
  if (!cuerpo || typeof cuerpo !== 'object' || !Array.isArray((cuerpo as { mensajes?: unknown }).mensajes)) return 'formato'
  const mensajes = (cuerpo as { mensajes: unknown[] }).mensajes
  if (!mensajes.length || mensajes.length > MAX_MENSAJES) return 'longitud'
  for (const m of mensajes) {
    if (!m || typeof m !== 'object') return 'mensaje'
    const { role, content } = m as { role?: unknown; content?: unknown }
    if (role === 'system') {
      if (typeof content !== 'string' || !CONTEXTO.test(content)) return 'sistema'
    } else if (role === 'user') {
      if (typeof content === 'string') {
        if (!content.trim() || content.length > MAX_TEXTO_USUARIO) return 'pregunta'
      } else if (Array.isArray(content)) {
        const ok = content.every((b) => b && typeof b === 'object' && (b as { type?: unknown }).type === 'tool_result'
          && typeof (b as { tool_use_id?: unknown }).tool_use_id === 'string'
          && typeof (b as { content?: unknown }).content === 'string' && ((b as { content: string }).content).length <= 2000)
        if (!ok || !content.length) return 'resultado'
      } else return 'usuario'
    } else if (role === 'assistant') {
      if (!Array.isArray(content)) return 'asistente'
    } else return 'rol'
  }
  const ultimo = mensajes[mensajes.length - 1] as { role: string }
  if (ultimo.role === 'assistant') return 'turno'
  return mensajes as Mensaje[]
}

const json = (status: number, datos: unknown) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'sin_clave' })
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local'
  if (!permitido(ip)) return json(429, { error: 'demasiadas_peticiones' })
  const texto = await request.text()
  if (texto.length > MAX_BYTES) return json(413, { error: 'muy_largo' })
  let cuerpo: unknown
  try { cuerpo = JSON.parse(texto) } catch { return json(400, { error: 'json' }) }
  const mensajes = validar(cuerpo)
  if (typeof mensajes === 'string') return json(400, { error: mensajes })

  const cliente = new Anthropic()
  const codificar = new TextEncoder()
  const cuerpoRespuesta = new ReadableStream<Uint8Array>({
    async start(control) {
      const enviar = (o: unknown) => control.enqueue(codificar.encode(`${JSON.stringify(o)}\n`))
      try {
        const flujo = cliente.beta.messages.stream({
          model: MODELO,
          max_tokens: 2000,
          // Respuestas cortas de stand: poco razonamiento basta y responde más rápido
          output_config: { effort: 'low' },
          // Si el modelo declina por una salvaguarda, otro modelo responde en la misma llamada
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: SISTEMA,
          tools: HERRAMIENTAS,
          // Caché de la conversación (el prefijo crece turno a turno)
          cache_control: { type: 'ephemeral' },
          messages: mensajes,
        }, { signal: request.signal })
        flujo.on('text', (d) => enviar({ t: 'texto', d }))
        const final = await flujo.finalMessage()
        // Consumo por respuesta (sin contenido de la conversación): permite vigilar el costo en los registros
        const u = final.usage
        console.log(`[proli] tokens entrada=${u.input_tokens} cache_leida=${u.cache_read_input_tokens ?? 0} cache_escrita=${u.cache_creation_input_tokens ?? 0} salida=${u.output_tokens} stop=${final.stop_reason}`)
        // El contenido va intacto: el navegador debe guardarlo tal cual (incluidos los bloques de
        // razonamiento) para la siguiente petición. Si la respuesta terminó en una negativa o se
        // cortó por longitud, el navegador no ejecuta sus acciones y empieza una conversación nueva.
        enviar({ t: 'fin', contenido: final.content, stop: final.stop_reason })
      } catch (e) {
        // Al navegador solo va un código; el detalle queda en los registros de Vercel
        console.error('[proli]', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
        enviar({ t: 'error', d: e instanceof Anthropic.RateLimitError ? 'ocupado' : 'fallo' })
      } finally {
        control.close()
      }
    },
  })
  return new Response(cuerpoRespuesta, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  })
}
