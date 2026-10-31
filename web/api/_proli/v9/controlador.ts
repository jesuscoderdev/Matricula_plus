/**
 * Controlador de la conversación de Proli V9 (especificación, sección 3): el modelo analiza y propone,
 * pero los límites los aplica este código. Máximo 3 preguntas de descubrimiento (contando la de la
 * apertura), una sola pregunta y 280 caracteres por mensaje, al segundo desvío se cierra, «¿qué es un
 * Proli?» tiene respuesta literal, «quiero agendar» abre la agenda en cualquier momento y tras la ficha
 * no se reabre el chat.
 *
 * No conoce la API ni la base de datos: recibe la función que consulta al modelo, así las pruebas
 * pueden simularlo (pruebas/proli-v9.test.ts).
 */
import { LITERAL } from './prompt.js'
import type { Ficha, Sesion } from './sesion.js'

export const MAX_PREGUNTAS = 3
export const MAX_RESPUESTAS = 8
export const MAX_CARACTERES = 280
export const MAX_TEXTO_VISITANTE = 500

export type Clasificacion = 'RELEVANTE' | 'VAGO' | 'FUERA_DE_TEMA' | 'PREGUNTA_PROLI' | 'AGENDA_DIRECTA' | 'SALIR' | 'ABUSO_O_INYECCION'
export type Siguiente = 'preguntar_rol' | 'preguntar_meta' | 'preguntar_dificultad' | 'hipotesis' | 'redirigir' | 'responder' | 'cerrar'

export interface Analisis {
  clasificacion: Clasificacion
  organizacion: string
  rol: string
  objetivo: string
  situacion: string
  siguiente: Siguiente
  mensaje: string
  hipotesis: string
  por_conocer: string
}

/** Lo que ve el navegador después de cada turno */
export type Accion = 'chat' | 'ficha' | 'agenda' | 'cerrado' | 'terminado'
export interface Turno { mensaje: string; accion: Accion; ficha: Ficha | null; clasificacion: Clasificacion | null }

export type Consultar = (nota: string) => Promise<Analisis>

const preguntasEn = (t: string) => (t.match(/\?/g) ?? []).length
const limpio = (t: unknown, max = 600) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, max) : '')
// Sesgo de automatización (secciones 1.2 y 8): no vender estas soluciones si el visitante no las nombró
const SESGO = /(automatiz|chatbot|dashboard|tablero|inteligencia artificial|(?<!\p{L})IA(?!\p{L})|aplicaci[oó]n m[oó]vil)/iu

/** La pregunta que falta, en literal (para retomar tras una pregunta sobre Proli o una redirección) */
function preguntaPendiente(s: Sesion): string {
  if (s.preguntas >= MAX_PREGUNTAS && s.datos.objetivo) return ''
  if (!s.datos.organizacion && !s.datos.objetivo) return LITERAL.organizacion
  if (!s.datos.objetivo) return LITERAL.meta
  return ''
}

function fichaDe(s: Sesion, a: Analisis): Ficha {
  return {
    organizacion: s.datos.organizacion,
    rol: s.datos.rol,
    objetivo: s.datos.objetivo,
    situacion: s.datos.situacion || 'Por conocer',
    hipotesis: limpio(a.hipotesis, 400),
    por_conocer: limpio(a.por_conocer, 400),
  }
}

/** Mensaje de cierre con hipótesis: debe terminar invitando a los 20 minutos */
function conInvitacion(m: string): string {
  const t = m.trim()
  if (/20 minutos/.test(t) && t.endsWith('?')) return t
  return `${t.replace(/[¿?]/g, '').replace(/\s*$/, '')} ${LITERAL.invitacion}`.trim()
}

/**
 * Un turno del visitante. Devuelve la respuesta y modifica la sesión (contadores, estado, historial).
 */
export async function turno(s: Sesion, texto: string, consultar: Consultar): Promise<Turno> {
  const dice = limpio(texto, MAX_TEXTO_VISITANTE)
  const responder = (mensaje: string, accion: Accion, clasificacion: Clasificacion | null, ficha: Ficha | null = null): Turno => {
    s.h.push({ r: 'p', t: mensaje })
    s.respuestas++
    s.ultima = Date.now()
    if (ficha) s.ficha = ficha
    if (accion === 'cerrado' || accion === 'terminado') s.estado = 'TERMINADO'
    if (accion === 'ficha') s.estado = 'HIPOTESIS_Y_FICHA'
    if (accion === 'agenda') s.estado = 'AGENDA'
    return { mensaje, accion, ficha, clasificacion }
  }

  // Tras la ficha o el cierre no se reabre el chat de diagnóstico (sección 3, última fila)
  if (s.estado !== 'CONEXION' && s.estado !== 'OBJETIVO') {
    return { mensaje: '', accion: s.estado === 'AGENDA' ? 'agenda' : s.ficha ? 'ficha' : 'terminado', ficha: s.ficha, clasificacion: null }
  }
  s.h.push({ r: 'v', t: dice })
  if (s.respuestas >= MAX_RESPUESTAS) return responder(LITERAL.limite, 'cerrado', null)

  const quedan = Math.max(0, MAX_PREGUNTAS - s.preguntas)
  const nota = (extra = '') => [
    `preguntas_hechas=${s.preguntas} de ${MAX_PREGUNTAS}; quedan ${quedan}.`,
    `desvios=${s.desvios}.`,
    `Ya declarado → organización: «${s.datos.organizacion}», rol: «${s.datos.rol}», objetivo: «${s.datos.objetivo}», dificultad: «${s.datos.situacion}».`,
    quedan === 0 ? 'No quedan preguntas: siguiente debe ser hipotesis si hay objetivo, o cerrar.' : '',
    extra,
  ].filter(Boolean).join(' ')

  const a = await consultar(nota())
  // Lo declarado se acumula (el modelo no puede borrar lo que ya se sabía)
  for (const k of ['organizacion', 'rol', 'objetivo', 'situacion'] as const) {
    const v = limpio(a[k], 300)
    if (v) s.datos[k] = v
  }

  switch (a.clasificacion) {
    case 'AGENDA_DIRECTA':
      return responder(LITERAL.agenda, 'agenda', a.clasificacion)
    case 'SALIR':
      return responder(LITERAL.salir, 'terminado', a.clasificacion)
    case 'PREGUNTA_PROLI': {
      // Literal y no cuenta como desvío; se retoma el recorrido si falta algo
      const pendiente = preguntaPendiente(s)
      return responder(pendiente ? `${LITERAL.queEsProli} ${pendiente}` : `${LITERAL.queEsProli}`, 'chat', a.clasificacion)
    }
    case 'FUERA_DE_TEMA':
    case 'ABUSO_O_INYECCION': {
      s.desvios++
      if (s.desvios >= 2) return responder(LITERAL.segundoDesvio, 'cerrado', a.clasificacion)
      const pendiente = preguntaPendiente(s)
      const m = limpio(a.mensaje, 1000)
      const valido = a.clasificacion === 'FUERA_DE_TEMA' && m && m.length <= MAX_CARACTERES && preguntasEn(m) <= 1 && !SESGO.test(m)
      return responder(valido ? m : `${LITERAL.redirigir}${pendiente ? ` ${pendiente}` : ''}`, 'chat', a.clasificacion)
    }
    default:
      break
  }

  // RELEVANTE o VAGO
  const visitante = s.h.filter((x) => x.r === 'v').map((x) => x.t).join(' ')
  const pideHipotesis = async (motivo: string) => {
    if (!s.datos.objetivo) return null
    let b = a
    for (let intento = 0; intento < 2; intento++) {
      const ok = b.siguiente === 'hipotesis' && limpio(b.mensaje, 2000) && limpio(b.hipotesis)
        && (!SESGO.test(`${b.mensaje} ${b.hipotesis}`) || SESGO.test(visitante))
      if (ok) return b
      b = await consultar(nota(`${motivo} OBLIGATORIO: siguiente=hipotesis, sin más preguntas de descubrimiento.${SESGO.test(`${b.mensaje} ${b.hipotesis}`) ? ' No propongas automatización, chatbots, tableros ni IA como respuesta: el visitante no los mencionó.' : ''}`))
      for (const k of ['organizacion', 'rol', 'objetivo', 'situacion'] as const) { const v = limpio(b[k], 300); if (v && !s.datos[k]) s.datos[k] = v }
    }
    return null
  }
  const cierreConFicha = (b: Analisis) => {
    const ficha = fichaDe(s, b)
    return responder(conInvitacion(limpio(b.mensaje, 2000)), 'ficha', a.clasificacion, ficha)
  }
  const cierreSinHipotesis = () => {
    // Sin hipótesis válida: se cierra con lo confirmado, sin inventar nada
    const ficha: Ficha = { ...fichaDe(s, { ...a, hipotesis: '', por_conocer: '' }), hipotesis: 'Por definir en la conversación con el equipo', por_conocer: '' }
    return responder(`Gracias por contarme: tu meta es ${s.datos.objetivo.replace(/[.\s]+$/, '')}. ${LITERAL.capacidad} ${LITERAL.invitacion}`, 'ficha', a.clasificacion, ficha)
  }

  if (a.clasificacion === 'VAGO') {
    if (!s.datos.objetivo) return responder(LITERAL.sinObjetivo, 'cerrado', a.clasificacion)
    const b = await pideHipotesis('El visitante no quiere precisar más.')
    return b ? cierreConFicha(b) : cierreSinHipotesis()
  }

  const esPregunta = a.siguiente === 'preguntar_rol' || a.siguiente === 'preguntar_meta' || a.siguiente === 'preguntar_dificultad'
  const permitida = esPregunta && quedan > 0 && (
    (a.siguiente === 'preguntar_rol' && !s.datos.rol && !s.datos.objetivo)
    || (a.siguiente === 'preguntar_meta' && !s.datos.objetivo)
    || (a.siguiente === 'preguntar_dificultad' && !!s.datos.objetivo && !s.datos.situacion))
  if (permitida) {
    const m = limpio(a.mensaje, 1000)
    const valido = m && m.length <= MAX_CARACTERES && preguntasEn(m) === 1 && m.endsWith('?') && !SESGO.test(m)
    const literal = a.siguiente === 'preguntar_rol' ? LITERAL.rol : a.siguiente === 'preguntar_meta' ? LITERAL.meta : ''
    if (valido || literal) {
      s.preguntas++
      s.estado = 'OBJETIVO'
      return responder(valido ? m : literal, 'chat', a.clasificacion)
    }
  }
  // Ya hay objetivo (o no quedan preguntas): cierre con hipótesis
  if (s.datos.objetivo) {
    const b = await pideHipotesis(esPregunta ? 'Ya hay objetivo suficiente o se agotaron las preguntas.' : '')
    return b ? cierreConFicha(b) : cierreSinHipotesis()
  }
  // Sin objetivo y sin preguntas posibles: la meta en literal si queda una, si no, cierre exploratorio
  if (quedan > 0) {
    s.preguntas++
    s.estado = 'OBJETIVO'
    return responder(LITERAL.meta, 'chat', a.clasificacion)
  }
  return responder(LITERAL.sinObjetivo, 'cerrado', a.clasificacion)
}
