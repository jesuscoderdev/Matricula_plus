/**
 * Proli V9 en el navegador: los turnos de la conversación (/api/conversa) y el registro (/api/registro).
 * Si no hay conexión al registrar, la solicitud se guarda en este dispositivo y se reintenta sola al
 * volver la conexión (plan B del stand); al enviarse, se borra.
 */
export type Accion = 'chat' | 'ficha' | 'agenda' | 'cerrado' | 'terminado'
export interface Ficha { organizacion: string; rol: string; objetivo: string; situacion: string; hipotesis: string; por_conocer: string }
export interface Respuesta { token: string; mensaje: string; accion: Accion; ficha: Ficha | null }
export type Canal = 'stand' | 'celular' | 'escritorio' | 'qr'

export interface Registro {
  token: string | null
  canal: Canal
  clave: string
  contacto: { nombre: string; organizacion: string; email: string; cargo: string; celular: string }
  consentimientos: { gestionar_cita: boolean; conservar_ficha: boolean; comunicaciones_comerciales: boolean }
  asesor: string
  ficha: (Ficha & { aprobada: boolean }) | null
  agenda: { proposito: string; franja: string; modalidad: 'meet' | 'presencial' } | null
}

export class ErrorProli extends Error {
  constructor(readonly codigo: string, readonly campo?: string) { super(codigo) }
}

async function post<T>(ruta: string, cuerpo: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  } catch { throw new ErrorProli('sin_conexion') }
  const datos = await r.json().catch(() => ({})) as T & { error?: string; campo?: string }
  if (!r.ok) throw new ErrorProli(datos.error ?? `http_${r.status}`, datos.campo)
  return datos
}

export const enviarTurno = (texto: string, token: string | null, canal: Canal, asesor: string | null) =>
  post<Respuesta>('./api/conversa', token ? { token, texto } : { texto, canal, asesor })

// --- Registro, con cola local si no hay conexión ---
const COLA = 'proli-v9-pendientes'
const leerCola = (): Registro[] => { try { return JSON.parse(localStorage.getItem(COLA) ?? '[]') } catch { return [] } }
const escribirCola = (c: Registro[]) => { try { if (c.length) localStorage.setItem(COLA, JSON.stringify(c)); else localStorage.removeItem(COLA) } catch { /* sin almacenamiento */ } }
/** Errores que justifican reintentar más tarde (la red o el servidor), no los de validación */
const reintentable = (e: unknown) => e instanceof ErrorProli && ['sin_conexion', 'sin_almacen', 'fallo', 'http_500', 'http_502', 'http_503', 'http_504'].includes(e.codigo)

/** Envía el registro; si falla por conexión, lo deja en cola y devuelve 'en_cola' */
export async function registrar(r: Registro): Promise<'enviado' | 'en_cola'> {
  try {
    await post('./api/registro', r)
    return 'enviado'
  } catch (e) {
    if (!reintentable(e)) throw e
    escribirCola([...leerCola().filter((x) => x.clave !== r.clave), r])
    return 'en_cola'
  }
}

/** Reintenta lo que quedó en cola (al cargar y al volver la conexión) */
export async function vaciarCola() {
  const pendientes = leerCola()
  if (!pendientes.length) return
  const quedan: Registro[] = []
  for (const r of pendientes) {
    try { await post('./api/registro', r) } catch (e) { if (reintentable(e)) quedan.push(r) }
  }
  escribirCola(quedan)
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void vaciarCola() })
  window.setTimeout(() => { void vaciarCola() }, 3000)
}

export const nuevaClave = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`)
