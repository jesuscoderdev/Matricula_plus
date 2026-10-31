/**
 * Las direcciones de la app en celular y computador: cada pantalla tiene la suya, así que «atrás»
 * del navegador vuelve a la pantalla anterior (no saca del sitio) y se pueden compartir enlaces
 * directos a un demo. Los pasos dentro de cada demo no cambian la dirección: para eso está su flecha.
 *
 *  /             → portada (y «Conoce a Proli»)
 *  /retos        → elegir reto
 *  /matricula    → Matrícula+
 *  /presupuesto  → Presupuesto+
 *  /proli        → la página de Proli
 *
 * En el tótem (?modo=stand o auto), en el HTML de doble clic (file://) y con ?proyecto= la dirección
 * no cambia: ahí todo sigue como antes. Las rutas también están en vercel.json (rewrites).
 */
import type { IdProyecto } from './config'
import { esTotem, leerModo } from './modo'

export type Etapa = 'portada' | 'proli' | 'elegir' | 'conversar'
export interface Lugar { etapa: Etapa; proyecto: IdProyecto | null }

const RUTAS: { ruta: string; lugar: Lugar }[] = [
  { ruta: '/retos', lugar: { etapa: 'elegir', proyecto: null } },
  { ruta: '/matricula', lugar: { etapa: 'elegir', proyecto: 'educacion' } },
  { ruta: '/presupuesto', lugar: { etapa: 'elegir', proyecto: 'movilidad' } },
  { ruta: '/proli', lugar: { etapa: 'conversar', proyecto: null } },
]

const actual = () => window.location.pathname.replace(/\/+$/, '').toLowerCase() || '/'

/** ¿La dirección sigue a la pantalla? (no en el tótem, ni en el archivo local, ni con ?proyecto=) */
export const rutasActivas = () =>
  window.location.protocol !== 'file:' && !esTotem(leerModo()) && !new URLSearchParams(window.location.search).has('proyecto')

/** La pantalla que corresponde a la dirección actual; null si la dirección no es de la app */
export function lugarDeRuta(): Lugar | null {
  const r = actual()
  if (r === '/' || r.endsWith('.html')) return { etapa: 'portada', proyecto: null }
  return RUTAS.find((x) => x.ruta === r)?.lugar ?? null
}

/** La dirección de una pantalla */
export function rutaDe({ etapa, proyecto }: Lugar): string {
  return RUTAS.find((x) => x.lugar.proyecto === proyecto && (proyecto || x.lugar.etapa === etapa))?.ruta ?? '/'
}

/** Lleva la dirección a `ruta` (una entrada nueva en el historial), conservando ?modo= y demás */
export function irA(ruta: string, reemplazar = false) {
  if (actual() === ruta) return
  const url = ruta + window.location.search
  if (reemplazar) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
}
