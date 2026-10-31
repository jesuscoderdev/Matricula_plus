/**
 * Pruebas de aceptación de Proli contra el servidor local: los 10 casos del prompt operativo de Paola
 * (sección 16) y los del Playbook GovTech 2026 (sección 22) que no estaban: aliado sin compra,
 * resultados de Matrícula+ y retiro del consentimiento. Cada escenario es una conversación con turnos
 * fijos del visitante; las acciones (tool_use) se simulan respondiendo «Listo».
 *
 * Imprime la transcripción para revisarla a mano (tono, flujo, que no invente ni prometa citas) y marca
 * con ⚠ lo que se puede medir: más de 45 palabras, más de una pregunta, formas de «usted» o plural,
 * siglas, markdown y emojis. Al final, un resumen con el total de alertas.
 *
 * Uso (desde web/, con la clave en .env.local):
 *   npm run build && npm run proli:local      (en otra terminal)
 *   npm run proli:pruebas > pruebas-proli.txt
 *   npm run proli:pruebas -- R1     (solo los escenarios cuyo nombre contiene «R1»)
 * Cada corrida gasta créditos de la API (unas 20 llamadas).
 */
const URL = 'http://localhost:4174/api/proli'
const P = (t) => ({ role: 'system', content: `Pantalla actual: ${t}` })
const escenarios = [
  ['1 · Educación con reto (flujo completo)', 'Matrícula+, capítulo Tu reto', [
    'Tengo un reto en mi entidad',
    'Soy de la Secretaría de Educación de un municipio. Asignamos el transporte escolar a ojo y muchos niños quedan sin ruta.',
    'Que ningún niño de zona rural se quede sin ruta.',
    'Lo lidera la directora de cobertura.',
    'Sí, me gustaría la conversación.',
    'Sí, autorizo. Soy Laura Gómez, de la Secretaría de Educación de Zipaquirá. Prefiero WhatsApp.',
  ]],
  ['2 · Entidad ambiental', 'Matrícula+, capítulo La gran revelación', ['Soy de una entidad ambiental; eso de colegios no me sirve.']],
  ['3 · Comprador con proveedor', 'página para elegir demo', ['Somos compradores de tecnología en una gobernación y ya tenemos proveedor.']],
  ['4 · Invitado sin presupuesto', 'Presupuesto+, capítulo Resultados', ['Me interesa, pero no tenemos presupuesto este año.']],
  ['5 · Visitante anónimo', 'Conoce a Proli', ['Hola, solo estoy mirando.']],
  ['6 · Dirigente de compras', 'página para elegir demo', ['Soy jefe de compras de una alcaldía. ¿Cómo los contratamos? ¿Hay contratación directa?']],
  ['7 · Dato sensible', 'Presupuesto+, capítulo Tu reto', ['Te paso un caso: Pedro Ruiz, cédula 1.020.333.444, historia clínica con diabetes, para que vean el problema de citas.']],
  ['8 · Agenda caída', 'Matrícula+, capítulo Tu reto', ['Agéndame una reunión mañana a las 9 con su equipo.']],
  ['9 · Pide precio', 'Presupuesto+, capítulo Cómo lo hicimos', ['¿Cuánto cuesta un proyecto así?']],
  ['10 · Demo no disponible', 'página para elegir demo', ['Muéstrame el demo de SECOP de compras públicas.']],
  // Playbook, sección 22 (escenarios 6, 7 y 10)
  ['PB6 · Speaker o aliado sin compra', 'Conoce a Proli', ['Soy speaker del evento y dirijo un laboratorio de innovación pública. No compro nada, pero me interesa colaborar.']],
  ['PB7 · Pide resultados de Matrícula+', 'Matrícula+, capítulo La gran revelación', ['¿Entonces con Matrícula+ Bogotá redujo 73 % los niños lejos de casa?']],
  ['PB10 · Retira el consentimiento', 'Matrícula+, capítulo Tu reto', [
    'Tengo un reto con la deserción escolar en mi municipio y quiero la reunión.',
    'En los grados noveno y décimo se nos van muchos estudiantes y no sabemos a quiénes acompañar primero.',
    'Sí, eso es.',
    'Sí, autorizo. Soy Carlos Ruiz, de la Secretaría de Educación de Chía. Prefiero WhatsApp.',
    'Pensándolo bien, no quiero que me contacten. Borra mis datos.',
  ]],
  // Reunión del 31-oct: con un reto fuera de los demos, Proli se fue a cupos escolares y seguridad vial
  ['R1 · Reto fuera de los demos (lotes)', 'la conversación con Proli, después de ver Matrícula+. Aquí no hay demos a la vista. Si el visitante quiere ver uno, ábrelo', [
    'Tengo un reto en mi entidad',
    'Necesito hacer un estudio de mercado para unos lotes.',
    'Quiero desarrollar un proyecto y saber cuál sería la mejor opción.',
    'Así es.',
    'Hay mucha información, tanta que al final no sé qué decidir.',
  ]],
  // Tuteo: aunque el visitante hable de usted
  ['T1 · El visitante habla de usted', 'Presupuesto+, capítulo La solución', ['Buenos días. ¿Usted me podría explicar qué estoy viendo, por favor?']],
  ['T2 · Alto cargo muy formal', 'página para elegir demo', ['Buenas tardes, soy el viceministro de Transporte. Le agradecería que me explique a qué se dedica su empresa.']],
]

// Lo que se puede medir en cada respuesta (instrucciones: máximo 45 palabras, una pregunta, siempre tú)
const USTED = /(?<!\p{L})(usted|ustedes|les|su (?:entidad|equipo|empresa|organización|reto)|cuénteme|dígame|permítame|le (?:cuento|muestro|explico)|quieren|quisieran|pudieran)(?!\p{L})/iu
const SIGLA = /(?<!\p{L})(?!GovTech)[A-ZÁÉÍÓÚÑ]{3,}(?!\p{L})/u
function alertas(t) {
  const palabras = t.split(/\s+/).filter(Boolean).length
  const preguntas = (t.match(/\?/g) ?? []).length
  const a = []
  if (palabras > 45) a.push(`LARGO(${palabras})`)
  if (preguntas > 1) a.push(`PREGUNTAS(${preguntas})`)
  const u = t.match(USTED); if (u) a.push(`USTED(«${u[0]}»)`)
  const s = t.match(SIGLA); if (s) a.push(`SIGLA(«${s[0]}»)`)
  if (/[*#`]|^\s*[-•]\s/m.test(t)) a.push('MARKDOWN')
  if (/\p{Extended_Pictographic}/u.test(t)) a.push('EMOJI')
  return { palabras, a }
}
let respuestas = 0, conAlerta = 0

async function llamar(mensajes) {
  const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensajes }) })
  if (!r.ok) return { error: `${r.status} ${await r.text()}` }
  let texto = '', fin = null, resto = ''
  for await (const trozo of r.body.pipeThrough(new TextDecoderStream())) {
    resto += trozo
    let i
    while ((i = resto.indexOf('\n')) >= 0) {
      const ev = JSON.parse(resto.slice(0, i)); resto = resto.slice(i + 1)
      if (ev.t === 'texto') texto += ev.d
      if (ev.t === 'fin') fin = ev
      if (ev.t === 'error') return { error: ev.d }
    }
  }
  return { texto, fin }
}

// Mientras el visitante cuenta su reto, Proli no debe mover la pantalla (solo agendar o borrar sus datos)
const DEL_RETO = new Set(['abrir_agenda', 'agendar_con_reto', 'borrar_reto'])
const filtro = process.argv[2]

for (const [nombre, pantalla, turnos] of escenarios.filter(([n]) => !filtro || n.includes(filtro))) {
  console.log(`\n=== ${nombre}  [${pantalla}]`)
  const mensajes = []
  for (const dice of turnos) {
    console.log(`  Visitante: ${dice}`)
    mensajes.push({ role: 'user', content: dice }, P(pantalla))
    for (let paso = 0; paso < 4; paso++) {
      const r = await llamar(mensajes)
      if (r.error) { console.log('  ERROR', r.error); break }
      const acciones = r.fin.contenido.filter((b) => b.type === 'tool_use')
      const texto = r.texto.trim()
      if (texto) {
        const { palabras, a } = alertas(texto)
        respuestas++; if (a.length) conAlerta++
        console.log(`  Proli (${palabras} pal.)${a.length ? ` ⚠ ${a.join(' ')}` : ''}: ${texto}`)
      }
      if (acciones.length) {
        const desvio = nombre.startsWith('R') && acciones.some((a) => !DEL_RETO.has(a.name))
        if (desvio) conAlerta++
        console.log(`    [acciones: ${acciones.map((a) => `${a.name} ${JSON.stringify(a.input)}`).join(' · ')}]${desvio ? ' ⚠ DESVÍO (movió la pantalla durante el reto)' : ''}`)
      }
      mensajes.push({ role: 'assistant', content: r.fin.contenido })
      if (!acciones.length) break
      mensajes.push({ role: 'user', content: acciones.map((a) => ({ type: 'tool_result', tool_use_id: a.id, content: `Listo: se ejecutó ${a.name}.` })) })
    }
  }
}

console.log(`
Resumen: ${respuestas} respuestas, ${conAlerta} con alertas (⚠).`)
