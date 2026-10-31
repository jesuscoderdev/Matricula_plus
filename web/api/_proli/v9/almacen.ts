/**
 * El CRM de Proli: Supabase (tablas en supabase/001_proli_v9.sql y 002_proli_v12.sql) por su API REST, con
 * la clave secreta (la nueva «sb_secret_…» o la antigua service_role), que solo vive en el servidor
 * (variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY). Nunca se guarda la transcripción completa
 * (sección 9: minimizar datos).
 *
 * Sin Supabase, en el servidor local (PROLI_ALMACEN_LOCAL=ruta) las escrituras simples van a un JSONL para
 * probar; la agenda real (reservas y horarios) exige Supabase.
 */
import { appendFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

// Acepta la Project URL o la URL de «Data API» (que termina en /rest/v1)
const url = () => process.env.SUPABASE_URL?.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
const clave = () => process.env.SUPABASE_SERVICE_ROLE_KEY
export const haySupabase = () => !!(url() && clave())
export const hayAlmacen = () => haySupabase() || !!process.env.PROLI_ALMACEN_LOCAL

type Fila = Record<string, unknown>
// Clave nueva (sb_secret_…): solo en «apikey». Clave antigua (service_role, un JWT): también como Bearer
const cabeceras = (extra: Record<string, string> = {}) =>
  ({ apikey: clave()!, ...(clave()!.startsWith('sb_') ? {} : { Authorization: `Bearer ${clave()}` }), 'Content-Type': 'application/json', ...extra })

export class Conflicto extends Error {}

async function rest(tabla: string, filas: Fila[], opciones: { conflicto?: string; devolver?: boolean; ignorarDuplicado?: boolean } = {}): Promise<Fila[]> {
  if (!haySupabase()) {
    const local = process.env.PROLI_ALMACEN_LOCAL
    if (!local) throw new Error('sin_almacen')
    const id = `${tabla.replace(/ies$/, 'y').replace(/s$/, '')}_id`
    const conId = filas.map((f) => ({ ...f, [id]: f[id] ?? randomUUID() }))
    for (const f of conId) appendFileSync(local, `${JSON.stringify({ tabla, ...f, _guardado: new Date().toISOString() })}\n`)
    return conId
  }
  const q = opciones.conflicto ? `?on_conflict=${opciones.conflicto}` : ''
  const prefer = [opciones.conflicto ? 'resolution=merge-duplicates' : '', opciones.devolver ? 'return=representation' : 'return=minimal'].filter(Boolean).join(',')
  const r = await fetch(`${url()}/rest/v1/${tabla}${q}`, { method: 'POST', headers: cabeceras({ Prefer: prefer }), body: JSON.stringify(filas) })
  if (r.status === 409) throw new Conflicto(`${tabla} ${(await r.text()).slice(0, 200)}`)
  if (!r.ok) throw new Error(`supabase ${tabla} ${r.status} ${(await r.text()).slice(0, 300)}`)
  return opciones.devolver ? ((await r.json()) as Fila[]) : []
}
async function leer<T>(consulta: string): Promise<T[]> {
  if (!haySupabase()) throw new Error('sin_almacen')
  const r = await fetch(`${url()}/rest/v1/${consulta}`, { headers: cabeceras() })
  if (!r.ok) throw new Error(`supabase ${consulta.split('?')[0]} ${r.status} ${(await r.text()).slice(0, 200)}`)
  return r.json() as Promise<T[]>
}
async function actualizar(consulta: string, cambios: Fila): Promise<void> {
  if (!haySupabase()) throw new Error('sin_almacen')
  const r = await fetch(`${url()}/rest/v1/${consulta}`, { method: 'PATCH', headers: cabeceras({ Prefer: 'return=minimal' }), body: JSON.stringify(cambios) })
  if (!r.ok) throw new Error(`supabase ${consulta.split('?')[0]} ${r.status} ${(await r.text()).slice(0, 200)}`)
}

// --- Sesiones (V12, 7.4): estado, secuencia, revocación y última respuesta para reintentos idempotentes ---
type SesionMinima = { id: string; canal: string; estado: string; preguntas: number; desvios: number; asesor: string | null; creada: number; ultima: number }
export async function guardarSesion(s: SesionMinima, cierre?: string, turno?: { seq: number; peticion: string; respuesta: unknown }) {
  await rest('sessions', [{
    session_id: s.id, channel: s.canal, state: s.estado, question_count: s.preguntas, offtopic_count: s.desvios,
    staff_id: s.asesor, opened_at: new Date(s.creada).toISOString(), last_activity_at: new Date(s.ultima).toISOString(),
    ...(cierre ? { closed_reason: cierre } : {}),
    ...(turno && haySupabase() ? { message_seq: turno.seq, last_request_id: turno.peticion, last_response: turno.respuesta } : {}),
  }], { conflicto: 'session_id' })
}
export async function leerSesion(id: string) {
  if (!haySupabase()) return null
  const [f] = await leer<{ message_seq: number; last_request_id: string | null; last_response: unknown; revoked_at: string | null }>(
    `sessions?session_id=eq.${encodeURIComponent(id)}&select=message_seq,last_request_id,last_response,revoked_at`)
  return f ?? null
}
export async function revocarSesion(id: string) {
  if (!haySupabase()) return
  await actualizar(`sessions?session_id=eq.${encodeURIComponent(id)}`, { revoked_at: new Date().toISOString(), closed_reason: 'reinicio', last_response: null })
}

// --- Contacto y permisos ---
export async function guardarContacto(c: { nombre: string; organizacion: string; email: string; cargo: string; celular: string }): Promise<string> {
  const [f] = await rest('contacts', [{
    full_name: c.nombre, organization: c.organizacion, email: c.email.toLowerCase(),
    ...(c.cargo ? { role: c.cargo } : {}), ...(c.celular ? { phone: c.celular } : {}), updated_at: new Date().toISOString(),
  }], { conflicto: 'email', devolver: true })
  return String(f.contact_id)
}
export async function guardarPermisos(contacto: string, permisos: Record<string, boolean>, politica: string, fuente: string) {
  await rest('consents', Object.entries(permisos).map(([purpose, granted]) => ({ contact_id: contacto, purpose, granted, policy_version: politica, source: fuente })))
}
export async function guardarFicha(f: Fila) { await rest('discoveries', [f]) }
export async function guardarInteraccion(f: Fila) { await rest('interactions', [f]) }

// --- Reservas: un horario por asesor (índice único bookings_asesor_horario) ---
export interface Reserva {
  booking_id: string; contact_id: string; staff_id: string | null; starts_at: string; ends_at: string; status: string
  calendar_event_id: string | null; meet_link: string | null; meeting_type: string
}
export async function reservaPorClave(idempotencia: string): Promise<Reserva | null> {
  const [f] = await leer<Reserva>(`bookings?idempotency_key=eq.${encodeURIComponent(idempotencia)}&select=*`)
  return f ?? null
}
/** Horarios ya tomados por un asesor (bloqueos recientes y reuniones confirmadas) */
export async function reservasDelAsesor(asesor: string, desde: Date, hasta: Date): Promise<{ start: string; end: string }[]> {
  const filas = await leer<{ starts_at: string; ends_at: string }>(
    `bookings?staff_id=eq.${encodeURIComponent(asesor)}&status=in.(bloqueada,confirmada,reprogramada)&starts_at=gte.${encodeURIComponent(desde.toISOString())}&starts_at=lt.${encodeURIComponent(hasta.toISOString())}&select=starts_at,ends_at`)
  return filas.map((f) => ({ start: f.starts_at, end: f.ends_at }))
}
/** Los bloqueos de más de 5 minutos (una confirmación que nunca terminó) dejan el horario libre */
export async function liberarBloqueosVencidos() {
  await actualizar(`bookings?status=eq.bloqueada&updated_at=lt.${encodeURIComponent(new Date(Date.now() - 5 * 60_000).toISOString())}`,
    { status: 'cancelada', updated_at: new Date().toISOString() })
}
/** Bloquea el horario para este asesor; si otra pantalla lo tomó primero, lanza Conflicto */
export async function bloquearHorario(f: Fila): Promise<string> {
  const [b] = await rest('bookings', [{ ...f, status: 'bloqueada', updated_at: new Date().toISOString() }], { devolver: true })
  return String(b.booking_id)
}
export async function actualizarReserva(id: string, cambios: Fila) {
  await actualizar(`bookings?booking_id=eq.${encodeURIComponent(id)}`, { ...cambios, updated_at: new Date().toISOString() })
}

// --- Recordatorios (24 horas antes) ---
export interface Pendiente {
  booking_id: string; starts_at: string; meet_link: string | null; meeting_type: string; objective_short: string | null; purpose: string | null
  contacts: { full_name: string; email: string } | null
}
export async function recordatoriosPendientes(ahora = new Date()): Promise<Pendiente[]> {
  const desde = new Date(ahora.getTime() + 20 * 3_600_000).toISOString()
  const hasta = new Date(ahora.getTime() + 24 * 3_600_000).toISOString()
  return leer<Pendiente>(`bookings?status=eq.confirmada&reminder_sent_at=is.null&starts_at=gt.${encodeURIComponent(desde)}&starts_at=lte.${encodeURIComponent(hasta)}&select=booking_id,starts_at,created_at,meet_link,meeting_type,objective_short,purpose,contacts(full_name,email)`)
}
export async function marcarRecordatorio(id: string) {
  await actualizar(`bookings?booking_id=eq.${encodeURIComponent(id)}&reminder_sent_at=is.null`, { reminder_sent_at: new Date().toISOString() })
}
