/**
 * Proli, el asistente: botón flotante y panel de conversación, presentes en todas las pantallas
 * salvo la portada (pantalla de atracción) y el modo automático (no hay visitante).
 *
 * Conversación: el navegador guarda el historial y lo manda a /api/proli (api/proli.ts), que llama a
 * Claude. Cuando Proli pide acciones (tool_use), se ejecutan aquí con src/proli/ordenes.ts y se le
 * devuelve el resultado; así hasta que Proli responde sin acciones (máximo MAX_PASOS por pregunta).
 *
 * El historial es de solo agregar: se reenvía tal como lo devolvió la API (con sus bloques de
 * razonamiento), nunca se edita. Si una respuesta termina en negativa o cortada, la conversación
 * siguiente empieza de cero.
 *
 * Sin conexión (o sin clave en el servidor), las preguntas sugeridas siguen funcionando con
 * respuestas preparadas y acciones locales. Esas respuestas no llevan cifras: toda cifra sale de
 * los datos, y aquí no se escribe ninguna a mano.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type Anthropic from '@anthropic-ai/sdk'
import imagenProli from '../assets/proli.webp'
import { leerModo } from '../modo'
import { ejecutar, leerPantalla, usePantalla, type Orden } from './ordenes'

type Mensaje = Anthropic.Beta.Messages.BetaMessageParam
type Bloque = Anthropic.Beta.Messages.BetaContentBlock

const MAX_PASOS = 4            // vueltas de acciones por pregunta
const MAX_PREGUNTAS = 12       // por conversación (en el stand, cada visitante tiene la suya)
const PAUSA_ACCION_MS = 350    // entre acciones, para que la pantalla alcance a cambiar
const SEGUNDOS_LECTURA = 20    // margen extra para leer la respuesta antes de la inactividad del tótem
const ALTO_MINIMO_PX = 340     // si el mapa es más bajo, el panel cubre también la cabecera
const MARGEN_PX = 8
const BOTON_SOBRE_MAPA_PX = 36 // el botón cerrado, en el borde inferior del mapa (sobre la atribución)

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
      setZona({ top, bottom: Math.max(MARGEN_PX, window.innerHeight - r.bottom + MARGEN_PX) })
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
const URL = './api/proli'

interface Linea { quien: 'visitante' | 'proli' | 'accion' | 'aviso'; texto: string }
interface Sugerencia { texto: string; ordenes?: Orden[]; sinConexion: string }

/** Preguntas sugeridas según dónde está el visitante. */
function sugerencias(pantalla: string): Sugerencia[] {
  const agenda = (demo: 'movilidad' | 'matricula'): Sugerencia => ({
    texto: 'Quiero verlo con mis datos', ordenes: [{ nombre: 'abrir_agenda', entrada: { demo } }],
    sinConexion: 'Con gusto. Proliferante lo arma con los datos y las reglas de su entidad. Escanee el código QR para agendar una conversación con el equipo.',
  })
  if (pantalla.startsWith('Movilidad+')) return [
    { texto: '¿Qué estoy viendo?', sinConexion: 'Es Movilidad+: con datos abiertos de Bogotá, se busca dónde se evitan más siniestros graves con un presupuesto, y cuánto se puede prometer sin exagerar.' },
    { texto: '¿Por qué bajaron las peores esquinas?', ordenes: [{ nombre: 'movilidad_capitulo', entrada: { capitulo: 'giro' } }],
      sinConexion: 'Un año malo suele venir seguido de uno más tranquilo, con obra o sin ella. Por eso, para saber si una obra funcionó, hay que compararla con lo que se esperaba que pasara sin ella.' },
    { texto: 'Muéstreme el presupuesto', ordenes: [{ nombre: 'movilidad_presupuesto', entrada: { nivel: 'bajo' } }],
      sinConexion: 'Aquí está. Con estos supuestos, se esperaría evitar los siniestros que ve en pantalla; la práctica intuitiva prometería más.' },
    agenda('movilidad'),
  ]
  if (pantalla.startsWith('Matrícula+')) return [
    { texto: '¿Qué estoy viendo?', sinConexion: 'Es Matrícula+: un simulador para comparar reglas de asignación de cupos escolares en Bogotá, con datos abiertos y familias sintéticas.' },
    { texto: 'Priorice a las familias vulnerables', ordenes: [{ nombre: 'matricula_reglas', entrada: { reglas: 'equidad' } }, { nombre: 'matricula_asignar', entrada: {} }],
      sinConexion: 'Listo: reglas de Equidad. Mire en el mapa quién cabe ahora; reordenar no crea cupos, pero cambia quién queda.' },
    { texto: 'Ponga un colegio nuevo en Tibabuyes', ordenes: [{ nombre: 'matricula_colegio_nuevo', entrada: { ubicacion: 'tibabuyes' } }, { nombre: 'matricula_asignar', entrada: {} }],
      sinConexion: 'Listo: un colegio nuevo en Tibabuyes, en un proyecto real de la Secretaría de Educación. Mire cómo cambia la asignación.' },
    agenda('matricula'),
  ]
  return [
    { texto: '¿Qué es Proliferante?', sinConexion: 'Un estudio de innovación aplicada: conectamos datos, matemáticas, IA y tecnología para que las organizaciones decidan mejor, y dejamos esas capacidades funcionando. Hacemos simple lo complejo.' },
    { texto: 'Muéstreme Movilidad+', ordenes: [{ nombre: 'abrir_demo', entrada: { demo: 'movilidad' } }],
      sinConexion: 'Vamos a Movilidad+: con este presupuesto, ¿dónde se evitan más siniestros graves?' },
    { texto: 'Muéstreme Matrícula+', ordenes: [{ nombre: 'abrir_demo', entrada: { demo: 'matricula' } }],
      sinConexion: 'Vamos a Matrícula+: ¿dónde cabe cada niño?' },
  ]
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Mantiene vivo el tótem mientras Proli habla o el visitante escribe (los temporizadores de inactividad escuchan pointerdown). */
const avisarActividad = () => window.dispatchEvent(new Event('pointerdown'))

class SinConexion extends Error {}

/** Una llamada a /api/proli: transmite el texto mientras llega y devuelve el mensaje completo. */
async function llamar(mensajes: Mensaje[], alTexto: (d: string) => void, senal: AbortSignal): Promise<{ contenido: Bloque[]; stop: string }> {
  let r: Response
  try {
    r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensajes }), signal: senal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new SinConexion('red')
  }
  if (!r.ok || !r.body) throw new SinConexion(String(r.status))
  const lector = r.body.pipeThrough(new TextDecoderStream()).getReader()
  let resto = ''
  let fin: { contenido: Bloque[]; stop: string } | null = null
  for (;;) {
    const { value, done } = await lector.read()
    if (done) break
    resto += value
    let i
    while ((i = resto.indexOf('\n')) >= 0) {
      const linea = resto.slice(0, i).trim()
      resto = resto.slice(i + 1)
      if (!linea) continue
      const ev = JSON.parse(linea) as { t: string; d?: string; contenido?: Bloque[]; stop?: string }
      if (ev.t === 'texto' && ev.d) alTexto(ev.d)
      else if (ev.t === 'fin') fin = { contenido: ev.contenido ?? [], stop: ev.stop ?? 'end_turn' }
      else if (ev.t === 'error') throw new SinConexion(ev.d ?? 'fallo')
    }
  }
  if (!fin) throw new SinConexion('incompleto')
  return fin
}

export default function Asistente() {
  const pantalla = usePantalla()
  const modo = leerModo()
  const [abierto, setAbierto] = useState(false)
  const [lineas, setLineas] = useState<Linea[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [texto, setTexto] = useState('')
  const [sinConexion, setSinConexion] = useState(false)
  const historial = useRef<Mensaje[]>([])
  const contextoEnviado = useRef('')
  const preguntas = useRef(0)
  const cancelar = useRef<AbortController | null>(null)
  const refLista = useRef<HTMLDivElement>(null)
  const zona = useZonaSobreMapa(modo !== 'auto', pantalla)

  const reiniciar = useCallback(() => {
    cancelar.current?.abort()
    historial.current = []; contextoEnviado.current = ''; preguntas.current = 0
    setLineas([]); setOcupado(false); setTexto('')
  }, [])
  // Volver a la portada es un visitante nuevo: conversación nueva y panel cerrado
  useEffect(() => { if (pantalla === 'portada del stand') { reiniciar(); setAbierto(false) } }, [pantalla, reiniciar])
  useEffect(() => { refLista.current?.scrollTo({ top: refLista.current.scrollHeight, behavior: 'smooth' }) }, [lineas])
  // Tiempo de lectura: cuando Proli termina de responder con el panel abierto, se da un margen
  // antes de que el tótem vuelva a la portada por inactividad. Si el visitante se fue, el tótem
  // vuelve igual, un poco más tarde.
  useEffect(() => {
    if (!abierto || ocupado || !lineas.length) return
    const id = window.setTimeout(avisarActividad, SEGUNDOS_LECTURA * 1000)
    return () => window.clearTimeout(id)
  }, [abierto, ocupado, lineas.length])

  const agregar = (l: Linea) => setLineas((x) => [...x, l])
  /** Agrega texto a la última línea de Proli (la que se está escribiendo). */
  const escribir = (d: string) => setLineas((x) => {
    const u = x[x.length - 1]
    return u?.quien === 'proli' ? [...x.slice(0, -1), { ...u, texto: u.texto + d }] : [...x, { quien: 'proli', texto: d }]
  })

  const responderSinConexion = useCallback(async (s?: Sugerencia) => {
    setSinConexion(true)
    if (s) {
      for (const o of s.ordenes ?? []) { await ejecutar(o); await dormir(PAUSA_ACCION_MS) }
      agregar({ quien: 'proli', texto: s.sinConexion })
    } else {
      agregar({ quien: 'proli', texto: 'Ahora no tengo conexión para conversar, pero puedo llevarlo a donde quiera con estas opciones.' })
    }
  }, [])

  const preguntar = useCallback(async (pregunta: string, s?: Sugerencia) => {
    if (ocupado || !pregunta.trim()) return
    agregar({ quien: 'visitante', texto: pregunta })
    setTexto('')
    if (preguntas.current >= MAX_PREGUNTAS) {
      agregar({ quien: 'aviso', texto: 'Esta conversación ya va larga. Toque «Reiniciar» para seguir.' })
      return
    }
    preguntas.current++
    setOcupado(true)
    const control = new AbortController()
    cancelar.current = control
    // Contexto de pantalla: va como mensaje de sistema solo cuando cambió (el historial no se edita)
    const conContexto = () => {
      const c = `Pantalla actual: ${leerPantalla()}`
      if (c !== contextoEnviado.current) { historial.current.push({ role: 'system', content: c }); contextoEnviado.current = c }
    }
    try {
      historial.current.push({ role: 'user', content: pregunta.slice(0, 500) })
      conContexto()
      for (let paso = 0; paso < MAX_PASOS; paso++) {
        const { contenido, stop } = await llamar(historial.current, (d) => { escribir(d); avisarActividad() }, control.signal)
        historial.current.push({ role: 'assistant', content: contenido as unknown as Anthropic.Beta.Messages.BetaContentBlockParam[] })
        setSinConexion(false)
        if (stop === 'refusal' || stop === 'max_tokens') {
          // No se ejecutan acciones a medias; la próxima pregunta empieza una conversación nueva
          if (stop === 'refusal') agregar({ quien: 'proli', texto: 'De eso prefiero no hablar. ¿Le muestro algo de los demos?' })
          historial.current = []; contextoEnviado.current = ''
          break
        }
        const acciones = contenido.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use')
        if (!acciones.length) break
        const resultados: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = []
        for (const a of acciones) {
          const resultado = await ejecutar({ nombre: a.name, entrada: (a.input ?? {}) as Record<string, unknown> })
          resultados.push({ type: 'tool_result', tool_use_id: a.id, content: resultado })
          // El visitante ve qué hizo Proli en la pantalla (y por qué cambió). Las consultas de cifras
          // traen «resumen | detalle»: en el panel va solo el resumen; Proli recibe todo
          agregar({ quien: 'accion', texto: resultado.split(' | ')[0].replace(/^Listo: /, '').replace(/ Listo: /, ' ') })
          await dormir(PAUSA_ACCION_MS)
        }
        historial.current.push({ role: 'user', content: resultados })
        conContexto()
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        // Se descarta el turno a medias para que el historial siga siendo válido
        historial.current = []; contextoEnviado.current = ''
        await responderSinConexion(s)
      }
    } finally {
      setOcupado(false)
      avisarActividad()
    }
  }, [ocupado, responderSinConexion])

  if (modo === 'auto' || pantalla === 'portada del stand') return null
  // Si Proli terminó proponiendo algo («¿Lo llevo a Resultados?»), se acepta con un toque
  const ultima = lineas[lineas.length - 1]
  const propuso = !ocupado && ultima?.quien === 'proli' && !sinConexion && ultima.texto.trim().endsWith('?')
  const opciones: Sugerencia[] = [
    ...(propuso ? [{ texto: 'Sí, muéstremelo', sinConexion: 'Ahora no tengo conexión para hacerlo, pero puede tocar la pantalla para llegar allí.' }] : []),
    ...sugerencias(pantalla),
  ]

  const enviar = (e: FormEvent) => { e.preventDefault(); preguntar(texto) }
  return (
    <>
      <AnimatePresence>
        {!abierto && (
          <motion.button type="button" className={`proli-boton ${zona ? 'proli-boton--sobre-mapa' : ''}`} onClick={() => setAbierto(true)} aria-label="Hablar con Proli"
                         style={zona ? { bottom: zona.bottom + BOTON_SOBRE_MAPA_PX } : undefined}
                         initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
            <img src={imagenProli} alt="" draggable={false} />
            <span className="proli-boton__texto">Pregúntele a Proli</span>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {abierto && (
          <motion.section className={`proli-panel ${zona ? 'proli-panel--sobre-mapa' : ''}`} role="dialog" aria-label="Conversación con Proli"
                          style={zona ? { top: zona.top, bottom: zona.bottom } : undefined}
                          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <header className="proli-panel__cabeza">
              <img src={imagenProli} alt="" className="proli-panel__avatar" draggable={false} />
              <div>
                <b>Proli</b>
                <small>{ocupado ? 'Escribiendo…' : sinConexion ? 'Sin conexión: respuestas guardadas' : 'Su guía en el stand'}</small>
              </div>
              {lineas.length > 0 && <button type="button" className="proli-panel__nuevo" onClick={reiniciar}>Reiniciar</button>}
              <button type="button" className="proli-panel__cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar">×</button>
            </header>
            <div className="proli-panel__lista" ref={refLista} aria-live="polite">
              {lineas.length === 0 && (
                <p className="proli-panel__linea proli-panel__linea--proli">¿En qué le ayudo? Puedo explicarle lo que ve, mostrarle algo en la pantalla o llevarlo a un demo.</p>
              )}
              {lineas.filter((l) => l.texto).map((l, i) => (
                <p key={i} className={`proli-panel__linea proli-panel__linea--${l.quien}`}>{l.quien === 'accion' ? `↳ ${l.texto}` : l.texto}</p>
              ))}
              {ocupado && <span className="proli-panel__puntos" aria-hidden><i /><i /><i /></span>}
            </div>
            <div className="proli-panel__sugerencias">
              {opciones.map((s, i) => (
                <button key={s.texto} type="button" className={`proli-panel__chip ${propuso && i === 0 ? 'proli-panel__chip--si' : ''}`}
                        disabled={ocupado} onClick={() => preguntar(s.texto, s)}>{s.texto}</button>
              ))}
            </div>
            <form className="proli-panel__escribir" onSubmit={enviar}>
              <input value={texto} onChange={(e) => { setTexto(e.target.value); avisarActividad() }} maxLength={500} placeholder="Escriba su pregunta…"
                     disabled={ocupado} aria-label="Su pregunta para Proli" enterKeyHint="send" />
              <button type="submit" className="boton boton--violeta" disabled={ocupado || !texto.trim()}>Enviar</button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}
