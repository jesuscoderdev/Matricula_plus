/**
 * La página de Proli: solo la conversación, sin demos alrededor. Proli grande saluda con la mano y en
 * voz alta (voz.ts) mientras escribe su saludo; debajo (o al lado, en pantallas anchas) el chat, con
 * espacio de sobra. Al empezar a conversar, Proli se hace pequeño y el chat ocupa la pantalla.
 *
 * Se llega de dos formas:
 *  · dentro de la app (`enApp`): con «Contarle mi reto a Proli», al final de cada demo o al elegir
 *    reto. Proli sabe de qué demo viene el visitante, y si quiere mostrarle un demo, lo abre de verdad
 *    (la conversación sigue en el panel del demo: es la misma, conversacion.ts).
 *  · sola, en govtech.proliferante.com/proli: aquí no hay demos; cuando Proli quiere mostrar uno,
 *    aparece en el chat el botón para abrirlo.
 *
 * La cita aparece en el chat: el código QR en el tótem y el botón de WhatsApp en celular y computador.
 * El aviso de privacidad queda siempre a la vista, bajo el campo de texto.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import ProliAnimado from '../componentes/ProliAnimado'
import AvisoPrivacidad from '../componentes/AvisoPrivacidad'
import QrCita from '../componentes/QrCita'
import { BotonTema, LogoEmpresa, MarcaDeAgua } from '../componentes/Marca'
import { EMPRESA, NOMBRE_MOVILIDAD, PROLI_PAGINA, URL_CITA, urlCitaCon, type IdProyecto } from '../config'
import { esTotem, leerModo, type Modo } from '../modo'
import { BOTON_WHATSAPP, fijarAgendaEnPagina, informarPantalla, leerReto, registrar, useReto } from './ordenes'
import { PANTALLA_PROLI, avisarActividad, esPropuesta, useConversacion, type Sugerencia } from './conversacion'
import { decir, hayVoz } from './voz'

const MS_LETRA = 24          // velocidad con que Proli escribe su saludo
const SEGUNDOS_LECTURA = 20  // margen extra para leer la respuesta antes de la inactividad del tótem
type Demo = 'matricula' | 'movilidad'
const DEMOS: Record<Demo, { nombre: string; url: string }> = {
  matricula: { nombre: 'Matrícula+', url: './?proyecto=educacion' },
  movilidad: { nombre: NOMBRE_MOVILIDAD, url: './?proyecto=movilidad' },
}
const demoDe = (p: IdProyecto | null): Demo | null => (p === 'educacion' ? 'matricula' : p === 'movilidad' ? 'movilidad' : null)

const sugerencias = (totem: boolean): Sugerencia[] => [
  { texto: 'Tengo un reto en mi entidad', ordenes: [{ nombre: 'abrir_agenda', entrada: { demo: 'matricula' } }], conversar: true,
    sinConexion: totem
      ? '¡Qué bueno! Ahora no puedo conversar, pero el equipo sí y le encantará escucharte. Escanea el código con tu celular para enviarle tu solicitud: te confirmarán un horario.'
      : '¡Qué bueno! Ahora no puedo conversar, pero el equipo sí y le encantará escucharte. Toca «Agendar conversación» para escribirle por WhatsApp: te confirmarán un horario.' },
  { texto: '¿Qué es Proliferante?', sinConexion: 'Un estudio de innovación aplicada: conectamos datos, matemáticas, IA y tecnología para que las organizaciones decidan mejor, y dejamos esas capacidades funcionando. Hacemos simple lo complejo.' },
  { texto: '¿Qué demos tienen?', sinConexion: `Dos retos reales de Bogotá: Matrícula+, para que más niños estudien cerca de casa, y ${NOMBRE_MOVILIDAD}, para decidir dónde invertir primero en seguridad vial. Toca «Ver los demos» para explorarlos.` },
  { texto: '¿Qué hacen con mis datos?', sinConexion: 'Solo usamos lo que tú decidas compartir, para coordinar una conversación sobre tu reto. Toca «aviso de privacidad», debajo del chat, para leer el detalle.' },
]

/** El saludo aparece letra por letra, como si Proli lo fuera escribiendo. */
function useEscribiendo(texto: string, activo: boolean) {
  const [n, setN] = useState(activo ? 0 : texto.length)
  useEffect(() => {
    if (!activo) return
    const id = window.setInterval(() => setN((x) => (x >= texto.length ? x : x + 1)), MS_LETRA)
    return () => window.clearInterval(id)
  }, [texto, activo])
  return texto.slice(0, n)
}

/**
 * Lo que Proli puede hacer desde esta página. La agenda siempre aparece en el chat. Sola (sin la app),
 * no hay demos que abrir: Proli los ofrece con un botón; devuelve el demo ofrecido, para mostrarlo.
 */
function useOrdenesDePagina(totem: boolean, conDemos: boolean, pantalla: string) {
  const [demo, setDemo] = useState<Demo | null>(null)
  useEffect(() => { informarPantalla(pantalla) }, [pantalla])
  useEffect(() => fijarAgendaEnPagina(() => {
    const reto = !!leerReto()
    const como = totem
      ? 'Es el tótem: el visitante envía la solicitud escaneando con su celular el código QR que apareció en este chat. No hay botón para enviarla desde aquí: no menciones ningún botón.'
      : `En este chat apareció el botón «${BOTON_WHATSAPP(reto)}», que abre WhatsApp con el mensaje ya escrito: dile que lo toque. Aquí no hay código QR: no lo menciones.`
    return `${reto ? 'Listo: tu reto quedó escrito en el mensaje para el equipo.' : 'Listo: en el chat, cómo escribirle al equipo.'} | ${como} El visitante envía el mensaje él mismo y el equipo le responde para confirmar un horario: todavía no es una cita.`
  }), [totem])
  useEffect(() => {
    if (conDemos) return
    const ofrecer = (d: Demo) => {
      setDemo(d)
      return `Listo: en el chat apareció el botón «Abrir ${DEMOS[d].nombre}». | Aquí no hay demos a la vista: el botón abre ${DEMOS[d].nombre} en esta misma pestaña. Cuéntale en pocas palabras qué va a ver; no digas que ya está en pantalla.`
    }
    const bajas = [
      registrar('inicio', (o) => {
        if (o.nombre === 'abrir_demo') return ofrecer(o.entrada.demo === 'movilidad' ? 'movilidad' : 'matricula')
        return 'Aquí no hay demos a la vista: en el enlace «Ver los demos», arriba, el visitante encuentra los dos retos. Cuéntale en palabras lo que quiere saber.'
      }),
      registrar('matricula', () => ofrecer('matricula')),
      registrar('movilidad', () => ofrecer('movilidad')),
    ]
    return () => bajas.forEach((b) => b())
  }, [conDemos])
  return demo
}

export default function PaginaProli({ enApp }: {
  /** dentro de la app: de qué demo viene el visitante y a dónde vuelve (sin esto, la página sola de /proli) */
  enApp?: { modo: Modo; desde: IdProyecto | null; alVolver: () => void; alPortada?: () => void }
}) {
  const modo = enApp?.modo ?? leerModo()
  const totem = esTotem(modo)
  const desde = demoDe(enApp?.desde ?? null)
  const reducir = useReducedMotion()
  const reto = useReto()
  const { lineas, ocupado, sinConexion, cita, preguntar, reiniciar } = useConversacion()
  const pantalla = enApp
    ? `${PANTALLA_PROLI}${desde ? `, después de ver ${DEMOS[desde].nombre}` : ''}: aquí no hay demos a la vista; si el visitante quiere ver uno, ábrelo`
    : `${PANTALLA_PROLI} (govtech.proliferante.com/proli): aquí no hay demos a la vista`
  const demo = useOrdenesDePagina(totem, !!enApp, pantalla)
  const [texto, setTexto] = useState('')
  const refLista = useRef<HTMLDivElement>(null)
  // Si viene de un demo, Proli lo recibe con el reto; si no, se presenta
  const saludoEscrito = desde ? PROLI_PAGINA.despues : PROLI_PAGINA.saludo
  const saludo = useEscribiendo(saludoEscrito, !reducir)
  const escribiendo = saludo.length < saludoEscrito.length
  const [voz, setVoz] = useState<'hablando' | 'bloqueada' | 'lista'>('lista')
  const callar = useRef<() => void>(() => {})
  const conversando = lineas.length > 0

  // Sola, la página pone su modo (celular o computador) y su título; en la app ya lo hace Inicio
  useEffect(() => {
    if (enApp) return
    document.documentElement.dataset.modo = modo
    document.title = `Proli · ${EMPRESA}`
  }, [enApp, modo])

  const hablar = () => {
    callar.current()
    callar.current = decir(desde ? `¡Hola! ${PROLI_PAGINA.despues}` : `Hola, soy Proli. ${PROLI_PAGINA.saludo}`, {
      audio: desde ? PROLI_PAGINA.audioDespues : PROLI_PAGINA.audioSaludo,
      alEmpezar: () => setVoz('hablando'),
      alTerminar: () => setVoz((v) => (v === 'bloqueada' ? v : 'lista')),
      alBloquear: () => setVoz('bloqueada'),
    })
  }
  // Al llegar, Proli saluda en voz alta (si ya hay conversación, no interrumpe). Los navegadores no
  // dejan hablar a una página que nadie ha tocado: entonces saluda con el primer toque fuera del chat,
  // y el botón late mientras tanto
  const refConversando = useRef(conversando)
  refConversando.current = conversando
  useEffect(() => {
    if (!PROLI_PAGINA.voz || refConversando.current) return
    const activa = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    const bloqueada = !!activa && !activa.hasBeenActive
    if (bloqueada) setVoz('bloqueada')
    else hablar()
    const alTocar = (e: PointerEvent) => {
      if (!e.isTrusted) return   // avisarActividad() también dispara pointerdown
      window.removeEventListener('pointerdown', alTocar)
      if (!refConversando.current && !(e.target as Element).closest?.('.pagina-proli__chat, .pagina-proli__voz')) hablar()
    }
    if (bloqueada) window.addEventListener('pointerdown', alTocar)
    return () => { window.removeEventListener('pointerdown', alTocar); callar.current() }
  }, [])
  // Al empezar a conversar, Proli deja de hablar
  useEffect(() => { if (conversando) callar.current() }, [conversando])
  useEffect(() => { refLista.current?.scrollTo({ top: refLista.current.scrollHeight, behavior: 'smooth' }) }, [lineas, cita, ocupado, demo])
  // Tótem: margen para leer la respuesta antes de que la inactividad vuelva a la portada
  useEffect(() => {
    if (ocupado || !lineas.length) return
    const id = window.setTimeout(avisarActividad, SEGUNDOS_LECTURA * 1000)
    return () => window.clearTimeout(id)
  }, [ocupado, lineas.length])

  const preguntarYLimpiar = (pregunta: string, s?: Sugerencia) => {
    if (!ocupado && pregunta.trim()) setTexto('')
    preguntar(pregunta, s)
  }
  const enviar = (e: FormEvent) => { e.preventDefault(); preguntarYLimpiar(texto) }
  const ultima = lineas[lineas.length - 1]
  const propuso = !ocupado && ultima?.quien === 'proli' && !sinConexion && esPropuesta(ultima.texto)
  const opciones: Sugerencia[] = [
    ...(propuso ? [{ texto: 'Sí, muéstramelo', sinConexion: 'Ahora no tengo conexión para hacerlo, pero puedes tocar «Ver los demos» para explorarlos.' }] : []),
    ...sugerencias(totem),
  ]

  return (
    <div className={`app pagina-proli ${conversando ? 'pagina-proli--conversando' : ''}`}>
      <MarcaDeAgua className="marca-agua--pagina-proli" />
      <header className="pagina-proli__marca">
        {enApp
          ? <><LogoEmpresa alTocar={enApp.alPortada} /><button type="button" className="pagina-proli__demos" onClick={enApp.alVolver}>Ver los demos →</button></>
          : <><a href="./" aria-label={`${EMPRESA}: ver los demos`}><LogoEmpresa /></a><a className="pagina-proli__demos" href="./">Ver los demos →</a></>}
        {!totem && <BotonTema />}
      </header>

      <main className="pagina-proli__cuerpo">
        <section className="pagina-proli__heroe" aria-label="Proli">
          <motion.div className="pagina-proli__figura" layout initial={{ opacity: 0, scale: 0.6, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 14 }}>
            <span className="proli-intro__halo" aria-hidden />
            <span className="pagina-proli__img">
              <ProliAnimado hablando={voz === 'hablando' || escribiendo || ocupado} saludar={!conversando && (escribiendo || voz === 'hablando')} seguir />
            </span>
          </motion.div>
          <motion.div className="pagina-proli__presenta" layout>
            <h1 className="display pagina-proli__nombre">Hola, soy <em>Proli</em></h1>
            {!conversando && (
              <p className="pagina-proli__saludo" aria-label={saludoEscrito}>
                <span aria-hidden>{saludo}{escribiendo && <i className="proli-intro__cursor" />}</span>
              </p>
            )}
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

        <section className="pagina-proli__chat" aria-label="Conversación con Proli">
          <header className="pagina-proli__chat-cabeza">
            <span><b>Conversa con Proli</b><small>{ocupado ? 'Escribiendo…' : sinConexion ? 'Sin conexión: respuestas guardadas' : 'Tu guía de Proliferante'}</small></span>
            {conversando && <button type="button" className="proli-panel__nuevo" onClick={() => { reiniciar(); setTexto('') }}>Reiniciar</button>}
          </header>
          <div className="pagina-proli__lista" ref={refLista} aria-live="polite">
            {!conversando && <p className="proli-panel__linea proli-panel__linea--proli">¿Por dónde empezamos? Puedes contarme un reto de tu entidad o tocar una de las preguntas de abajo.</p>}
            {lineas.filter((l) => l.texto).map((l, i) => (
              <p key={i} className={`proli-panel__linea proli-panel__linea--${l.quien}`}>{l.quien === 'accion' ? `↳ ${l.texto}` : l.texto}</p>
            ))}
            <AnimatePresence>
              {demo && !ocupado && (
                <motion.a key={demo} className="boton boton--claro pagina-proli__accion" href={DEMOS[demo].url} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  Abrir {DEMOS[demo].nombre} →
                </motion.a>
              )}
              {cita && !ocupado && (
                <motion.div key="cita" className="pagina-proli__accion" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  {totem || !URL_CITA
                    ? <QrCita />
                    : <a className="boton boton--violeta" href={urlCitaCon(reto)} target="_blank" rel="noopener noreferrer">{BOTON_WHATSAPP(!!reto)} →</a>}
                </motion.div>
              )}
            </AnimatePresence>
            {ocupado && <span className="proli-panel__puntos" aria-hidden><i /><i /><i /></span>}
          </div>
          <div className="pagina-proli__sugerencias">
            {opciones.map((s, i) => (
              <button key={s.texto} type="button" className={`proli-panel__chip ${propuso && i === 0 ? 'proli-panel__chip--si' : ''}`}
                      disabled={ocupado} onClick={() => preguntarYLimpiar(s.texto, s)}>{s.texto}</button>
            ))}
          </div>
          <form className="proli-panel__escribir pagina-proli__escribir" onSubmit={enviar}>
            <input value={texto} onChange={(e) => { setTexto(e.target.value); avisarActividad() }} maxLength={500} placeholder={PROLI_PAGINA.placeholder}
                   disabled={ocupado} aria-label="Tu pregunta para Proli" enterKeyHint="send" />
            <button type="submit" className="boton boton--violeta" disabled={ocupado || !texto.trim()}>Enviar</button>
          </form>
          <p className="pagina-proli__privacidad">Antes de compartir tus datos, revisa nuestro <AvisoPrivacidad etiqueta="aviso de privacidad" /></p>
        </section>
      </main>
    </div>
  )
}
