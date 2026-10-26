/**
 * La guía paso a paso de Proli: en cada pantalla pregunta qué probar, con opciones de un toque.
 * Cada opción son órdenes reales (las mismas que usa la IA): Proli vuela al control y lo cambia.
 * No usa la IA ni la conexión, y no lleva cifras: las cifras las muestra la pantalla.
 *
 * `paso` avanza dentro de una misma pantalla (por ejemplo, en Acción: prioridad → colegio nuevo →
 * asignar); vuelve a 0 cuando cambia el capítulo.
 */
import type { Orden } from './ordenes'

export interface Opcion { texto: string; ordenes: Orden[]; respuesta: string }
export interface Paso { pregunta: string; opciones: Opcion[] }

const o = (nombre: string, entrada: Record<string, unknown> = {}): Orden => ({ nombre, entrada })
const cap = (demo: 'matricula' | 'movilidad', capitulo: string) => o(`${demo}_capitulo`, { capitulo })

/** El capítulo que dice la descripción de pantalla («Matrícula+, capítulo Acción, …»). */
export const capituloDe = (pantalla: string) => /capítulo ([^,]+)/.exec(pantalla)?.[1] ?? pantalla

export function guia(pantalla: string, paso: number): Paso | null {
  if (pantalla === 'Conozca a Proli' || pantalla === 'página para elegir demo') return {
    pregunta: '¿Por cuál empezamos?',
    opciones: [
      { texto: 'Cupos escolares', ordenes: [o('abrir_demo', { demo: 'matricula' })], respuesta: 'Vamos a Matrícula+: ¿dónde cabe cada niño?' },
      { texto: 'Seguridad vial', ordenes: [o('abrir_demo', { demo: 'movilidad' })], respuesta: 'Vamos a Movilidad+: ¿dónde se evitan más siniestros?' },
    ],
  }

  if (pantalla.startsWith('Matrícula+')) {
    const c = capituloDe(pantalla)
    const conLocalidad = pantalla.includes(', localidad ')
    if (c === 'portada') return {
      pregunta: '¿Empezamos por ver cómo se reparten hoy los cupos?',
      opciones: [{ texto: 'Sí, empecemos', ordenes: [cap('matricula', 'problema')], respuesta: 'Elija su localidad y mire cómo llegan las familias.' }],
    }
    if (c === 'Problema' && !conLocalidad) return {
      pregunta: '¿Qué localidad quiere ver?',
      opciones: ['Suba', 'Kennedy', 'Bosa', 'Ciudad Bolívar'].map((l) => ({
        texto: l, ordenes: [o('matricula_localidad', { localidad: l })], respuesta: `Así se asignan hoy los cupos en ${l}: por orden de llegada.` })),
    }
    if (c === 'Problema') return {
      pregunta: '¿Probamos otras reglas para repartir los cupos?',
      opciones: [{ texto: 'Sí, cambiemos las reglas', ordenes: [cap('matricula', 'accion')], respuesta: 'Aquí usted decide. Le pregunto paso a paso.' }],
    }
    if (c === 'Acción') {
      if (paso === 0) return {
        pregunta: '¿A quién le damos prioridad?',
        opciones: [
          { texto: 'A quien vive cerca', ordenes: [o('matricula_reglas', { reglas: 'cercania' })], respuesta: 'Listo: primero quien vive más cerca.' },
          { texto: 'A los hermanos', ordenes: [o('matricula_reglas', { reglas: 'familias' })], respuesta: 'Listo: primero quien ya tiene un hermano en el colegio.' },
          { texto: 'A los vulnerables', ordenes: [o('matricula_reglas', { reglas: 'equidad' })], respuesta: 'Listo: primero las familias vulnerables.' },
          { texto: 'Un poco de todo', ordenes: [o('matricula_reglas', { reglas: 'equilibrada' })], respuesta: 'Listo: cercanía, hermanos y vulnerabilidad pesan igual.' },
        ],
      }
      if (paso === 1) return {
        pregunta: conLocalidad ? '¿Sumamos un colegio nuevo donde más rinde para esta localidad?' : '¿Sumamos un colegio nuevo donde más rinde?',
        opciones: [
          { texto: 'Sí, donde más rinde', ordenes: [o('matricula_colegio_sugerido')], respuesta: 'Lo puse donde más niños entran a sus colegios. Debajo de cada opción ve cuántos.' },
          { texto: 'No por ahora', ordenes: [o('matricula_colegio_nuevo', { ubicacion: 'ninguno' })], respuesta: 'Sin colegio nuevo: solo cambian las reglas.' },
        ],
      }
      if (paso === 2) return {
        pregunta: '¿Asignamos los cupos con estas reglas?',
        opciones: [{ texto: '▶ Asignar', ordenes: [o('matricula_asignar')], respuesta: 'Mire cómo piden todas las familias a la vez, ronda por ronda.' }],
      }
      return {
        pregunta: '¿Vemos qué cambió?',
        opciones: [{ texto: 'Ver el resultado', ordenes: [cap('matricula', 'resultado')], respuesta: 'Arriba está lo que más cambió, en niños.' }],
      }
    }
    if (c === 'Resultado') return {
      pregunta: '¿Qué quiere probar ahora?',
      opciones: [
        { texto: 'Otras reglas', ordenes: [cap('matricula', 'accion')], respuesta: 'Volvamos a las reglas.' },
        { texto: '¿Y si cambian los supuestos?', ordenes: [cap('matricula', 'laboratorio')], respuesta: 'Mueva un supuesto y todo se recalcula.' },
        { texto: 'Quiero esto con mis datos', ordenes: [o('abrir_agenda', { demo: 'matricula' })], respuesta: 'Agende una conversación con el equipo, con el código o el botón.' },
      ],
    }
    if (c === 'Supuestos' || c === 'Método') return {
      pregunta: '¿Lo vemos con los datos de su entidad?',
      opciones: [{ texto: 'Sí, agendar', ordenes: [o('abrir_agenda', { demo: 'matricula' })], respuesta: 'Agende una conversación con el equipo, con el código o el botón.' }],
    }
    return null
  }

  if (pantalla.startsWith('Movilidad+')) {
    const c = capituloDe(pantalla)
    if (c === 'portada') return {
      // Movilidad+ trata de «tú», como sus pantallas
      pregunta: '¿Elegimos juntos dónde harías una obra?',
      opciones: [{ texto: 'Sí, empecemos', ordenes: [cap('movilidad', 'decide')], respuesta: 'Primero elige una localidad.' }],
    }
    if (c === 'Tú decides') return {
      pregunta: '¿En qué localidad buscas esquinas?',
      opciones: [['Kennedy', 'KENNEDY'], ['Bosa', 'BOSA'], ['Suba', 'SUBA'], ['Engativá', 'ENGATIVÁ']].map(([t, l]) => ({
        texto: t, ordenes: [o('movilidad_localidad', { localidad: l })], respuesta: 'Ahora toca en el mapa las esquinas que arreglarías primero.' })),
    }
    if (c === 'Pasó un año') return {
      pregunta: '¿Qué año quieres ver en el mapa?',
      opciones: [
        { texto: 'El año en que elegiste', ordenes: [o('movilidad_anio_mapa', { anio: '2024' })], respuesta: 'Así estaban las esquinas cuando las elegiste.' },
        { texto: 'Un año después', ordenes: [o('movilidad_anio_mapa', { anio: '2025' })], respuesta: 'Y así les fue un año después.' },
      ],
    }
    if (c === 'El giro') return {
      pregunta: '¿Te muestro cómo lo resolvemos?',
      opciones: [{ texto: 'Sí, el método', ordenes: [cap('movilidad', 'metodo')], respuesta: 'Mira cuánto prometió cada forma de elegir y cuánto pasó.' }],
    }
    if (c === 'El método') return {
      pregunta: '¿Comparamos calles de barrio o avenidas?',
      opciones: [
        { texto: 'Calles de barrio', ordenes: [o('movilidad_tipo_via', { zona: 'barrio' })], respuesta: 'Las calles de barrio, donde hay menos datos.' },
        { texto: 'Avenidas', ordenes: [o('movilidad_tipo_via', { zona: 'avenidas' })], respuesta: 'Las avenidas, que la ciudad ya vigila.' },
        { texto: 'Llevarlo al presupuesto', ordenes: [cap('movilidad', 'presupuesto')], respuesta: 'Elige cuánto invertir.' },
      ],
    }
    if (c === 'Presupuesto') return {
      pregunta: '¿Cuánto presupuesto probamos?',
      opciones: [
        { texto: '$1.000 millones', ordenes: [o('movilidad_presupuesto', { nivel: 'bajo' })], respuesta: 'Mira lo que prometes y lo que lograrías.' },
        { texto: '$5.000 millones', ordenes: [o('movilidad_presupuesto', { nivel: 'medio' })], respuesta: 'Mira lo que prometes y lo que lograrías.' },
        { texto: '$20.000 millones', ordenes: [o('movilidad_presupuesto', { nivel: 'alto' })], respuesta: 'Mira lo que prometes y lo que lograrías.' },
      ],
    }
    if (c === 'Fuentes' || c === 'Hablemos') return {
      pregunta: '¿Lo vemos con los datos de tu entidad?',
      opciones: [{ texto: 'Sí, agendar', ordenes: [o('abrir_agenda', { demo: 'movilidad' })], respuesta: 'Agenda una reunión con Proliferante, con el código o el botón.' }],
    }
  }
  return null
}
