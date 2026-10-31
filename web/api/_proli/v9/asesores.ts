/**
 * Directorio autorizado de asesores de Proliferante (especificación V9, sección 5). Lo usan el servidor
 * (registro y, en la fase 2, las invitaciones de calendario) y el sitio (selector «¿Con quién conversaste?»).
 * Debe coincidir con la tabla staff_directory (supabase/001_proli_v9.sql). Sin imports: lo leen el
 * navegador, el servidor y las pruebas.
 */
export interface Asesor { id: string; nombre: string; correo: string }

export const ASESORES: Asesor[] = [
  { id: 'paola', nombre: 'Paola Arciniegas', correo: 'paola.a@proliferante.com' },
  { id: 'vero', nombre: 'Vero Rincón', correo: 'vero.r@proliferante.com' },
  { id: 'juan', nombre: 'Juan Esteban Estrada', correo: 'juan.e@proliferante.com' },
  { id: 'felipe', nombre: 'Felipe Narváez', correo: 'felipe.n@proliferante.com' },
  { id: 'natalia', nombre: 'Natalia Caro', correo: 'nati.c@proliferante.com' },
]

/** Buzón central: recibe todas las invitaciones y las solicitudes sin asesor */
export const BUZON_CENTRAL = 'hello@proliferante.com'

/** «No recuerdo / no conversé con nadie»: nunca se asigna un asesor al azar */
export const POR_ASIGNAR = 'por_asignar'

export const asesorPorId = (id: string | null | undefined) => ASESORES.find((a) => a.id === id) ?? null
