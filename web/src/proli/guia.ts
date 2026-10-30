/**
 * La guía paso a paso de Proli: en cada pantalla pregunta qué probar, con opciones de un toque.
 * Cada opción son órdenes reales (las mismas que usa la IA): Proli vuela al control y lo cambia.
 * No usa la IA ni la conexión, y no lleva cifras: las cifras las muestra la pantalla.
 *
 * `paso` avanza dentro de una misma pantalla (por ejemplo, en Acción: prioridad → colegio nuevo →
 * asignar); vuelve a 0 cuando cambia el capítulo.
 */
import type { Orden } from './ordenes'
import { NOMBRE_MOVILIDAD } from '../config'

export interface Opcion { texto: string; ordenes: Orden[]; respuesta: string }
export interface Paso { pregunta: string; opciones: Opcion[] }

const o = (nombre: string, entrada: Record<string, unknown> = {}): Orden => ({ nombre, entrada })
const cap = (demo: 'matricula' | 'movilidad', capitulo: string) => o(`${demo}_capitulo`, { capitulo })

/** El capítulo que dice la descripción de pantalla («Matrícula+, capítulo Acción, …»). */
export const capituloDe = (pantalla: string) => /capítulo ([^,]+)/.exec(pantalla)?.[1] ?? pantalla

export function guia(pantalla: string, _paso: number): Paso | null {
  if (pantalla === 'Conoce a Proli' || pantalla === 'página para elegir demo') return {
    pregunta: '¿Por cuál empezamos?',
    opciones: [
      { texto: 'Cupos escolares', ordenes: [o('abrir_demo', { demo: 'matricula' })], respuesta: 'Vamos a Matrícula+: cómo lograr que más niños tengan colegio cerca de casa.' },
      { texto: 'Seguridad vial', ordenes: [o('abrir_demo', { demo: 'movilidad' })], respuesta: 'Vamos a Presupuesto+: dónde invertir primero.' },
    ],
  }

  if (pantalla.startsWith('Matrícula+')) {
    const c = capituloDe(pantalla)
    const conLocalidad = pantalla.includes(', localidad ')
    const reto: Opcion = { texto: 'Tengo un reto en mi entidad', ordenes: [o('abrir_agenda', { demo: 'matricula' })], respuesta: 'Agenda una reunión con el equipo, con el código o el botón.' }
    if (c === 'portada') return {
      pregunta: '¿Vemos por qué tantos estudiantes quedan lejos de casa?',
      opciones: [{ texto: 'Sí, empecemos', ordenes: [cap('matricula', 'problema')], respuesta: 'Tener un cupo no siempre significa estudiar cerca.' }],
    }
    if (c === 'El problema') return {
      pregunta: '¿Y si cambiamos la decisión?',
      opciones: [{ texto: 'Sí, muéstrame', ordenes: [cap('matricula', 'solucion')], respuesta: 'Los mismos cupos, con más información para decidir.' }],
    }
    if (c === 'La solución') return {
      pregunta: '¿Vemos qué cambió?',
      opciones: [
        { texto: 'Ver qué cambió', ordenes: [cap('matricula', 'antes')], respuesta: 'Toca «Ver Matrícula+» y mira el mapa.' },
        { texto: 'Los criterios del modelo', ordenes: [cap('matricula', 'criterios')], respuesta: 'Quién tiene prioridad y por qué.' },
      ],
    }
    if (c === 'La gran revelación') return {
      pregunta: '¿Qué quieres ver en el mapa?',
      opciones: [
        { texto: 'El escenario de referencia', ordenes: [o('matricula_reparto', { reparto: 'hoy' })], respuesta: 'Así quedan con el orden de llegada simulado.' },
        { texto: 'Con Matrícula+', ordenes: [o('matricula_reparto', { reparto: 'despues' })], respuesta: 'En verde, los que estaban lejos y ahora quedan cerca.' },
        { texto: '¿Qué más encontramos?', ordenes: [cap('matricula', 'resultados')], respuesta: 'Dónde siguen haciendo falta cupos.' },
      ],
    }
    if (c === 'La segunda revelación' && !conLocalidad) return {
      pregunta: '¿Qué localidad quieres ver?',
      opciones: ['Bosa', 'Kennedy', 'Suba', 'Ciudad Bolívar'].map((l) => ({
        texto: l, ordenes: [o('matricula_localidad', { localidad: l })], respuesta: `Así cambia ${l}.` })),
    }
    if (c === 'La segunda revelación') return {
      pregunta: '¿Te cuento cómo lo hicimos?',
      opciones: [{ texto: 'Sí, cuéntame', ordenes: [cap('matricula', 'como')], respuesta: 'Datos, modelo y decisión.' }],
    }
    if (c === 'Cómo lo hicimos') return {
      pregunta: '¿Hablamos del reto de tu entidad?',
      opciones: [reto],
    }
    return null
  }

  if (pantalla.startsWith(NOMBRE_MOVILIDAD)) {
    const c = capituloDe(pantalla)
    const agenda: Opcion = { texto: 'Sí, agendemos', ordenes: [o('abrir_agenda', { demo: 'movilidad' })], respuesta: 'Agenda una reunión con el equipo, con el código o el botón.' }
    if (c === 'portada') return {
      pregunta: '¿Te muestro dónde invertir primero?',
      opciones: [{ texto: 'Sí, empecemos', ordenes: [cap('movilidad', 'problema')], respuesta: 'Hay muchos más lugares que recursos: hay que escoger.' }],
    }
    if (c === 'El problema') return {
      pregunta: '¿Vemos cómo se eligen?',
      opciones: [{ texto: 'Sí, muéstrame', ordenes: [cap('movilidad', 'solucion')], respuesta: 'Un solo año no cuenta toda la historia.' }],
    }
    if (c === 'La solución') return {
      pregunta: '¿Vemos qué cambia con el mismo presupuesto?',
      opciones: [{ texto: 'Sí, antes y después', ordenes: [cap('movilidad', 'antes')], respuesta: 'Toca «Ver Presupuesto+» y mira qué lugares cambian.' }],
    }
    if (c === 'Antes y después') return {
      pregunta: '¿Qué quieres ver en el mapa?',
      opciones: [
        { texto: 'La selección basada en 2024', ordenes: [o('movilidad_lista', { lista: 'contar' })], respuesta: 'En morado, los lugares que se escogen mirando solo 2024.' },
        { texto: 'Qué cambia con Presupuesto+', ordenes: [o('movilidad_lista', { lista: 'modelo' })], respuesta: 'En verde, los lugares que entran con Presupuesto+.' },
        { texto: 'Ver los resultados', ordenes: [cap('movilidad', 'resultados')], respuesta: 'Qué pasó en 2025 en los lugares de cada selección.' },
      ],
    }
    if (c === 'Resultados') return {
      pregunta: '¿Te cuento cómo lo hicimos?',
      opciones: [{ texto: 'Sí, cuéntame', ordenes: [cap('movilidad', 'como')], respuesta: 'Datos conectados, riesgo estimado y decisiones mejor informadas.' }],
    }
    if (c === 'Cómo lo hicimos' || c === 'Tu reto') return { pregunta: '¿Hablamos del reto de tu entidad?', opciones: [agenda] }
  }
  return null
}
