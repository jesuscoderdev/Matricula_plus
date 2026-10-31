/**
 * Proli V9: el formulario de contacto, la ficha aprobada y la solicitud de cita (POST /api/registro).
 *
 * Fase 1 (sin calendario conectado): la cita queda «solicitada» con la franja preferida y el equipo la
 * confirma. Nunca se responde «confirmada»: eso solo pasará con un evento real de calendario (fase 2).
 * Guarda en el CRM (api/_proli/v9/almacen.ts) solo con los consentimientos de la sección 9: gestionar la
 * cita es obligatorio para agendar; conservar la ficha y las comunicaciones comerciales son opcionales.
 *
 *   entrada: { token?, canal, clave, contacto: {nombre, organizacion, email, cargo?, celular?},
 *              consentimientos: {gestionar_cita, conservar_ficha, comunicaciones_comerciales},
 *              asesor: id | 'por_asignar', ficha?: {...,aprobada}, agenda?: {proposito, franja, modalidad} }
 *   salida:  { ok: true, estado: 'solicitud_registrada' | 'ficha_guardada', reserva }
 */
import { abrir } from './_proli/v9/sesion.js'
import { asesorPorId, POR_ASIGNAR } from './_proli/v9/asesores.js'
import { guardarRegistro, hayAlmacen, type Registro } from './_proli/v9/almacen.js'

const POLITICA = 'politica-datos-2026-09-23+aviso-govtech-borrador'
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
  if (!contacto.nombre || !contacto.organizacion) return json(400, { error: 'campos', campo: !contacto.nombre ? 'nombre' : 'organizacion' })
  if (!CORREO.test(contacto.email)) return json(400, { error: 'campos', campo: 'email' })

  const k = (b.consentimientos ?? {}) as Record<string, unknown>
  const consentimientos = { gestionar_cita: k.gestionar_cita === true, conservar_ficha: k.conservar_ficha === true, comunicaciones_comerciales: k.comunicaciones_comerciales === true }
  const a = b.agenda as Record<string, unknown> | undefined
  const agenda = a ? { proposito: texto(a.proposito, 500), franja: texto(a.franja, 120), modalidad: a.modalidad === 'presencial' ? 'presencial' as const : 'meet' as const } : null
  // Agendar exige el consentimiento para gestionar la cita; sin él no se guarda nada (C21, C22)
  if (agenda && !consentimientos.gestionar_cita) return json(400, { error: 'consentimiento' })
  if (!agenda && !consentimientos.conservar_ficha) return json(400, { error: 'consentimiento' })

  const f = b.ficha as Record<string, unknown> | undefined
  const ficha = f ? {
    organizacion: texto(f.organizacion, 160), rol: texto(f.rol, 160), objetivo: texto(f.objetivo, 500), situacion: texto(f.situacion, 500),
    hipotesis: texto(f.hipotesis, 500), por_conocer: texto(f.por_conocer, 500), aprobada: f.aprobada === true,
  } : null
  const clave = texto(b.clave, 80)
  if (clave.length < 16) return json(400, { error: 'clave' })
  const asesor = b.asesor === POR_ASIGNAR ? null : asesorPorId(typeof b.asesor === 'string' ? b.asesor : null)?.id ?? null
  // La sesión firmada (si la hay) vincula el registro con su conversación; sin conexión puede faltar
  const s = b.token ? abrir(b.token, 180) : null
  const canal = s?.canal ?? (CANALES.has(String(b.canal)) ? String(b.canal) : 'celular')

  if (!hayAlmacen()) return json(503, { error: 'sin_almacen' })
  const registro: Registro = {
    sesion: s ? { id: s.id, canal: s.canal, estado: agenda ? 'AGENDA' : 'TERMINADO', preguntas: s.preguntas, desvios: s.desvios, asesor: asesor ?? s.asesor, creada: s.creada, ultima: Date.now() } : null,
    canal, contacto, consentimientos, asesor: asesor ?? s?.asesor ?? null, ficha, agenda, clave, politica: POLITICA,
  }
  try {
    const r = await guardarRegistro(registro)
    return json(200, { ok: true, estado: agenda ? 'solicitud_registrada' : 'ficha_guardada', reserva: r.reserva })
  } catch (e) {
    console.error('[proli-v9 registro]', e instanceof Error ? e.message : e)
    return json(502, { error: 'fallo' })
  }
}
