/**
 * Proli como cursor: antes de aplicar una orden (cambiar reglas, ir a un capítulo, tocar ▶ Asignar…),
 * una versión pequeña de Proli sale de su esquina, vuela hasta el control real de la pantalla, lo
 * «toca» y vuelve. Así el visitante ve qué hizo Proli y dónde podría hacerlo él mismo.
 *
 * Los controles se marcan con `data-proli="…"` (ver selectorDe). Si el control no está en pantalla
 * (por ejemplo, las reglas cuando el visitante está en otro capítulo), la orden se aplica primero y
 * Proli toca el control cuando aparece, como confirmación. Con «reducir movimiento» no vuela.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ProliAnimado from '../componentes/ProliAnimado'
import type { Orden } from './ordenes'

const MS_VUELO = 650
const MS_TOQUE = 380
const MS_MAXIMO = 2500     // si algo interrumpe el vuelo, la orden sigue igual

/** El control de la pantalla que corresponde a una orden, si tiene uno. */
export function selectorDe(o: Orden): string | null {
  const e = o.entrada
  const v = (k: string) => String(e[k])
  switch (o.nombre) {
    case 'matricula_capitulo': case 'movilidad_capitulo': return `[data-proli="cap-${v('capitulo')}"]`
    case 'matricula_reglas': return `[data-proli="reglas-${v('reglas')}"]`
    case 'matricula_colegio_nuevo': return `[data-proli="colegio-${v('ubicacion')}"]`
    // El colegio que queda elegido (se sabe cuál solo después de aplicar la orden)
    case 'matricula_colegio_sugerido': return '.chip--colegio.chip--activo'
    case 'matricula_jornada_unica': return '[data-proli="jornada"]'
    case 'matricula_asignar': return '[data-proli="asignar"]'
    case 'movilidad_localidad': return `[data-proli="localidad-${v('localidad')}"]`
    case 'movilidad_presupuesto': return `[data-proli="presupuesto-${v('nivel')}"]`
    case 'movilidad_tipo_via': return `[data-proli="zona-${v('zona')}"]`
    case 'movilidad_anio_mapa': return `[data-proli="anio-${v('anio')}"]`
    case 'abrir_demo': return `[data-proli="demo-${v('demo')}"]`
    case 'abrir_agenda': return `[data-proli="cap-${v('demo') === 'movilidad' ? 'cierre' : 'agendar'}"]`
    default: return null
  }
}

/** El elemento, si existe y se ve en la pantalla. */
export function visible(selector: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight ? el : null
}

interface Vuelo { desde: { x: number; y: number }; hasta: { x: number; y: number }; fin: () => void }
let lanzar: ((v: Vuelo) => void) | null = null
const oyentesVuelo = new Set<(volando: boolean) => void>()
const avisar = (volando: boolean) => oyentesVuelo.forEach((f) => f(volando))

/** ¿Está Proli volando? (el Proli de la esquina se esconde mientras tanto). */
export function useVolando() {
  const [volando, setVolando] = useState(false)
  useEffect(() => { oyentesVuelo.add(setVolando); return () => { oyentesVuelo.delete(setVolando) } }, [])
  return volando
}

const centro = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }

/** Proli vuela hasta el control, lo toca y vuelve. Termina cuando el toque ocurrió. */
export function senalar(selector: string): Promise<void> {
  const el = visible(selector)
  const casa = document.querySelector('.proli-flotante__figura') ?? document.querySelector('.proli-panel__avatar')
  if (!el || !lanzar || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  const desde = casa ? centro(casa) : { x: window.innerWidth - 60, y: window.innerHeight - 120 }
  return new Promise((resolver) => {
    let hecho = false
    const terminar = () => {
      if (hecho) return
      hecho = true
      el.classList.add('proli-tocado')
      window.setTimeout(() => el.classList.remove('proli-tocado'), 900)
      resolver()
    }
    avisar(true)
    lanzar!({ desde, hasta: centro(el), fin: terminar })
    // Por si el vuelo se interrumpe (otro vuelo, o Proli se oculta): la orden no queda esperando
    window.setTimeout(() => { if (!hecho) { terminar(); avisar(false) } }, MS_MAXIMO)
  })
}

/** El Proli que vuela. Va una sola vez en la app (Asistente.tsx). */
export function CursorProli() {
  const [vuelo, setVuelo] = useState<(Vuelo & { id: number }) | null>(null)
  const [fase, setFase] = useState<'ida' | 'toque' | 'vuelta'>('ida')
  useEffect(() => {
    let n = 0
    let actual: Vuelo | null = null
    // Un vuelo nuevo reemplaza al anterior, pero el anterior se da por terminado (su orden sigue)
    lanzar = (v) => { actual?.fin(); actual = v; setFase('ida'); setVuelo({ ...v, id: ++n }) }
    return () => { actual?.fin(); avisar(false); lanzar = null }
  }, [])
  if (!vuelo) return null
  const { desde, hasta } = vuelo
  const pos = fase === 'vuelta' ? desde : hasta
  // El cursor apunta con la mano: Proli se ubica un poco abajo a la derecha del punto que toca
  return (
    <AnimatePresence>
      <motion.div key={vuelo.id} className="proli-cursor" aria-hidden
                  initial={{ x: desde.x, y: desde.y, scale: 0.6, opacity: 0 }}
                  animate={{ x: pos.x, y: pos.y, scale: fase === 'toque' ? 0.9 : 1, opacity: fase === 'vuelta' ? 0 : 1 }}
                  transition={{ duration: (fase === 'toque' ? MS_TOQUE : MS_VUELO) / 1000, ease: [0.45, 0, 0.2, 1] }}
                  onAnimationComplete={() => {
                    if (fase === 'ida') { setFase('toque'); vuelo.fin() }
                    else if (fase === 'toque') setFase('vuelta')
                    else { setVuelo(null); avisar(false) }
                  }}>
        <ProliAnimado tamano={2.8} mirar={{ x: -0.6, y: -0.7 }} hablando={fase === 'toque'} />
        {fase === 'toque' && <span className="proli-cursor__onda" />}
      </motion.div>
    </AnimatePresence>
  )
}
