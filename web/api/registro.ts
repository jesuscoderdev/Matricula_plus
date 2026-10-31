/**
 * Proli: el formulario de contacto, la ficha aprobada y la reunión de 20 minutos (POST /api/registro).
 *
 *   entrada: { token?, canal, clave, contacto: {nombre, organizacion, email, cargo?, celular?},
 *              consentimientos: {gestionar_cita, conservar_ficha, comunicaciones_comerciales},
 *              asesor: id | 'por_asignar', ficha?: {...,aprobada}, agenda: {proposito, inicio (ISO), modalidad} }
 *   salida:  { ok, estado: 'confirmada', inicio, fin, fecha, hora, enlace, asesor }  ·  409 horario_tomado  ·  502 calendario
 *
 * Reserva real (V9 6.1 y V12): el horario debe ser uno de los ofrecidos; se BLOQUEA para ese asesor (índice
 * único: dos pantallas no pueden quedarse con el mismo), se vuelve a mirar el calendario del asesor y solo
 * entonces se crea UN evento en el calendario de hello@ con invitación al visitante y al asesor. Solo con el
 * evento creado se responde «confirmada»; si el calendario falla, se libera el horario y nunca se simula.
 * Sin asesor conocido, la reunión es con Paola (Paola, 31-oct). La misma `clave` repetida no crea otra.
 */
import { abrir } from './_proli/v9/sesion.js'
import { asesorPorId, POR_ASIGNAR, BUZON_CENTRAL } from './_proli/v9/asesores.js'
import {
  Conflicto, actualizarReserva, bloquearHorario, guardarContacto, guardarFicha, guardarInteraccion, guardarPermisos, guardarSesion,
  haySupabase, liberarBloqueosVencidos, reservaPorClave, type Reserva,
} from './_proli/v9/almacen.js'
import { MINUTOS_REUNION, diaBogota, esHorarioValido, fechaLarga, horaCorta, libres } from './_proli/v9/agenda.js'
import { crearEvento, enviarCorreo, hayGoogle, ocupados } from './_proli/v9/google.js'

declare const process: { env: Record<string, string | undefined> }

const POLITICA = 'politica-datos-2026-09-23+aviso-govtech-borrador'
const ASESOR_POR_DEFECTO = 'paola'
const DIAS_DEL_STAND = ['2026-11-03', '2026-11-04']
const CANALES = new Set(['stand', 'celular', 'escritorio', 'qr'])
const CORREO = /^[^\s@<>()[\],;:"]{1,64}@[^\s@<>()[\],;:"]{1,190}\.[a-z]{2,24}$/i
const PETICIONES_POR_VENTANA = 30
const VENTANA_MS = 10 * 60_000

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

/** Texto del visitante: recortado, sin caracteres de control ni etiquetas */
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '')
/** Un nombre de persona con contenido razonable (V12 2.2.2): letras y al menos una vocal, no un solo carácter repetido */
const nombreRazonable = (n: string) => /\p{L}{2,}/u.test(n) && /[aeiouáéíóúü]/i.test(n) && !/^(.)\1+$/.test(n.replace(/\s/g, ''))

const confirmacion = (r: Pick<Reserva, 'starts_at' | 'ends_at' | 'meet_link' | 'meeting_type'>, asesor: string) => {
  const inicio = new Date(r.starts_at)
  return { ok: true, estado: 'confirmada', inicio: r.starts_at, fin: r.ends_at, fecha: fechaLarga(inicio), hora: horaCorta(inicio), enlace: r.meet_link, modalidad: r.meeting_type, asesor }
}

export async function POST(request: Request): Promise<Response> {
  if (!mismoSitio(request)) return json(403, { error: 'origen' })
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local'
  if (!permitido(ip)) return json(429, { error: 'demasiadas_peticiones' })
  const crudo = await request.text()
  if (crudo.length > 70_000) return json(413, { error: 'muy_largo' })
  let b: Record<string, unknown>
  try { b = JSON.parse(crudo) } catch { return json(400, { error: 'json' }) }

  const c = (b.contacto ?? {}) as Record<string, unknown>
  const contacto = {
    nombre: texto(c.nombre, 120), organizacion: texto(c.organizacion, 160), email: texto(c.email, 254).toLowerCase(),
    cargo: texto(c.cargo, 120), celular: texto(c.celular, 30).replace(/[^\d+ ()-]/g, ''),
  }
  if (!contacto.nombre || !nombreRazonable(contacto.nombre)) return json(400, { error: 'campos', campo: 'nombre' })
  if (!contacto.organizacion) return json(400, { error: 'campos', campo: 'organizacion' })
  if (!CORREO.test(contacto.email)) return json(400, { error: 'campos', campo: 'email' })

  const k = (b.consentimientos ?? {}) as Record<string, unknown>
  const consentimientos = { gestionar_cita: k.gestionar_cita === true, conservar_ficha: k.conservar_ficha === true, comunicaciones_comerciales: k.comunicaciones_comerciales === true }
  if (!consentimientos.gestionar_cita) return json(400, { error: 'consentimiento' })
  const a = (b.agenda ?? {}) as Record<string, unknown>
  const inicio = new Date(typeof a.inicio === 'string' ? a.inicio : NaN)
  if (!esHorarioValido(inicio)) return json(400, { error: 'horario' })
  const fin = new Date(inicio.getTime() + MINUTOS_REUNION * 60_000)
  const presencial = a.modalidad === 'presencial' && DIAS_DEL_STAND.includes(diaBogota(inicio))
  const proposito = texto(a.proposito, 500)

  const f = b.ficha as Record<string, unknown> | undefined
  const ficha = f ? {
    organizacion: texto(f.organizacion, 160), rol: texto(f.rol, 160), objetivo: texto(f.objetivo, 500), situacion: texto(f.situacion, 500),
    hipotesis: texto(f.hipotesis, 500), por_conocer: texto(f.por_conocer, 500), meta_corta: texto(f.meta_corta, 200), aprobada: f.aprobada === true,
  } : null
  const clave = texto(b.clave, 80)
  if (clave.length < 16) return json(400, { error: 'clave' })
  const s = b.token ? abrir(b.token, 180) : null
  const canal = s?.canal ?? (CANALES.has(String(b.canal)) ? String(b.canal) : 'celular')
  // Sin asesor conocido (QR, tarjeta o «No recuerdo»), la reunión es con Paola
  const elegido = b.asesor === POR_ASIGNAR ? null : (asesorPorId(typeof b.asesor === 'string' ? b.asesor : null) ?? asesorPorId(s?.asesor))
  const asesor = elegido ?? asesorPorId(ASESOR_POR_DEFECTO)!
  const porDefecto = !elegido

  if (!haySupabase()) {
    const falta = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((x) => !process.env[x]?.trim())
    return json(503, { error: 'sin_almacen', falta, parecidas: Object.keys(process.env).filter((x) => /supabase/i.test(x)).sort() })
  }
  if (!hayGoogle()) return json(503, { error: 'sin_calendario', falta: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'].filter((x) => !process.env[x]?.trim()) })

  let reserva: string | null = null
  try {
    // El mismo envío repetido devuelve la misma reunión (idempotencia)
    const previa = await reservaPorClave(clave)
    if (previa?.status === 'confirmada') return json(200, confirmacion(previa, asesorPorId(previa.staff_id)?.nombre ?? asesor.nombre))

    if (s) await guardarSesion({ ...s, estado: 'AGENDA', asesor: asesor.id, ultima: Date.now() }, 'agenda')
    const contactoId = await guardarContacto(contacto)
    await guardarPermisos(contactoId, consentimientos, POLITICA, `proli_${canal}`)

    // 1) Bloquear el horario para este asesor (otra pantalla no puede tomarlo a la vez)
    await liberarBloqueosVencidos()
    try {
      reserva = await bloquearHorario({
        contact_id: contactoId, session_id: s?.id ?? null, staff_id: asesor.id, staff_pending: false, assigned_by_default: porDefecto,
        starts_at: inicio.toISOString(), ends_at: fin.toISOString(), meeting_type: presencial ? 'presencial' : 'meet',
        purpose: proposito || ficha?.objetivo || null, objective_short: ficha?.meta_corta || null,
        // Un reintento tras un fallo de calendario es un intento nuevo (la reserva fallida quedó cancelada)
        idempotency_key: previa ? `${clave}-${Date.now()}` : clave,
      })
    } catch (e) {
      if (e instanceof Conflicto) return json(409, { error: 'horario_tomado' })
      throw e
    }
    // 2) Volver a mirar el calendario del asesor justo antes de crear la reunión
    const ocupado = await ocupados([asesor.correo], inicio, fin)
    if (!libres([inicio], ocupado[asesor.correo]).length) {
      await actualizarReserva(reserva, { status: 'cancelada' })
      return json(409, { error: 'horario_tomado' })
    }
    // 3) Un solo evento en el calendario de hello@, con el visitante y el asesor
    const descripcion = [
      `Conversación de 20 minutos con ${contacto.nombre} (${contacto.organizacion}).`,
      proposito || ficha?.objetivo ? `Lo que quiere lograr: ${proposito || ficha?.objetivo}` : '',
      ficha?.hipotesis && consentimientos.conservar_ficha ? `Hipótesis inicial por validar (no es un diagnóstico): ${ficha.hipotesis}` : '',
      'Agendada con Proli en el GovTech Summit 2026.',
    ].filter(Boolean).join('\n\n')
    let evento
    try {
      evento = await crearEvento({
        titulo: `Proliferante | Exploración de iniciativa — ${contacto.organizacion}`, descripcion, inicio, fin,
        invitados: [contacto.email, asesor.correo], meet: !presencial, clave: reserva,
        lugar: presencial ? 'Stand de Proliferante, GovTech Summit 2026 (Bogotá)' : undefined,
      })
    } catch (e) {
      console.error('[proli registro] calendario', e instanceof Error ? e.message : e)
      await actualizarReserva(reserva, { status: 'cancelada' })
      return json(502, { error: 'calendario' })
    }
    const faltan = [contacto.email, asesor.correo].filter((x) => !evento.invitados.includes(x.toLowerCase()))
    // 4) Confirmada en el CRM. Si esto falla, el evento existe: queda para reconciliar, sin crear otro
    try {
      await actualizarReserva(reserva, { status: 'confirmada', calendar_event_id: evento.id, meet_link: evento.enlace })
      if (ficha && consentimientos.conservar_ficha) {
        await guardarFicha({
          session_id: s?.id ?? null, contact_id: contactoId, organization: ficha.organizacion || contacto.organizacion,
          role: ficha.rol || contacto.cargo || null, objective_declared: ficha.objetivo || proposito, situation_declared: ficha.situacion || null,
          hypothesis_unverified: ficha.hipotesis || null, pending_validation: ficha.por_conocer || null, visitor_approved: ficha.aprobada, staff_id: asesor.id,
        })
      }
      await guardarInteraccion({
        contact_id: contactoId, session_id: s?.id ?? null, channel: canal, staff_id: asesor.id,
        next_action: porDefecto ? 'reunion_con_paola_por_defecto' : 'preparar_reunion', status: 'reunion_confirmada',
      })
    } catch (e) {
      console.error(`[proli registro] RECONCILIAR evento ${evento.id} reserva ${reserva}:`, e instanceof Error ? e.message : e)
    }
    if (faltan.length) {
      // Alerta al buzón central: Google no devolvió a todos los invitados
      try { await enviarCorreo(BUZON_CENTRAL, 'Proli: revisar invitados de una reunión', `La reunión ${evento.id} (${fechaLarga(inicio)}, ${horaCorta(inicio)}) no muestra como invitados a: ${faltan.join(', ')}. Revísala en el calendario de hello@.`) } catch { /* el registro ya quedó */ }
    }
    return json(200, confirmacion({ starts_at: inicio.toISOString(), ends_at: fin.toISOString(), meet_link: evento.enlace, meeting_type: presencial ? 'presencial' : 'meet' }, asesor.nombre))
  } catch (e) {
    console.error('[proli registro]', e instanceof Error ? e.message : e)
    if (reserva) { try { await actualizarReserva(reserva, { status: 'cancelada' }) } catch { /* se libera sola a los 5 minutos */ } }
    return json(502, { error: 'fallo' })
  }
}
