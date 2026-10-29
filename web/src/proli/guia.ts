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
      pregunta: '¿Vemos por qué tantos niños estudian lejos de casa?',
      opciones: [{ texto: 'Sí, empecemos', ordenes: [cap('matricula', 'problema')], respuesta: 'Hoy, quien se inscribe primero elige primero.' }],
    }
    if (c === 'El problema') return {
      pregunta: '¿Y si el cupo se repartiera distinto?',
      opciones: [{ texto: 'Sí, muéstrame', ordenes: [cap('matricula', 'solucion')], respuesta: 'Primero entra quien más lo necesita.' }],
    }
    if (c === 'La solución') return {
      pregunta: '¿Quieres saber quién es quién?',
      opciones: [
        { texto: 'Sí, los grupos', ordenes: [cap('matricula', 'prioridad')], respuesta: 'Estos son los grupos con prioridad y por qué.' },
        { texto: 'Ver el antes y el después', ordenes: [cap('matricula', 'antes')], respuesta: 'Mismos colegios, mismos cupos.' },
      ],
    }
    if (c === '¿Quién es quién?') return {
      pregunta: '¿Vemos qué cambia?',
      opciones: [{ texto: 'Ver el antes y el después', ordenes: [cap('matricula', 'antes')], respuesta: 'Mismos colegios, mismos cupos.' }],
    }
    if (c === 'Antes y después') return {
      pregunta: '¿Qué quieres ver en el mapa?',
      opciones: [
        { texto: 'Cómo es hoy', ordenes: [o('matricula_reparto', { reparto: 'hoy' })], respuesta: 'Así quedan hoy, por orden de llegada.' },
        { texto: 'Con Matrícula+', ordenes: [o('matricula_reparto', { reparto: 'despues' })], respuesta: 'En verde, los que estaban lejos y ahora quedan cerca.' },
        { texto: 'Mi localidad', ordenes: [cap('matricula', 'localidad')], respuesta: 'Elige tu localidad.' },
      ],
    }
    if (c === 'Mira tu localidad' && !conLocalidad) return {
      pregunta: '¿Qué localidad quieres ver?',
      opciones: ['Bosa', 'Kennedy', 'Suba', 'Ciudad Bolívar'].map((l) => ({
        texto: l, ordenes: [o('matricula_localidad', { localidad: l })], respuesta: `Así cambia ${l}.` })),
    }
    if (c === 'Mira tu localidad' || c === 'Resultados') return {
      pregunta: c === 'Resultados' ? '¿Vemos dónde faltan cupos?' : '¿Vemos los resultados de toda Bogotá?',
      opciones: [c === 'Resultados'
        ? { texto: '¿Dónde faltan cupos?', ordenes: [cap('matricula', 'faltan')], respuesta: 'Repartir mejor no crea cupos: aquí hacen falta.' }
        : { texto: 'Ver los resultados', ordenes: [cap('matricula', 'resultados')], respuesta: 'Esto es lo que cambia en Bogotá.' }],
    }
    if (c === '¿Dónde faltan cupos?') return {
      pregunta: '¿Qué nivel quieres ver?',
      opciones: [
        ...['Preescolar', 'Secundaria', 'Media'].map((n) => ({ texto: n, ordenes: [o('matricula_nivel', { nivel: n })], respuesta: `Donde faltan cupos de ${n.toLowerCase()}.` })),
        { texto: '¿Cómo se hizo?', ordenes: [cap('matricula', 'como')], respuesta: 'Con datos abiertos, paso a paso.' },
      ],
    }
    if (c === 'Cómo se hizo' || c === 'Fuentes') return {
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
