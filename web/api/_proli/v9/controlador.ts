/**
 * Controlador de la conversación de Proli (especificación V12, secciones 2.2.1, 2.2.2 y 3). El modelo solo
 * CLASIFICA y EXTRAE; las transiciones, las preguntas y los cierres los decide este código, según la etapa
 * de la sesión (el campo esperado), como el pseudocódigo contractual de la sección 2.2.1:
 *
 *  · ESPERA_ORGANIZACION → ESPERA_ROL → ESPERA_OBJETIVO → HIPOTESIS_Y_FICHA. Cualquier nombre declarado es
 *    una organización válida («Proliferante», «ABC123», una entidad desconocida): se guarda y se pregunta
 *    el rol. Nunca dispara cierre, agenda ni demos.
 *  · «No sé» se interpreta según la etapa: omitir organización → rol; omitir rol → meta; solo sin meta hay
 *    salida exploratoria (C42).
 *  · Texto aleatorio probable o ambiguo: no se guarda ni avanza; una aclaración (en organización, pedir
 *    confirmación del nombre). Dos entradas ajenas o aleatorias seguidas → cierre sin lead falso (C56).
 *  · Las intenciones explícitas (agendar, salir, «¿qué es un Proli?») solo valen si el texto las expresa
 *    de verdad: el modelo no puede convertir un nombre en una intención (C25, C30).
 *  · Máximo 3 preguntas de descubrimiento, 8 respuestas por sesión; tras la ficha no se reabre el chat.
 *
 * No conoce la API ni la base de datos: recibe las funciones que consultan al modelo (pruebas/proli-v9.test.ts).
 */
import { LITERAL } from './literales.js'
import type { Estado, Ficha, Sesion } from './sesion.js'

export const MAX_PREGUNTAS = 3
export const MAX_RESPUESTAS = 8
export const MAX_TEXTO_VISITANTE = 500

export type Intencion = 'NINGUNA' | 'AGENDA_DIRECTA' | 'SALIR' | 'PREGUNTA_PROLI' | 'ABUSO_O_INYECCION'
export type Calidad = 'DATO_VALIDO' | 'OMISION_EXPLICITA' | 'FUERA_DE_TEMA' | 'TEXTO_ALEATORIO_PROBABLE' | 'AMBIGUO'

/** Lo que el modelo devuelve al clasificar un mensaje (solo lo declarado en ESE mensaje) */
export interface Analisis {
  intencion: Intencion
  calidad: Calidad
  organizacion: string
  rol: string
  objetivo: string
  situacion: string
}
/** Lo que el modelo devuelve al cerrar con hipótesis */
export interface Cierre { mensaje: string; hipotesis: string; por_conocer: string; meta_corta: string }

export type Accion = 'chat' | 'ficha' | 'agenda' | 'cerrado' | 'terminado'
export interface Turno { mensaje: string; accion: Accion; ficha: Ficha | null; motivo: string }

export interface Modelo {
  analizar: (nota: string) => Promise<Analisis>
  cerrar: (nota: string) => Promise<Cierre>
}

const limpio = (t: unknown, max = 600) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, max) : '')

// --- Intenciones explícitas: el texto debe decirlas (el modelo no basta) ---
const PIDE_AGENDA = /(agend|cita\b|citas\b|reuni[oó]n|reunirnos|una llamada|hablar con (alguien|un asesor|una persona|el equipo|ustedes))/i
const QUIERE_SALIR = /(me cans[eé]|no quiero (seguir|continuar|hablar)|ya no quiero|ad[ií]os|chao|hasta luego|terminemos|dejemos (as[ií]|hasta aqu[ií])|quiero salir|no gracias)/i
const PREGUNTA_PROLI = /(\?|^\s*(qu[eé]|ke|q|que)\b).*\bprol|\bprol\w*\b.*\?|^\s*(qu[eé]|ke|q)\s+(es|son)\s+(un\s+|el\s+|los\s+)?prol/i
const CONFIRMA = /^\s*(s[ií]|sip|claro|correcto|exacto|as[ií] es|confirmo|efectivamente|tal cual)\b|as[ií] se llama|es (el nombre de )?(mi|nuestra) (organizaci[oó]n|empresa|entidad)/i
// Sesgo de automatización (V9 1.2): la hipótesis no vende estas soluciones si el visitante no las nombró
const SESGO = /(automatiz|chatbot|dashboard|tablero|inteligencia artificial|(?<!\p{L})IA(?!\p{L})|aplicaci[oó]n m[oó]vil)/iu

/**
 * Complemento al modelo para tecleo aleatorio (V12: sospecha, no prueba): una sola «palabra» larga casi
 * sin vocales, una fila del teclado o un carácter repetido. Nombres raros y siglas cortas pasan.
 */
export function pareceAleatorio(t: string): boolean {
  const s = t.trim().toLowerCase()
  if (!s || /\s/.test(s) || s.length < 7) return false
  const letras = s.replace(/[^a-zñáéíóúü]/g, '')
  if (letras.length < 7) return false
  const vocales = (letras.match(/[aeiouáéíóúü]/g) ?? []).length
  if (vocales / letras.length < 0.2) return true
  if (/(.)\1{3,}/.test(letras)) return true
  for (const fila of ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm']) {
    for (let i = 0; i + 6 <= fila.length; i++) if (letras.includes(fila.slice(i, i + 6))) return true
  }
  return false
}

/** La siguiente etapa: lo redundante se omite (C02, C29) y nunca se inventa un campo */
function siguienteEtapa(s: Sesion, etapa: Estado): Estado {
  if (s.datos.objetivo) return 'HIPOTESIS_Y_FICHA'
  if (etapa === 'ESPERA_ORGANIZACION' && !s.datos.rol) return 'ESPERA_ROL'
  return 'ESPERA_OBJETIVO'
}

export async function turno(s: Sesion, texto: string, modelo: Modelo): Promise<Turno> {
  const dice = limpio(texto, MAX_TEXTO_VISITANTE)
  const responder = (mensaje: string, accion: Accion, motivo: string, ficha: Ficha | null = null): Turno => {
    s.h.push({ r: 'p', t: mensaje })
    s.respuestas++
    s.ultima = Date.now()
    if (ficha) s.ficha = ficha
    if (accion === 'cerrado' || accion === 'terminado') s.estado = 'TERMINADO'
    if (accion === 'ficha') s.estado = 'HIPOTESIS_Y_FICHA'
    if (accion === 'agenda') s.estado = 'AGENDA'
    return { mensaje, accion, ficha, motivo }
  }
  const preguntar = (etapa: Estado, mensaje: string, motivo: string) => {
    s.estado = etapa
    s.preguntas++
    return responder(mensaje, 'chat', motivo)
  }

  // Tras la ficha o el cierre no se reabre el chat de diagnóstico
  if (s.estado === 'HIPOTESIS_Y_FICHA' || s.estado === 'AGENDA' || s.estado === 'TERMINADO') {
    return { mensaje: '', accion: s.estado === 'AGENDA' ? 'agenda' : s.ficha ? 'ficha' : 'terminado', ficha: s.ficha, motivo: 'chat_cerrado' }
  }
  s.h.push({ r: 'v', t: dice })
  if (s.respuestas >= MAX_RESPUESTAS) return responder(LITERAL.limite, 'cerrado', 'limite_respuestas')

  const etapa = s.estado
  const nota = [
    `ETAPA=${etapa} (pregunta activa: ${etapa === 'ESPERA_ORGANIZACION' ? 'organización' : etapa === 'ESPERA_ROL' ? 'rol' : 'meta'}).`,
    s.candidato ? `Se le pidió confirmar si «${s.candidato}» es el nombre de su organización.` : '',
    `Ya declarado → organización: «${s.datos.organizacion}», rol: «${s.datos.rol}», objetivo: «${s.datos.objetivo}».`,
  ].filter(Boolean).join(' ')
  const a = await modelo.analizar(nota)

  // 1) Intenciones explícitas, solo si el texto las expresa
  const intencion: Intencion =
    a.intencion === 'AGENDA_DIRECTA' && PIDE_AGENDA.test(dice) ? 'AGENDA_DIRECTA'
    : a.intencion === 'SALIR' && QUIERE_SALIR.test(dice) ? 'SALIR'
    : a.intencion === 'PREGUNTA_PROLI' && PREGUNTA_PROLI.test(dice) ? 'PREGUNTA_PROLI'
    : a.intencion === 'ABUSO_O_INYECCION' ? 'ABUSO_O_INYECCION'
    : 'NINGUNA'
  if (intencion === 'AGENDA_DIRECTA') { s.candidato = null; return responder(LITERAL.agenda, 'agenda', 'agenda_directa') }
  if (intencion === 'SALIR') return responder(LITERAL.salir, 'terminado', 'salir')
  if (intencion === 'PREGUNTA_PROLI') {
    // Pertinente: no es desvío ni cuenta como pregunta; se retoma la pregunta activa
    const activa = etapa === 'ESPERA_ORGANIZACION' ? LITERAL.organizacion : etapa === 'ESPERA_ROL' ? '¿Y qué haces allí?' : LITERAL.meta
    return responder(`${LITERAL.queEsProli} ${activa}`, 'chat', 'pregunta_proli')
  }

  // 2) Confirmación de un nombre atípico pendiente: el «sí» confirma el candidato (nunca se guarda «sí»)
  let calidad: Calidad = intencion === 'ABUSO_O_INYECCION' ? 'FUERA_DE_TEMA' : a.calidad
  let organizacion = limpio(a.organizacion, 160)
  if (s.candidato) {
    if (CONFIRMA.test(dice)) {
      organizacion = organizacion && organizacion.toLowerCase() !== 'sí' && organizacion.toLowerCase() !== 'si' ? organizacion : s.candidato
      calidad = 'DATO_VALIDO'
    }
    s.candidato = null
  }

  // 3) Calidad de la respuesta frente al campo esperado
  if (calidad === 'DATO_VALIDO' && etapa === 'ESPERA_ORGANIZACION' && organizacion === dice && pareceAleatorio(dice)) calidad = 'TEXTO_ALEATORIO_PROBABLE'
  if (calidad === 'FUERA_DE_TEMA' || calidad === 'TEXTO_ALEATORIO_PROBABLE' || calidad === 'AMBIGUO') {
    s.invalidos++
    s.desvios++
    if (s.invalidos >= 2) return responder(LITERAL.cierreInvalido, 'cerrado', 'dos_invalidos')
    if (etapa === 'ESPERA_ORGANIZACION' && calidad !== 'FUERA_DE_TEMA') {
      s.candidato = dice.slice(0, 80)
      return responder(LITERAL.confirmarNombre(s.candidato), 'chat', 'confirmar_nombre')
    }
    return responder(LITERAL.aclarar[etapa], 'chat', 'aclaracion')
  }
  s.invalidos = 0

  // 4) Dato válido u omisión explícita: se guarda lo declarado y se avanza según la etapa
  const rol = limpio(a.rol, 160), objetivo = limpio(a.objetivo, 300), situacion = limpio(a.situacion, 300)
  if (calidad === 'DATO_VALIDO') {
    if (organizacion && !s.datos.organizacion) s.datos.organizacion = organizacion
    if (etapa === 'ESPERA_ORGANIZACION' && !s.datos.organizacion) s.datos.organizacion = dice.slice(0, 160)  // el nombre tal como lo declaró
    if (rol && !s.datos.rol) s.datos.rol = rol
    if (etapa === 'ESPERA_ROL' && !s.datos.rol) s.datos.rol = dice.slice(0, 160)
    if (objetivo) s.datos.objetivo = objetivo
    if (situacion) s.datos.situacion = situacion
  }
  if (calidad === 'OMISION_EXPLICITA' && etapa === 'ESPERA_OBJETIVO' && !s.datos.objetivo) {
    return responder(LITERAL.sinObjetivo, 'cerrado', 'sin_objetivo')
  }
  if (calidad === 'DATO_VALIDO' && etapa === 'ESPERA_OBJETIVO' && !s.datos.objetivo) {
    // Respondió a la meta pero el modelo no extrajo un objetivo: se toma lo que dijo, en sus palabras
    s.datos.objetivo = dice.slice(0, 300)
  }

  const proxima = siguienteEtapa(s, etapa)
  if (proxima === 'ESPERA_ROL' && s.preguntas < MAX_PREGUNTAS) return preguntar('ESPERA_ROL', LITERAL.rol, 'pregunta_rol')
  if (proxima === 'ESPERA_ROL' || proxima === 'ESPERA_OBJETIVO') {
    if (s.preguntas < MAX_PREGUNTAS) return preguntar('ESPERA_OBJETIVO', LITERAL.meta, 'pregunta_meta')
    return responder(LITERAL.sinObjetivo, 'cerrado', 'sin_preguntas')
  }

  // 5) Ya hay objetivo declarado: cierre con UNA hipótesis por validar (o, si no sirve, sin inventar)
  const visitante = s.h.filter((x) => x.r === 'v').map((x) => x.t).join(' ')
  let extra = ''
  for (let intento = 0; intento < 2; intento++) {
    const c = await modelo.cerrar(`Datos declarados → organización: «${s.datos.organizacion}», rol: «${s.datos.rol}», objetivo: «${s.datos.objetivo}», dificultad: «${s.datos.situacion}». ${extra}`)
    const mensaje = limpio(c.mensaje, 2000), hipotesis = limpio(c.hipotesis, 400)
    const sesgo = SESGO.test(`${mensaje} ${hipotesis}`) && !SESGO.test(visitante)
    if (mensaje && hipotesis && !sesgo) {
      const final = /20 minutos/.test(mensaje) && mensaje.endsWith('?') ? mensaje : `${mensaje.replace(/[¿?]/g, '').trim()} ${LITERAL.invitacion}`
      return responder(final, 'ficha', 'hipotesis', fichaDe(s, hipotesis, limpio(c.por_conocer, 400), limpio(c.meta_corta, 200)))
    }
    extra = sesgo ? 'No propongas automatización, chatbots, tableros ni IA: el visitante no los mencionó.' : 'Devuelve mensaje e hipótesis completos.'
  }
  return responder(`Gracias por contarme: tu meta es ${s.datos.objetivo.replace(/^que\s+/i, '').replace(/[.\s]+$/, '')}. ${LITERAL.capacidad} ${LITERAL.invitacion}`,
    'ficha', 'cierre_sin_hipotesis', fichaDe(s, 'Por definir en la conversación con el equipo', '', ''))
}

function fichaDe(s: Sesion, hipotesis: string, por_conocer: string, meta_corta: string): Ficha {
  return {
    organizacion: s.datos.organizacion, rol: s.datos.rol, objetivo: s.datos.objetivo,
    situacion: s.datos.situacion || 'Por conocer', hipotesis, por_conocer, meta_corta,
  }
}
