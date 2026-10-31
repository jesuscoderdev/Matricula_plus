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
import { AVISO_PRIVACIDAD } from './_proli/privacidad.js'

declare const process: { env: Record<string, string | undefined> }
type Mensaje = Anthropic.Beta.Messages.BetaMessageParam

const MODELO = 'claude-opus-5-5'
const MAX_MENSAJES = 60            // una conversación de stand es corta; más es abuso
const MAX_BYTES = 120_000          // tamaño máximo de la conversación que manda el navegador
const MAX_TEXTO_USUARIO = 500      // caracteres por pregunta
// En el stand, el tótem y los celulares en el mismo Wi-Fi comparten IP, y cada pregunta hace hasta
// 4 llamadas: el límite es holgado. El freno fino es la regla de límite del firewall de Vercel.
const PETICIONES_POR_VENTANA = 300 // por IP, cada 10 minutos (por instancia del servidor)
const VENTANA_MS = 10 * 60_000

// La regla del aviso de privacidad depende de si ya hay aviso (api/_proli/privacidad.ts). Se arma aquí y
// no en instrucciones.ts para que ese archivo no tenga imports: lo leen las pruebas de tono en Node.
// Proli conoce el texto completo para responder preguntas sobre los datos sin inventar.
const AVISO = AVISO_PRIVACIDAD.length
  ? `al pedir permiso, di en pocas palabras que puede leerlo tocando «Aviso de privacidad», junto al código o al botón de la cita (se abre aquí mismo). Si pregunta qué hacen con sus datos, responde solo con lo que dice el aviso: ${AVISO_PRIVACIDAD.map((s) => `${s.titulo}: ${s.texto}`).join(' ')}`
  :'Todavía no hay un aviso de privacidad publicado: no lo menciones ni lo inventes; anota solo lo indispensable y recuerda que los datos van únicamente en el mensaje que el visitante envía él mismo.'

// Instrucciones + conocimiento: idénticos para todos los visitantes, así que se guardan en caché
// (1 hora: en el stand hay ratos sin visitantes y la caché de 5 minutos se perdería)
const SISTEMA: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
  { type: 'text', text: `${INSTRUCCIONES.replace('{{AVISO_PRIVACIDAD}}', AVISO)}\n\n${CONOCIMIENTO}`, cache_control: { type: 'ephemeral', ttl: '1h' } },
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

// El contexto de pantalla lo arma el navegador, así que es un dato del visitante y no una orden:
// solo se aceptan letras, números y puntuación simple, y nunca llega a Claude como mensaje de
// sistema (que tiene la autoridad de las instrucciones), sino como texto marcado en su turno
const CONTEXTO = /^Pantalla actual: ([\p{L}\p{N} ,.+$·()–-]{1,300})$/u

// Bloques que la API devuelve en un mensaje de Proli; el navegador los reenvía tal cual
const BLOQUES_ASISTENTE = new Set(['text', 'thinking', 'redacted_thinking', 'tool_use', 'fallback'])
const NOMBRES_HERRAMIENTAS = new Set(HERRAMIENTAS.map((h) => h.name))
const MAX_TEXTO_ASISTENTE = 4000
function bloqueAsistenteValido(b: unknown): boolean {
  if (!b || typeof b !== 'object') return false
  const { type, text, name } = b as { type?: unknown; text?: unknown; name?: unknown }
  if (typeof type !== 'string' || !BLOQUES_ASISTENTE.has(type)) return false
  if (type === 'text') return typeof text === 'string' && text.length <= MAX_TEXTO_ASISTENTE
  if (type === 'tool_use') return typeof name === 'string' && NOMBRES_HERRAMIENTAS.has(name)
  return true
}

/**
 * Revisa la conversación que manda el navegador. El visitante podría alterarla, así que solo se
 * aceptan: preguntas de texto cortas, resultados de acciones, contexto de pantalla con el formato
 * exacto y los mensajes de Proli con los bloques que devuelve la API.
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
      if (!Array.isArray(content) || !content.length || !content.every(bloqueAsistenteValido)) return 'asistente'
    } else return 'rol'
  }
  if ((mensajes[0] as { role: string }).role !== 'user') return 'inicio'
  const ultimo = mensajes[mensajes.length - 1] as { role: string }
  if (ultimo.role === 'assistant') return 'turno'
  // Contexto de pantalla → texto marcado en el turno del visitante, sin autoridad de sistema.
  // La conversión es igual en cada petición: el historial no cambia y la caché sigue sirviendo.
  return (mensajes as { role: string; content: unknown }[]).map((m) => (m.role === 'system'
    ? { role: 'user', content: [{ type: 'text', text: `<pantalla>${CONTEXTO.exec(m.content as string)![1]}</pantalla>` }] }
    : m)) as Mensaje[]
}

/** Solo el propio sitio puede llamar desde un navegador: una página de otro dominio queda fuera. */
function mismoSitio(request: Request): boolean {
  const sitio = request.headers.get('sec-fetch-site')
  if (sitio && sitio !== 'same-origin') return false
  const origen = request.headers.get('origin')
  if (!origen) return true
  try { return new URL(origen).host === new URL(request.url).host } catch { return false }
}

const json = (status: number, datos: unknown) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'sin_clave' })
  if (!mismoSitio(request)) return json(403, { error: 'origen' })
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
