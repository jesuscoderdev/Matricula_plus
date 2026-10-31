/**
 * La voz de Proli: un MP3 del saludo (public/voz/, grabado o generado con ElevenLabs) y, si no está,
 * la síntesis de voz del navegador (Web Speech API). Solo dice textos fijos (el saludo): nada de lo
 * que escribe el visitante. No usa el micrófono ni llama a servicios externos.
 *
 * Los navegadores no dejan hablar a una página antes de que el visitante la toque: si el saludo
 * automático se bloquea, `decir` avisa con `alBloquear` y la página ofrece el botón para escucharlo.
 */

/** De la más parecida al español de Colombia a la menos */
const ACENTOS = ['es-co', 'es-419', 'es-mx', 'es-us', 'es-es', 'es']

export const hayVoz = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Las voces llegan tarde en Chrome (evento voiceschanged): se esperan hasta un segundo */
function voces(): Promise<SpeechSynthesisVoice[]> {
  const ya = speechSynthesis.getVoices()
  if (ya.length) return Promise.resolve(ya)
  return new Promise((ok) => {
    const listo = () => { speechSynthesis.removeEventListener('voiceschanged', listo); ok(speechSynthesis.getVoices()) }
    speechSynthesis.addEventListener('voiceschanged', listo)
    window.setTimeout(listo, 1000)
  })
}

/** La voz en español con el acento más cercano; entre iguales, las de mejor calidad (naturales) */
function elegir(todas: SpeechSynthesisVoice[]) {
  const rango = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase().replace('_', '-')
    const i = ACENTOS.findIndex((a) => lang === a || (a === 'es' && lang.startsWith('es')))
    return i < 0 ? Infinity : i * 2 + (/natural|online|google/i.test(v.name) ? 0 : 1)
  }
  return todas.filter((v) => rango(v) < Infinity).sort((a, b) => rango(a) - rango(b))[0] ?? null
}

interface Avisos {
  alEmpezar?: () => void
  alTerminar?: () => void
  /** el navegador no dejó hablar (falta que el visitante toque la página) */
  alBloquear?: () => void
}

/**
 * Dice `texto` con la voz de Proli. Si hay `audio` (un MP3 grabado o generado, en public/voz/), suena
 * ese archivo; si no existe o no carga, la voz del navegador. Devuelve la función para callarlo.
 */
export function decir(texto: string, avisos: Avisos & { audio?: string } = {}): () => void {
  const { audio, ...resto } = avisos
  if (!audio) return sintetizar(texto, resto)
  const a = new Audio(audio)
  let callado = false
  let callar = () => { callado = true; a.pause() }
  a.onplaying = () => resto.alEmpezar?.()
  a.onended = () => resto.alTerminar?.()
  // Sin archivo (aún no lo han puesto) o sin poder cargarlo: la voz del navegador
  a.onerror = () => { if (!callado) callar = sintetizar(texto, resto) }
  a.play().catch((e: Error) => {
    if (e.name === 'NotAllowedError') { resto.alTerminar?.(); resto.alBloquear?.() }
  })
  return () => callar()
}

function sintetizar(texto: string, { alEmpezar, alTerminar, alBloquear }: Avisos): () => void {
  if (!hayVoz()) { alBloquear?.(); return () => {} }
  let cancelado = false
  speechSynthesis.cancel()
  voces().then((todas) => {
    if (cancelado) return
    const u = new SpeechSynthesisUtterance(texto)
    const voz = elegir(todas)
    if (voz) u.voice = voz
    u.lang = voz?.lang ?? 'es-CO'
    u.rate = 1.02
    u.pitch = 1.15   // un poco aguda: Proli es pequeño y alegre
    u.onstart = () => alEmpezar?.()
    u.onend = () => alTerminar?.()
    u.onerror = (e) => { alTerminar?.(); if (e.error === 'not-allowed') alBloquear?.() }
    speechSynthesis.speak(u)
  })
  return () => { cancelado = true; speechSynthesis.cancel() }
}
