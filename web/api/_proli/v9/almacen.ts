/**
 * El CRM de Proli V9: Supabase (tablas en supabase/001_proli_v9.sql) por su API REST, con la clave
 * secreta (la nueva «sb_secret_…» o la antigua service_role), que solo vive en el servidor (variables
 * SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).
 *
 * Sin Supabase configurado: en el servidor local (PROLI_ALMACEN_LOCAL=ruta) se escribe un JSONL para
 * probar de punta a punta; en Vercel, guardar falla con «sin_almacen» y el navegador conserva la
 * solicitud para reintentar. Nunca se guarda la transcripción completa (sección 9: minimizar datos).
 */
import { appendFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

// Acepta la Project URL o la URL de «Data API» (que termina en /rest/v1)
const url = () => process.env.SUPABASE_URL?.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
const clave = () => process.env.SUPABASE_SERVICE_ROLE_KEY
export const hayAlmacen = () => !!(url() && clave()) || !!process.env.PROLI_ALMACEN_LOCAL

type Fila = Record<string, unknown>

async function rest(tabla: string, filas: Fila[], opciones: { conflicto?: string; devolver?: boolean } = {}): Promise<Fila[]> {
  const local = process.env.PROLI_ALMACEN_LOCAL
  if (!(url() && clave())) {
    if (!local) throw new Error('sin_almacen')
    const conId = filas.map((f) => ({ ...f, [`${tabla.replace(/s$/, '')}_id`]: f[`${tabla.replace(/s$/, '')}_id`] ?? randomUUID() }))
    for (const f of conId) appendFileSync(local, `${JSON.stringify({ tabla, ...f, _guardado: new Date().toISOString() })}\n`)
    return conId
  }
  const q = opciones.conflicto ? `?on_conflict=${opciones.conflicto}` : ''
  const prefer = [opciones.conflicto ? 'resolution=merge-duplicates' : '', opciones.devolver ? 'return=representation' : 'return=minimal'].filter(Boolean).join(',')
  const r = await fetch(`${url()}/rest/v1/${tabla}${q}`, {
    method: 'POST',
    // Clave nueva (sb_secret_…): solo en «apikey». Clave antigua (service_role, un JWT): también como Bearer
    headers: { apikey: clave()!, ...(clave()!.startsWith('sb_') ? {} : { Authorization: `Bearer ${clave()}` }), 'Content-Type': 'application/json', Prefer: prefer },
    body: JSON.stringify(filas),
  })
  if (!r.ok) throw new Error(`supabase ${tabla} ${r.status} ${(await r.text()).slice(0, 300)}`)
  return opciones.devolver ? ((await r.json()) as Fila[]) : []
}

/** Una solicitud ya registrada con esta clave de idempotencia (el mismo envío repetido no escribe nada) */
async function yaRegistrada(idempotencia: string): Promise<{ contacto: string; reserva: string } | null> {
  if (!(url() && clave())) return null
  const r = await fetch(`${url()}/rest/v1/bookings?idempotency_key=eq.${encodeURIComponent(idempotencia)}&select=booking_id,contact_id`, {
    headers: { apikey: clave()!, ...(clave()!.startsWith('sb_') ? {} : { Authorization: `Bearer ${clave()}` }) },
  })
  if (!r.ok) throw new Error(`supabase bookings ${r.status}`)
  const [b] = (await r.json()) as { booking_id: string; contact_id: string }[]
  return b ? { contacto: b.contact_id, reserva: b.booking_id } : null
}

/** Estado de la sesión (sin la conversación): contadores, estado y asesor */
export async function guardarSesion(s: { id: string; canal: string; estado: string; preguntas: number; desvios: number; asesor: string | null; creada: number; ultima: number }, cierre?: string) {
  await rest('sessions', [{
    session_id: s.id, channel: s.canal, state: s.estado, question_count: s.preguntas, offtopic_count: s.desvios,
    staff_id: s.asesor, opened_at: new Date(s.creada).toISOString(), last_activity_at: new Date(s.ultima).toISOString(),
    ...(cierre ? { closed_reason: cierre } : {}),
  }], { conflicto: 'session_id' })
}

export interface Registro {
  sesion: { id: string; canal: string; estado: string; preguntas: number; desvios: number; asesor: string | null; creada: number; ultima: number } | null
  canal: string
  contacto: { nombre: string; organizacion: string; email: string; cargo: string; celular: string }
  consentimientos: { gestionar_cita: boolean; conservar_ficha: boolean; comunicaciones_comerciales: boolean }
  asesor: string | null           // null = asesor_por_asignar
  ficha: { organizacion: string; rol: string; objetivo: string; situacion: string; hipotesis: string; por_conocer: string; aprobada: boolean } | null
  agenda: { proposito: string; franja: string; modalidad: 'meet' | 'presencial' } | null
  clave: string                   // idempotencia: el mismo envío dos veces no crea dos registros
  politica: string
}

/** Contacto (deduplicado por correo), consentimientos, ficha (si autorizó conservarla), solicitud de cita e interacción */
export async function guardarRegistro(r: Registro): Promise<{ contacto: string; reserva: string | null }> {
  if (r.agenda) {
    const previa = await yaRegistrada(r.clave)
    if (previa) return previa
  }
  if (r.sesion) await guardarSesion(r.sesion, r.agenda ? 'solicitud_de_cita' : 'ficha_guardada')
  const [c] = await rest('contacts', [{
    full_name: r.contacto.nombre, organization: r.contacto.organizacion, email: r.contacto.email.toLowerCase(),
    ...(r.contacto.cargo ? { role: r.contacto.cargo } : {}), ...(r.contacto.celular ? { phone: r.contacto.celular } : {}),
    updated_at: new Date().toISOString(),
  }], { conflicto: 'email', devolver: true })
  const contacto = String(c.contact_id)
  const fuente = `proli_v9_${r.canal}`
  await rest('consents', (Object.keys(r.consentimientos) as (keyof Registro['consentimientos'])[]).map((p) => ({
    contact_id: contacto, purpose: p, granted: r.consentimientos[p], policy_version: r.politica, source: fuente,
  })))
  if (r.ficha && r.consentimientos.conservar_ficha) {
    await rest('discoveries', [{
      session_id: r.sesion?.id ?? null, contact_id: contacto, organization: r.ficha.organizacion || r.contacto.organizacion,
      role: r.ficha.rol || r.contacto.cargo || null, objective_declared: r.ficha.objetivo || r.agenda?.proposito || '',
      situation_declared: r.ficha.situacion || null, hypothesis_unverified: r.ficha.hipotesis || null,
      pending_validation: r.ficha.por_conocer || null, visitor_approved: r.ficha.aprobada, staff_id: r.asesor,
    }])
  }
  let reserva: string | null = null
  if (r.agenda && r.consentimientos.gestionar_cita) {
    const [b] = await rest('bookings', [{
      contact_id: contacto, session_id: r.sesion?.id ?? null, staff_id: r.asesor, staff_pending: !r.asesor,
      preferred_slot: r.agenda.franja, meeting_type: r.agenda.modalidad, purpose: r.agenda.proposito,
      status: 'solicitada', idempotency_key: r.clave,
    }], { conflicto: 'idempotency_key', devolver: true })
    reserva = String(b.booking_id)
  }
  await rest('interactions', [{
    contact_id: contacto, session_id: r.sesion?.id ?? null, channel: r.canal, staff_id: r.asesor,
    next_action: r.agenda ? (r.asesor ? 'confirmar_horario' : 'asignar_asesor_y_confirmar_horario') : 'seguimiento_segun_consentimiento',
    status: r.agenda ? 'interes_recibido' : 'exploratorio',
  }])
  return { contacto, reserva }
}
