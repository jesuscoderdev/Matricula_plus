/**
 * El tono de Proli: siempre de tú, cercano, amable y profesional. Revisa lo que Proli le dice al
 * visitante en los tres lugares de donde sale: las instrucciones de la IA (api/_proli/instrucciones.ts),
 * las respuestas sin conexión (src/proli/Asistente.tsx) y la guía de preguntas (src/proli/guia.ts),
 * además de los saludos de config.ts.
 *
 * Asistente.tsx y guia.ts no se pueden importar en Node (JSX e imports sin extensión), así que de
 * ellos se leen los textos que dice Proli directamente del código fuente.
 *
 * Uso:  npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { INSTRUCCIONES } from '../api/_proli/instrucciones.ts'
import { PROLI_INTRO, PORTADA_STAND } from '../src/config.ts'

const leer = (ruta: string) => fs.readFileSync(new URL(ruta, import.meta.url), 'utf-8')

/** Palabra completa, con tildes (\b de JavaScript no entiende «é» ni «ñ») */
const palabra = (p: string) => new RegExp(`(?<!\\p{L})(?:${p})(?!\\p{L})`, 'iu')

/** Formas de «usted» y del plural «ustedes» que Proli no debe usar con el visitante */
const PROHIBIDAS: [string, RegExp][] = [
  ['usted / ustedes', palabra('ustedes|usted')],
  ['les (plural)', palabra('les')],
  ['su / sus + entidad, equipo…', palabra('sus? (?:entidad|equipo|organización|reto|pregunta|solicitud|datos|nombre)')],
  ['imperativo de usted', palabra('cuénteme|dígame|cuéntenos|escríbanos|indíquenos|disculpe|permítame|toque|escanee|envíe|agende')],
  ['pronombre de usted', palabra('llevarlo|llevarla|mostrarle|contarle|decirle|ayudarlo|ayudarla|acompañarlo|le cuento|le muestro|le dejo')],
  ['subjuntivo de usted', palabra('quiera|pueda|desee|desea|tenga')],
  ['verbo en plural', palabra('quieren|pudieran|quisieran|intentaron|exploran|pueden ustedes')],
]
/** Jerga que rompe el tono profesional */
const JERGA = palabra('parce|parcero|bro|mi rey|mi reina|qué más pues|hágale')

function revisar(nombre: string, texto: string) {
  for (const [regla, re] of PROHIBIDAS) {
    const m = texto.match(re)
    assert.equal(m, null, `${nombre}: «${m?.[0]}» (${regla}) en «${texto}»`)
  }
  const j = texto.match(JERGA)
  assert.equal(j, null, `${nombre}: jerga «${j?.[0]}» en «${texto}»`)
}

/** Los valores literales de `clave: '…'` (o con comillas invertidas) en un archivo fuente */
function valores(fuente: string, clave: string) {
  const re = new RegExp(`${clave}: (['\`])((?:\\\\.|(?!\\1).)*)\\1`, 'g')
  return [...fuente.matchAll(re)].map((m) => m[2])
}

// Las instrucciones sin la regla de voz, que nombra a propósito lo que no se debe decir
const reglaDeVoz = INSTRUCCIONES.split('\n').find((l) => l.includes('Siempre de «tú»')) ?? ''
const instrucciones = INSTRUCCIONES.replace(reglaDeVoz, '')
const lineaAmabilidad = INSTRUCCIONES.split('\n').find((l) => l.startsWith('- Amabilidad:')) ?? ''

/** Lo que Proli dice textualmente en las instrucciones: las frases entre «» que no son del visitante */
function frasesDeProli() {
  const frases: string[] = []
  for (const linea of instrucciones.replace(lineaAmabilidad, '').split('\n')) {
    const citas = [...linea.matchAll(/«([^»]*)»/g)].map((m) => m[1])
    // En las objeciones («lo que dice el visitante»: «lo que responde Proli») la primera cita es del visitante
    frases.push(...(/^- «[^»]*»(?: o «[^»]*»)?:/.test(linea) || linea.startsWith('- Seguridad (') ? citas.slice(1) : citas))
  }
  return frases.filter((f) => f.split(' ').length > 2)   // fuera palabras sueltas como «hoy» o «malo»
}

test('las instrucciones piden siempre tú, nunca usted', () => {
  assert.match(reglaDeVoz, /Siempre de «tú», nunca «usted»/)
  for (const p of ['«ustedes»', '«les»', '«su entidad»']) assert.ok(reglaDeVoz.includes(p), `la regla de voz debería prohibir ${p}`)
})

test('las instrucciones piden un tono cercano, amable y profesional', () => {
  for (const p of ['cercano', 'amable', 'profesional', 'respeto']) assert.ok(reglaDeVoz.includes(p), `la regla de voz debería decir «${p}»`)
  assert.ok(lineaAmabilidad, 'falta la línea de amabilidad')
  assert.match(lineaAmabilidad, /agradece/i)
  assert.match(lineaAmabilidad, /alternativa/)
})

test('las frases de ejemplo de Proli en las instrucciones tutean', () => {
  const frases = frasesDeProli()
  assert.ok(frases.length > 20, `se esperaban más de 20 frases de ejemplo, hay ${frases.length}`)
  for (const f of frases) revisar('instrucciones', f)
})

test('las instrucciones no tienen usted ni plural fuera de la regla de voz', () => {
  for (const [regla, re] of PROHIBIDAS.slice(0, 2)) {
    const m = instrucciones.match(re)
    assert.equal(m, null, `instrucciones: «${m?.[0]}» (${regla})`)
  }
})

test('la bienvenida de Proli es cálida y de tú', () => {
  const bienvenida = instrucciones.match(/1\) Bienvenida: «([^»]*)»/)?.[1] ?? ''
  assert.match(bienvenida, /^Hola, soy Proli/)
  assert.match(bienvenida, /¿Te muestro/)
})

test('las respuestas sin conexión de Proli tutean', () => {
  const fuente = leer('../src/proli/Asistente.tsx')
  const textos = [
    ...valores(fuente, 'sinConexion'),
    ...[...fuente.matchAll(/quien: '(?:proli|aviso)', texto: (['`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]),
  ]
  assert.ok(textos.length > 10, `se esperaban más de 10 respuestas, hay ${textos.length}`)
  for (const t of textos) revisar('Asistente.tsx', t)
})

test('la guía de Proli (preguntas y respuestas) tutea', () => {
  const fuente = leer('../src/proli/guia.ts')
  const textos = [...valores(fuente, 'pregunta'), ...valores(fuente, 'respuesta')]
  assert.ok(textos.length > 20, `se esperaban más de 20 textos, hay ${textos.length}`)
  for (const t of textos) revisar('guia.ts', t)
})

test('los saludos de Proli en pantalla tutean', () => {
  for (const t of [PROLI_INTRO.saludo, PROLI_INTRO.texto, PORTADA_STAND.proli]) revisar('config.ts', t)
})

test('el detector encuentra usted, plural y jerga (control)', () => {
  const malas = ['¿Qué decisión les cuesta tomar?', 'Cuénteme su reto', 'Puedo llevarlo a donde quiera',
    '¿Qué cambiaría para ustedes?', 'Escanee el código', 'Listo, parce']
  for (const f of malas) assert.throws(() => revisar('control', f), undefined, `debería rechazar «${f}»`)
  for (const f of ['¿Qué decisión te cuesta tomar?', 'Cuéntame tu reto', 'Puedo llevarte a donde quieras',
    'Los colegios disponibles', 'Escanea el código']) revisar('control', f)
})
