/**
 * Proli en el navegador: turnos de la conversación (/api/conversa), horarios (/api/disponibilidad) y la
 * reunión (/api/registro). Aislamiento (V12, sección 7.4): nada del visitante se guarda en el navegador
 * (ni localStorage ni sessionStorage); cada sesión lleva `seq` y `request_id`, y quien llama descarta las
 * respuestas que lleguen después de un reinicio. Las respuestas del servidor vienen con no-store.
 */
export type Accion = 'chat' | 'ficha' | 'agenda' | 'cerrado' | 'terminado'
export interface Ficha { organizacion: string; rol: string; objetivo: string; situacion: string; hipotesis: string; por_conocer: string; meta_corta: string }
export interface Respuesta { token: string; session_id: string; seq: number; mensaje: string; accion: Accion; ficha: Ficha | null }
export type Canal = 'stand' | 'celular' | 'escritorio' | 'qr'
export interface Horarios { asesor: string; dias: { dia: string; nombre: string }[]; dia: string; horarios: { inicio: string; hora: string }[] }
export interface Confirmada { fecha: string; hora: string; enlace: string | null; modalidad: string; asesor: string }

export interface Registro {
  token: string | null
  canal: Canal
  clave: string
  contacto: { nombre: string; organizacion: string; email: string; cargo: string; celular: string }
  consentimientos: { gestionar_cita: boolean; conservar_ficha: boolean; comunicaciones_comerciales: boolean }
  asesor: string
  ficha: (Ficha & { aprobada: boolean }) | null
  agenda: { proposito: string; inicio: string; modalidad: 'meet' | 'presencial' }
}

export class ErrorProli extends Error {
  constructor(readonly codigo: string, readonly campo?: string) { super(codigo) }
}

async function post<T>(ruta: string, cuerpo: unknown, signal?: AbortSignal): Promise<T> {
  let r: Response
  try {
    r = await fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), cache: 'no-store', signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ErrorProli('abortado')
    throw new ErrorProli('sin_conexion')
  }
  const datos = await r.json().catch(() => ({})) as T & { error?: string; campo?: string }
  if (!r.ok) throw new ErrorProli(datos.error ?? `http_${r.status}`, datos.campo)
  return datos
}

export const nuevaClave = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`)

export const enviarTurno = (p: { texto: string; token: string | null; seq: number; canal: Canal; asesor: string | null }, signal: AbortSignal) =>
  post<Respuesta>('./api/conversa', p.token
    ? { token: p.token, texto: p.texto, seq: p.seq, request_id: nuevaClave() }
    : { texto: p.texto, seq: p.seq, request_id: nuevaClave(), canal: p.canal, asesor: p.asesor }, signal)

/** Revoca la sesión en el servidor (al reiniciar o por inactividad); si falla, el token vence solo */
export const revocar = (token: string | null) => { if (token) void post('./api/conversa', { accion: 'reiniciar', token }).catch(() => {}) }

export const pedirHorarios = (asesor: string, dia: string | null, signal?: AbortSignal) =>
  post<Horarios>('./api/disponibilidad', { asesor, dia }, signal)

export const reservar = (r: Registro, signal?: AbortSignal) => post<Confirmada>('./api/registro', r, signal)
