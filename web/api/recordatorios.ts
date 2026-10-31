/**
 * Recordatorio 24 horas antes de cada reunión (Paola, 31-oct), con el texto aprobado. Lo llama cada 15
 * minutos un trabajo programado de Supabase (supabase/003_recordatorios.sql) con la cabecera
 * «Authorization: Bearer <RECORDATORIOS_SECRETO>»; sin ese secreto responde 401. Envía desde hello@ a
 * cada reunión confirmada que empieza dentro de las próximas 20 a 24 horas y todavía no tuvo recordatorio,
 * y lo marca para no repetirlo.  GET o POST /api/recordatorios
 */
import { timingSafeEqual } from 'node:crypto'
import { marcarRecordatorio, recordatoriosPendientes, haySupabase, type Pendiente } from './_proli/v9/almacen.js'
import { enviarCorreo, hayGoogle } from './_proli/v9/google.js'
import { fechaLarga, horaCorta } from './_proli/v9/agenda.js'

declare const process: { env: Record<string, string | undefined> }

const json = (status: number, datos: unknown) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

function autorizado(request: Request): boolean {
  const secreto = process.env.RECORDATORIOS_SECRETO ?? ''
  const dado = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (secreto.length < 24 || dado.length !== secreto.length) return false
  return timingSafeEqual(Buffer.from(dado), Buffer.from(secreto))
}

/** El texto de Paola, con los datos de la reunión */
export function textoRecordatorio(p: Pendiente): { asunto: string; texto: string } {
  const nombre = (p.contacts?.full_name ?? '').split(' ')[0] || 'hola'
  const meta = (p.objective_short || p.purpose || 'avanzar en tu idea').replace(/^que\s+/i, '').replace(/[.\s]+$/, '')
  const metaMinuscula = meta.charAt(0).toLowerCase() + meta.slice(1)
  const inicio = new Date(p.starts_at)
  const fecha = fechaLarga(inicio).replace(/^./, (x) => x.toUpperCase())
  const lugar = p.meeting_type === 'presencial' ? 'Stand de Proliferante, GovTech Summit 2026' : (p.meet_link ?? 'El enlace está en la invitación de tu calendario')
  return {
    asunto: 'Mañana nos vemos: tu idea merece avanzar',
    texto: `Hola, ${nombre}.

¿Te ha pasado que tienes una buena idea, pero entre las urgencias del día a día nunca encuentras el momento para hacerla realidad?

En GovTech nos contaste que querías ${metaMinuscula}.

Y sería una lástima que esa idea se quedara solo en una conversación.

Por eso, mañana queremos dedicar nuestro encuentro a identificar qué podría estar frenándola y cuál sería el primer paso concreto para ponerla en marcha.

La idea es que salgas con algo que puedas empezar a mover, no con otra presentación.

📅 ${fecha} · ${horaCorta(inicio)} (hora de Colombia)
${p.meeting_type === 'presencial' ? '📍' : '🔗'} ${lugar}

¡Nos vemos mañana!

Equipo Proliferante
`,
  }
}

async function enviar(request: Request): Promise<Response> {
  if (!autorizado(request)) return json(401, { error: 'no_autorizado' })
  if (!haySupabase() || !hayGoogle()) return json(503, { error: 'sin_configuracion' })
  const pendientes = await recordatoriosPendientes()
  let enviados = 0
  const errores: string[] = []
  for (const p of pendientes) {
    if (!p.contacts?.email) continue
    try {
      const { asunto, texto } = textoRecordatorio(p)
      await enviarCorreo(p.contacts.email, asunto, texto)
      await marcarRecordatorio(p.booking_id)
      enviados++
    } catch (e) {
      errores.push(p.booking_id)
      console.error('[proli recordatorios]', p.booking_id, e instanceof Error ? e.message : e)
    }
  }
  return json(200, { revisados: pendientes.length, enviados, errores })
}

export const GET = enviar
export const POST = enviar
