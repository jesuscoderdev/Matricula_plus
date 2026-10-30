/**
 * Los 10 escenarios de aceptación del Playbook GovTech 2026 (sección 22) contra el servidor local de
 * Proli. Cada escenario es una conversación con turnos fijos del visitante; las acciones (tool_use) se
 * simulan respondiendo «Listo». Imprime la transcripción para revisarla a mano (no hay aserciones:
 * lo que se revisa es el tono, el flujo y que no invente ni prometa citas).
 *
 * Uso (desde web/, con la clave en .env.local):
 *   npm run build && npm run proli:local      (en otra terminal)
 *   npm run proli:pruebas > pruebas-proli.txt
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
]

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

for (const [nombre, pantalla, turnos] of escenarios) {
  console.log(`\n=== ${nombre}  [${pantalla}]`)
  const mensajes = []
  for (const dice of turnos) {
    console.log(`  Visitante: ${dice}`)
    mensajes.push({ role: 'user', content: dice }, P(pantalla))
    for (let paso = 0; paso < 4; paso++) {
      const r = await llamar(mensajes)
      if (r.error) { console.log('  ERROR', r.error); break }
      const acciones = r.fin.contenido.filter((b) => b.type === 'tool_use')
      if (r.texto.trim()) console.log(`  Proli: ${r.texto.trim()}`)
      if (acciones.length) console.log(`    [acciones: ${acciones.map((a) => `${a.name} ${JSON.stringify(a.input)}`).join(' · ')}]`)
      mensajes.push({ role: 'assistant', content: r.fin.contenido })
      if (!acciones.length) break
      mensajes.push({ role: 'user', content: acciones.map((a) => ({ type: 'tool_result', tool_use_id: a.id, content: `Listo: se ejecutó ${a.name}.` })) })
    }
  }
}
