/**
 * Proli, el asistente: un personaje flotante, siempre en pantalla (salvo la portada, que es la
 * pantalla de atracción, y el modo automático, donde no hay visitante). Saluda con la mano, respira,
 * parpadea y sigue el puntero con los ojos. Al tocarlo aparecen, como un globo, lo que puede hacer
 * en esta pantalla (la guía paso a paso, guia.ts) y preguntas frecuentes:
 *  · una acción: Proli lo dice, vuela hasta el control y lo cambia (cursor.tsx);
 *  · una pregunta: Proli responde moviendo la boca mientras aparece el texto.
 * Las dos funcionan sin IA y sin conexión. «Escribir otra pregunta» abre la conversación con Claude.
 *
 * La conversación con Claude está en conversacion.ts (la comparte la página propia de Proli, /proli).
 *
 * Sin conexión (o sin clave en el servidor), las preguntas sugeridas siguen funcionando con
 * respuestas preparadas y acciones locales. Esas respuestas no llevan cifras: toda cifra sale de
 * los datos, y aquí no se escribe ninguna a mano.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ProliAnimado from '../componentes/ProliAnimado'
import { esTotem, leerModo } from '../modo'
import { BOTON_WHATSAPP, ejecutar, fijarReto, usePantalla, useReto } from './ordenes'
import { CursorProli, useVolando } from './cursor'
import { capituloDe, guia, type Opcion } from './guia'
import { PANTALLA_PROLI, PAUSA_ACCION_MS, avisarActividad, dormir, esPropuesta, useConversacion, type Sugerencia } from './conversacion'
import { NOMBRE_MOVILIDAD, URL_CITA, urlCitaCon } from '../config'
import QrCita from '../componentes/QrCita'
import AvisoPrivacidad from '../componentes/AvisoPrivacidad'

const SEGUNDOS_LECTURA = 20    // margen extra para leer la respuesta antes de la inactividad del tótem
const ALTO_MINIMO_PX = 340     // si el mapa es más bajo, el panel cubre también la cabecera
const MARGEN_PX = 8
const BOTON_SOBRE_MAPA_PX = 36 // el botón cerrado, en el borde inferior del mapa (sobre la atribución)
const MS_LETRA = 28            // velocidad con que aparece lo que Proli dice
const SEGUNDOS_SALUDO = 4      // el saludo al aparecer

/**
 * Cuando un demo pone el mapa arriba y el texto con las cifras abajo (tótem, celular o cualquier
 * ventana en ese diseño), el panel (y el botón, cerrado) se acomodan sobre el mapa para no tapar el
 * texto. Se decide midiendo la pantalla real, no por el modo: el mapa cambia de alto según el
 * capítulo y el diseño puede cambiar al redimensionar. Con mapa y texto lado a lado (escritorio), o
 * fuera de los demos, no aplica.
 */
function useZonaSobreMapa(activo: boolean, pantalla: string) {
  const [zona, setZona] = useState<{ top: number; bottom: number } | null>(null)
  useEffect(() => {
    if (!activo) { setZona(null); return }
    let mapa: Element | null = null
    const medir = () => {
      // Solo en capítulos (en la portada de cada demo el mapa ocupa toda la pantalla y no hay panel)
      // y solo si el texto está debajo del mapa
      const texto = document.querySelector('.escena__panel')?.getBoundingClientRect()
      const r = mapa?.getBoundingClientRect()
      if (!texto || !r || r.height === 0 || texto.top < r.bottom - 2) { setZona(null); return }
      const top = r.height >= ALTO_MINIMO_PX ? r.top + MARGEN_PX : MARGEN_PX
      const bottom = Math.max(MARGEN_PX, window.innerHeight - r.bottom + MARGEN_PX)
      setZona((z) => (z && z.top === top && z.bottom === bottom ? z : { top, bottom }))
    }
    const obs = new ResizeObserver(medir)
    // El demo puede tardar en montarse (o cambiar de demo): se busca el mapa hasta encontrarlo
    const buscar = () => {
      const nuevo = document.querySelector('.escena__mapa')
      if (nuevo !== mapa) { if (mapa) obs.unobserve(mapa); mapa = nuevo; if (mapa) obs.observe(mapa) }
      medir()
    }
    buscar()
    const id = window.setInterval(buscar, 500)
    window.addEventListener('resize', medir)
    return () => { window.clearInterval(id); window.removeEventListener('resize', medir); obs.disconnect() }
  }, [activo, pantalla])
  return zona
}
/** Preguntas sugeridas según dónde está el visitante. */
function sugerencias(pantalla: string): Sugerencia[] {
  const agenda = (demo: 'movilidad' | 'matricula'): Sugerencia => ({
    // Proli V9: el reto se cuenta en la página de Proli (descubrimiento breve, ficha y agenda)
    texto: 'Tengo un reto en mi entidad', ordenes: [{ nombre: 'agendar_con_reto', entrada: { demo } }],
    sinConexion: '¡Qué bueno! Te llevo a la conversación de Proli para que me cuentes qué quieres lograr.',
  })
  if (pantalla.startsWith(NOMBRE_MOVILIDAD)) return [
    { texto: '¿Qué estoy viendo?', sinConexion: `Es ${NOMBRE_MOVILIDAD}: con datos abiertos de Bogotá, muestra cómo invertir el presupuesto de seguridad vial en las esquinas con más riesgo, usando más información que la de un solo año.` },
    { texto: '¿Por qué no basta un solo año?', ordenes: [{ nombre: 'movilidad_capitulo', entrada: { capitulo: 'solucion' } }],
      sinConexion: `Las esquinas más peligrosas no son simplemente las que tuvieron más accidentes el último año: ${NOMBRE_MOVILIDAD} analiza los registros históricos y compara lugares con comportamientos similares para estimar su riesgo.` },
    { texto: 'Muéstrame los resultados', ordenes: [{ nombre: 'movilidad_capitulo', entrada: { capitulo: 'resultados' } }],
      sinConexion: 'Aquí están: qué pasó en 2025 en los lugares de cada selección, en un análisis retrospectivo.' },
    agenda('movilidad'),
  ]
  if (pantalla.startsWith('Matrícula+')) return [
    { texto: '¿Qué estoy viendo?', sinConexion: 'Es Matrícula+: una simulación con datos abiertos que compara el reparto por orden de llegada (escenario de referencia) con otra forma de asignar los mismos cupos, por cercanía y prioridad.' },
    { texto: 'Muéstrame el cambio', ordenes: [{ nombre: 'matricula_reparto', entrada: { reparto: 'despues' } }],
      sinConexion: 'Aquí está: en verde, los estudiantes que estaban lejos y con Matrícula+ quedan cerca.' },
    { texto: '¿Dónde faltan cupos?', ordenes: [{ nombre: 'matricula_capitulo', entrada: { capitulo: 'resultados' } }],
      sinConexion: 'Repartir mejor no crea cupos: el mapa muestra dónde siguen estudiantes lejos.' },
    agenda('matricula'),
  ]
  return [
    { texto: '¿Qué es Proliferante?', sinConexion: 'Un estudio de innovación aplicada: conectamos datos, matemáticas, IA y tecnología para que las organizaciones decidan mejor, y dejamos esas capacidades funcionando. Hacemos simple lo complejo.' },
    { texto: `Muéstrame ${NOMBRE_MOVILIDAD}`, ordenes: [{ nombre: 'abrir_demo', entrada: { demo: 'movilidad' } }],
      sinConexion: `Vamos a ${NOMBRE_MOVILIDAD}: cómo invertir mejor un presupuesto limitado de seguridad vial.` },
    { texto: 'Muéstrame Matrícula+', ordenes: [{ nombre: 'abrir_demo', entrada: { demo: 'matricula' } }],
      sinConexion: 'Vamos a Matrícula+: cómo lograr que más niños tengan colegio cerca de casa.' },
  ]
}

/** El texto aparece letra por letra, como si Proli lo fuera diciendo. */
function useEscribiendo(texto: string) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (!texto) return
    const id = window.setInterval(() => setN((x) => (x >= texto.length ? x : x + 1)), MS_LETRA)
    return () => window.clearInterval(id)
  }, [texto])
  return texto.slice(0, n)
}

export default function Asistente() {
  const pantalla = usePantalla()
  const modo = leerModo()
  const reto = useReto()
  const conversacion = useConversacion()
  const { lineas, ocupado, sinConexion, cita, agregar, reiniciar: reiniciarConversacion } = conversacion
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const refLista = useRef<HTMLDivElement>(null)
  const zona = useZonaSobreMapa(modo !== 'auto', pantalla)
  const volando = useVolando()
  // Guía paso a paso: el paso vuelve a 0 al cambiar de capítulo; el globo se puede ocultar hasta entonces
  const lugar = `${pantalla.split(',')[0]}|${capituloDe(pantalla)}`
  const [paso, setPaso] = useState(0)
  const [menu, setMenu] = useState(false)
  const [dicho, setDicho] = useState('')          // lo que Proli está diciendo en su globo
  const [saludando, setSaludando] = useState(true)
  const [guiando, setGuiando] = useState(false)
  const [encima, setEncima] = useState(false)     // el puntero sobre Proli: abre los ojos de interés
  const visible = useEscribiendo(dicho)
  const hablando = visible.length < dicho.length
  // Al aparecer (y con cada visitante nuevo) Proli saluda con la mano
  useEffect(() => {
    if (!saludando) return
    const id = window.setTimeout(() => setSaludando(false), SEGUNDOS_SALUDO * 1000)
    return () => window.clearTimeout(id)
  }, [saludando])
  // Lo dicho se queda un rato después de terminar de aparecer (más si es largo) y se va solo
  useEffect(() => {
    if (!dicho || hablando) return
    const id = window.setTimeout(() => setDicho(''), 3500 + dicho.length * 30)
    return () => window.clearTimeout(id)
  }, [dicho, hablando])
  const lugarActual = useRef(lugar)
  lugarActual.current = lugar
  useEffect(() => { setPaso(0); setMenu(false) }, [lugar])
  const pasoGuia = guia(pantalla, paso)

  const reiniciar = useCallback(() => { reiniciarConversacion(); setTexto('') }, [reiniciarConversacion])
  // Volver a la portada es un visitante nuevo: conversación nueva y panel cerrado
  useEffect(() => { if (pantalla === 'portada del stand') { reiniciar(); fijarReto(''); setAbierto(false); setDicho(''); setSaludando(true); setGuiando(false); setMenu(false) } }, [pantalla, reiniciar])
  useEffect(() => { refLista.current?.scrollTo({ top: refLista.current.scrollHeight, behavior: 'smooth' }) }, [lineas, cita, ocupado])
  // Tiempo de lectura: cuando Proli termina de responder con el panel abierto, se da un margen
  // antes de que el tótem vuelva a la portada por inactividad. Si el visitante se fue, el tótem
  // vuelve igual, un poco más tarde.
  useEffect(() => {
    if (!abierto || ocupado || !lineas.length) return
    const id = window.setTimeout(avisarActividad, SEGUNDOS_LECTURA * 1000)
    return () => window.clearTimeout(id)
  }, [abierto, ocupado, lineas.length])

  /** Una opción de la guía: Proli lo dice, vuela a cada control, lo cambia y pasa a la pregunta siguiente. */
  const elegir = useCallback(async (op: Opcion) => {
    if (guiando || ocupado) return
    const desde = lugarActual.current
    setGuiando(true); setMenu(false); setSaludando(false); setDicho(op.respuesta); avisarActividad()
    if (abierto) { agregar({ quien: 'visitante', texto: op.texto }); agregar({ quien: 'proli', texto: op.respuesta }) }
    for (const o of op.ordenes) { await ejecutar(o); await dormir(PAUSA_ACCION_MS) }
    // Si la opción llevó a otro capítulo, la guía ya empezó de cero allí: no se avanza
    if (lugarActual.current === desde) setPaso((x) => x + 1)
    setGuiando(false); avisarActividad()
  }, [guiando, ocupado, abierto])

  /** Una pregunta frecuente: Proli responde con la boca (y, si la respuesta muestra algo, vuela a hacerlo). */
  const responder = useCallback(async (s: Sugerencia) => {
    if (guiando) return
    setGuiando(true); setMenu(false); setSaludando(false); setDicho(s.sinConexion); avisarActividad()
    for (const o of s.ordenes ?? []) { await ejecutar(o); await dormir(PAUSA_ACCION_MS) }
    setGuiando(false)
  }, [guiando])

  const preguntar = (pregunta: string, s?: Sugerencia) => { if (!ocupado && pregunta.trim()) setTexto(''); conversacion.preguntar(pregunta, s) }

  /** Abre la conversación y le pregunta a Proli (desde el menú). */
  const conversar = (pregunta: string, s?: Sugerencia) => { setMenu(false); setDicho(''); setSaludando(false); setAbierto(true); preguntar(pregunta, s) }

  // La conversación es la misma de la página de Proli: si Proli lleva al visitante de allí a un demo,
  // el panel se abre con la conversación en curso
  const enPaginaProli = pantalla.startsWith(PANTALLA_PROLI)
  const enDemo = pantalla.startsWith('Matrícula+') || pantalla.startsWith(NOMBRE_MOVILIDAD)
  const veniaDeProli = useRef(false)
  useEffect(() => {
    if (veniaDeProli.current && enDemo && lineas.length) { setAbierto(true); setDicho(''); setSaludando(false) }
    veniaDeProli.current = enPaginaProli
  }, [enPaginaProli, enDemo, lineas.length])

  // Ni en la portada del stand, ni en «Conoce a Proli», ni en su página: ahí Proli ya es el protagonista
  if (modo === 'auto' || pantalla === 'portada del stand' || pantalla === 'Conoce a Proli' || enPaginaProli) return null
  // Si Proli terminó proponiendo algo («¿Lo llevo a Resultados?»), se acepta con un toque
  const ultima = lineas[lineas.length - 1]
  const propuso = !ocupado && ultima?.quien === 'proli' && !sinConexion && esPropuesta(ultima.texto)
  const opciones: Sugerencia[] = [
    ...(propuso ? [{ texto: 'Sí, muéstramelo', sinConexion: 'Ahora no tengo conexión para hacerlo, pero puedes tocar la pantalla para llegar allí.' }] : []),
    ...sugerencias(pantalla),
  ]

  const enviar = (e: FormEvent) => { e.preventDefault(); preguntar(texto) }
  return (
    <>
      <CursorProli />
      <AnimatePresence>
        {!abierto && (
          <motion.div className={`proli-flotante ${zona ? 'proli-flotante--sobre-mapa' : ''}`}
                      style={{ ...(zona ? { bottom: zona.bottom + BOTON_SOBRE_MAPA_PX } : {}), opacity: volando ? 0 : 1 }}
                      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
            <AnimatePresence mode="wait">
              {menu ? (
                <motion.div key="menu" className="proli-flotante__globo proli-flotante__menu" role="menu"
                            initial={{ opacity: 0, y: 10, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}>
                  {pasoGuia && (
                    <>
                      <p>{pasoGuia.pregunta}</p>
                      <div className="proli-flotante__opciones">
                        {pasoGuia.opciones.map((op) => (
                          <button key={op.texto} type="button" role="menuitem" className="proli-panel__chip proli-panel__chip--si" disabled={guiando} onClick={() => elegir(op)}>{op.texto}</button>
                        ))}
                      </div>
                    </>
                  )}
                  <span className="proli-flotante__seccion">Pregúntame</span>
                  <ul className="proli-flotante__preguntas">
                    {sugerencias(pantalla).map((s) => (
                      <li key={s.texto}><button type="button" role="menuitem" disabled={guiando || ocupado} onClick={() => (s.conversar ? conversar(s.texto, s) : responder(s))}>{s.texto}</button></li>
                    ))}
                    <li><button type="button" role="menuitem" className="proli-flotante__escribir" onClick={() => { setMenu(false); setAbierto(true) }}>✎ Escribir otra pregunta</button></li>
                  </ul>
                </motion.div>
              ) : (dicho || saludando) ? (
                <motion.button key={dicho || 'saludo'} type="button" className="proli-flotante__globo proli-flotante__dicho" aria-live="polite"
                               onClick={() => { setDicho(''); setSaludando(false) }}
                               initial={{ opacity: 0, y: 10, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}>
                  {dicho ? <>{visible}{hablando && <i className="proli-flotante__cursor" />}</> : <>¡Hola! Soy <b>Proli</b>. Tócame y te muestro qué podemos hacer aquí.</>}
                </motion.button>
              ) : null}
            </AnimatePresence>
            <button type="button" className="proli-flotante__boton" onClick={() => { setMenu((m) => !m); setDicho(''); setSaludando(false) }}
                    onPointerEnter={() => setEncima(true)} onPointerLeave={() => setEncima(false)}
                    aria-label={menu ? 'Cerrar las opciones de Proli' : 'Ver qué puede hacer Proli'} aria-expanded={menu}>
              <span className="proli-flotante__figura">
                <ProliAnimado tamano={4.6} hablando={hablando} saludar={saludando} atento={(menu || encima) && !hablando} seguir />
                {pasoGuia && !menu && !dicho && <span className="proli-flotante__aviso" aria-hidden>?</span>}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {abierto && (
          <motion.section className={`proli-panel ${zona ? 'proli-panel--sobre-mapa' : ''}`} role="dialog" aria-label="Conversación con Proli"
                          style={zona ? { top: zona.top, bottom: zona.bottom } : undefined}
                          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <header className="proli-panel__cabeza">
              <ProliAnimado tamano={2.6} hablando={ocupado || hablando} className="proli-panel__avatar" />
              <div>
                <b>Proli</b>
                <small>{ocupado ? 'Escribiendo…' : sinConexion ? 'Sin conexión: respuestas guardadas' : 'Tu guía en el stand'}</small>
              </div>
              {lineas.length > 0 && <button type="button" className="proli-panel__nuevo" onClick={reiniciar}>Reiniciar</button>}
              <button type="button" className="proli-panel__cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar">×</button>
            </header>
            <div className="proli-panel__lista" ref={refLista} aria-live="polite">
              {lineas.length === 0 && (
                <p className="proli-panel__linea proli-panel__linea--proli">Hola, soy Proli, un sistema inteligente que trabaja para lograr resultados. Aquí mostramos lo que pasa cuando los datos se convierten en decisiones. ¿Quieres ver un ejemplo o tienes algún reto en mente?</p>
              )}
              {lineas.filter((l) => l.texto).map((l, i) => (
                <p key={i} className={`proli-panel__linea proli-panel__linea--${l.quien}`}>{l.quien === 'accion' ? `↳ ${l.texto}` : l.texto}</p>
              ))}
              {/* En el tótem, el código QR (se escanea con el celular); en celular y computador, el botón a WhatsApp */}
              {cita && !ocupado && (
                <div className="proli-panel__cita">
                  {esTotem(modo) || !URL_CITA ? <QrCita />
                    : <div className="qr-cita"><a className="boton boton--violeta" href={urlCitaCon(reto)} target="_blank" rel="noopener noreferrer">{BOTON_WHATSAPP(!!reto)} →</a><AvisoPrivacidad /></div>}
                </div>
              )}
              {ocupado && <span className="proli-panel__puntos" aria-hidden><i /><i /><i /></span>}
            </div>
            {pasoGuia && !cita && (
              <div className="proli-panel__guia">
                <span>{pasoGuia.pregunta}</span>
                <div className="proli-panel__sugerencias">
                  {pasoGuia.opciones.map((op) => (
                    <button key={op.texto} type="button" className="proli-panel__chip proli-panel__chip--si" disabled={guiando || ocupado} onClick={() => elegir(op)}>{op.texto}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="proli-panel__sugerencias">
              {opciones.map((s, i) => (
                <button key={s.texto} type="button" className={`proli-panel__chip ${propuso && i === 0 ? 'proli-panel__chip--si' : ''}`}
                        disabled={ocupado || guiando} onClick={() => preguntar(s.texto, s)}>{s.texto}</button>
              ))}
            </div>
            <form className="proli-panel__escribir" onSubmit={enviar}>
              <input value={texto} onChange={(e) => { setTexto(e.target.value); avisarActividad() }} maxLength={500} placeholder="Escribe tu pregunta…"
                     disabled={ocupado} aria-label="Tu pregunta para Proli" enterKeyHint="send" />
              <button type="submit" className="boton boton--violeta" disabled={ocupado || !texto.trim()}>Enviar</button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}
