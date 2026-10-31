/**
 * La página de Proli: Proli V9 (especificación de Paola, 31-oct-2026). Proli saluda y hace una
 * conversación breve de descubrimiento (máximo 3 preguntas, límites en el servidor), muestra una ficha
 * editable con una hipótesis por validar y ofrece agendar 20 minutos con el equipo (ConversaV9).
 *
 * Se llega con «Contarle mi reto a Proli» o «Agendar 20 minutos» (al final de cada demo), desde el panel
 * de Proli dentro de los demos, o directo a govtech.proliferante.com/proli (src/rutas.ts), por ejemplo
 * con los Prolis físicos (NFC). Aquí no hay demos a la vista: «Ver los demos» lleva a elegirlos.
 */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import ProliAnimado from '../componentes/ProliAnimado'
import { BotonTema, LogoEmpresa, MarcaDeAgua } from '../componentes/Marca'
import { PROLI_PAGINA, type IdProyecto } from '../config'
import { esTotem, type Modo } from '../modo'
import { informarPantalla } from './ordenes'
import { PANTALLA_PROLI } from './conversacion'
import { decir, hayVoz } from './voz'
import ConversaV9 from './v9/ConversaV9'

export default function PaginaProli({ modo, agenda = false, alVolver, alPortada }: {
  modo: Modo
  /** de qué demo viene el visitante (null: llegó directo, p. ej. a /proli) */
  desde: IdProyecto | null
  /** llegó con «Agendar 20 minutos»: directo al formulario */
  agenda?: boolean
  /** a elegir reto */
  alVolver: () => void
  alPortada?: () => void
}) {
  const totem = esTotem(modo)
  // El panel de Proli de los demos se oculta aquí (Asistente.tsx mira esta pantalla)
  useEffect(() => { informarPantalla(PANTALLA_PROLI) }, [])
  const [voz, setVoz] = useState<'hablando' | 'bloqueada' | 'lista'>('lista')
  const callar = useRef<() => void>(() => {})

  const hablar = () => {
    callar.current()
    callar.current = decir(PROLI_PAGINA.saludo, {
      audio: PROLI_PAGINA.audioSaludo,
      alEmpezar: () => setVoz('hablando'),
      alTerminar: () => setVoz((v) => (v === 'bloqueada' ? v : 'lista')),
      alBloquear: () => setVoz('bloqueada'),
    })
  }
  // Con voz (PROLI_PAGINA.voz), Proli saluda en voz alta al llegar; los navegadores no dejan hablar a
  // una página que nadie ha tocado: entonces saluda con el primer toque fuera del chat
  useEffect(() => {
    if (!PROLI_PAGINA.voz || agenda) return
    const activa = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    const bloqueada = !!activa && !activa.hasBeenActive
    if (bloqueada) setVoz('bloqueada')
    else hablar()
    const alTocar = (e: PointerEvent) => {
      if (!e.isTrusted) return
      window.removeEventListener('pointerdown', alTocar)
      if (!(e.target as Element).closest?.('.pagina-proli__chat, .pagina-proli__voz')) hablar()
    }
    if (bloqueada) window.addEventListener('pointerdown', alTocar)
    return () => { window.removeEventListener('pointerdown', alTocar); callar.current() }
  }, [])

  return (
    <div className="app pagina-proli pagina-proli--conversando">
      <MarcaDeAgua className="marca-agua--pagina-proli" />
      <header className="pagina-proli__marca">
        <LogoEmpresa alTocar={alPortada} />
        <button type="button" className="pagina-proli__demos" onClick={alVolver}>Ver los demos →</button>
        {!totem && <BotonTema />}
      </header>

      <main className="pagina-proli__cuerpo">
        <section className="pagina-proli__heroe" aria-label="Proli">
          <motion.div className="pagina-proli__figura" layout initial={{ opacity: 0, scale: 0.6, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 14 }}>
            <span className="proli-intro__halo" aria-hidden />
            <span className="pagina-proli__img">
              <ProliAnimado hablando={voz === 'hablando'} saludar={voz === 'hablando'} seguir />
            </span>
          </motion.div>
          <motion.div className="pagina-proli__presenta" layout>
            <h1 className="display pagina-proli__nombre">Hola, soy <em>Proli</em></h1>
            {PROLI_PAGINA.voz && hayVoz() && (
              <button type="button" className={`pagina-proli__voz ${voz === 'bloqueada' ? 'pagina-proli__voz--llamar' : ''}`}
                      onClick={() => (voz === 'hablando' ? (callar.current(), setVoz('lista')) : hablar())}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6 9H2v6h4l5 4V5z" />
                  {voz === 'hablando' ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
                </svg>
                {voz === 'hablando' ? 'Silenciar' : 'Escuchar a Proli'}
              </button>
            )}
          </motion.div>
        </section>

        <ConversaV9 modo={modo} agendaInicial={agenda} alDemos={alVolver} alTerminar={totem ? alPortada : undefined} />
      </main>
    </div>
  )
}
