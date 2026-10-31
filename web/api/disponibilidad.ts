/**
 * Proli: horarios libres para la reunión de 20 minutos (POST /api/disponibilidad).
 *   entrada: { asesor: id | 'por_asignar', dia?: 'AAAA-MM-DD' }
 *   salida:  { asesor, dias: ['2026-11-03', …], dia, horarios: [{ inicio, hora }] }
 *
 * Libre = dentro del horario autorizado (agenda.ts), sin eventos en el calendario del asesor y sin otra
 * reserva suya en el CRM (también las que se están confirmando). Sin asesor conocido, se mira a Paola.
 */
import { asesorPorId, correoAsesor, POR_ASIGNAR } from './_proli/v9/asesores.js'
import { haySupabase, reservasDelAsesor } from './_proli/v9/almacen.js'
import { diasDisponibles, horaCorta, horariosDelDia, instante, libres, fechaLarga } from './_proli/v9/agenda.js'
import { hayGoogle, ocupados } from './_proli/v9/google.js'

declare const process: { env: Record<string, string | undefined> }

const json = (status: number, datos: unknown) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

function mismoSitio(request: Request): boolean {
  const sitio = request.headers.get('sec-fetch-site')
  if (sitio && sitio !== 'same-origin') return false
  const origen = request.headers.get('origin')
  if (!origen) return true
  try { return new URL(origen).host === new URL(request.url).host } catch { return false }
}

export async function POST(request: Request): Promise<Response> {
  if (!mismoSitio(request)) return json(403, { error: 'origen' })
  let b: { asesor?: unknown; dia?: unknown }
  try { b = JSON.parse((await request.text()).slice(0, 2000)) } catch { return json(400, { error: 'json' }) }
  if (!haySupabase() || !hayGoogle()) return json(503, { error: 'sin_calendario' })
  const asesor = (b.asesor === POR_ASIGNAR ? null : asesorPorId(typeof b.asesor === 'string' ? b.asesor : null)) ?? asesorPorId('paola')!
  const dias = diasDisponibles()
  const dia = typeof b.dia === 'string' && dias.includes(b.dia) ? b.dia : dias[0]
  try {
    const desde = instante(dia, 0), hasta = instante(dia, 24 * 60)
    const correo = correoAsesor(asesor, process.env)
    const [cal, crm] = await Promise.all([ocupados([correo], desde, hasta), reservasDelAsesor(asesor.id, desde, hasta)])
    const horarios = libres(horariosDelDia(dia), [...cal[correo], ...crm]).map((h) => ({ inicio: h.toISOString(), hora: horaCorta(h) }))
    return json(200, { asesor: asesor.id, dias: dias.map((d) => ({ dia: d, nombre: fechaLarga(instante(d, 12 * 60)) })), dia, horarios })
  } catch (e) {
    console.error('[proli disponibilidad]', e instanceof Error ? e.message : e)
    return json(502, { error: 'calendario' })
  }
}
