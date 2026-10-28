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

export function guia(pantalla: string, _paso: number): Paso | null {
  if (pantalla === 'Conoce a Proli' || pantalla === 'página para elegir demo') return {
    pregunta: '¿Por cuál empezamos?',
    opciones: [
      { texto: 'Cupos escolares', ordenes: [o('abrir_demo', { demo: 'matricula' })], respuesta: 'Vamos a Matrícula+: cómo lograr que más niños tengan colegio cerca de casa.' },
      { texto: 'Seguridad vial', ordenes: [o('abrir_demo', { demo: 'movilidad' })], respuesta: 'Vamos a Movilidad+: qué esquinas arreglar primero.' },
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

  if (pantalla.startsWith('Movilidad+')) {
    const c = capituloDe(pantalla)
    const agenda: Opcion = { texto: 'Sí, agendemos', ordenes: [o('abrir_agenda', { demo: 'movilidad' })], respuesta: 'Agenda una reunión con el equipo, con el código o el botón.' }
    if (c === 'portada') return {
      pregunta: '¿Escoges tú qué esquinas arreglar?',
      opciones: [{ texto: 'Sí, empecemos', ordenes: [cap('movilidad', 'problema')], respuesta: 'El presupuesto no alcanza para todas: hay que escoger.' }],
    }
    if (c === 'El presupuesto no alcanza') return {
      pregunta: '¿Escoges tus 3 esquinas?',
      opciones: [{ texto: 'Sí, escoger', ordenes: [cap('movilidad', 'escoge')], respuesta: 'Toca 3 de la lista o del mapa.' }],
    }
    if (c === '¿Cuáles 3 arreglarías tú?') return null
    if (c === '¿Qué falla aquí?') return {
      pregunta: '¿Te muestro cómo se mide el riesgo real?',
      opciones: [{ texto: 'Sí, muéstrame', ordenes: [cap('movilidad', 'ysi')], respuesta: 'Mira cómo las esquinas parecidas jalan a una esquina con un año malo.' }],
    }
    if (c.startsWith('¿Y si cada esquina')) return {
      pregunta: '¿Vemos el antes y el después?',
      opciones: [{ texto: 'Sí, antes y después', ordenes: [cap('movilidad', 'antes')], respuesta: 'Qué esquinas cambian, cuánto esperaba cada forma de escoger y cuánto hubo.' }],
    }
    if (c === 'Antes y después') return {
      pregunta: '¿Qué esquinas quieres ver en el mapa?',
      opciones: [
        { texto: 'Las de contar', ordenes: [o('movilidad_lista', { lista: 'contar' })], respuesta: 'En naranja, las que solo se escogen contando.' },
        { texto: 'Las del modelo', ordenes: [o('movilidad_lista', { lista: 'modelo' })], respuesta: 'En verde, las que solo escoge el modelo.' },
        { texto: 'Ver los resultados', ordenes: [cap('movilidad', 'resultados')], respuesta: 'Con $1.000 millones: dónde se invierte y cuánto se logra.' },
      ],
    }
    if (c === 'Resultados' || c === 'Tu localidad') return {
      pregunta: '¿Qué localidad quieres ver?',
      opciones: [['Kennedy', 'KENNEDY'], ['Bosa', 'BOSA'], ['Suba', 'SUBA'], ['Todas', 'TODA_BOGOTA']].map(([t, l]) => ({
        texto: t, ordenes: [o('movilidad_localidad', { localidad: l })], respuesta: 'Cuántas esquinas le tocan y qué se puede esperar.' })),
    }
    if (c === 'Presupuesto') return {
      pregunta: '¿Cuánto presupuesto probamos?',
      opciones: [
        { texto: '$1.000 millones', ordenes: [o('movilidad_presupuesto', { nivel: 'bajo' })], respuesta: 'Arriba ves cuántos siniestros graves se esperaría evitar.' },
        { texto: '$5.000 millones', ordenes: [o('movilidad_presupuesto', { nivel: 'medio' })], respuesta: 'Arriba ves cuántos siniestros graves se esperaría evitar.' },
        { texto: '$20.000 millones', ordenes: [o('movilidad_presupuesto', { nivel: 'alto' })], respuesta: 'Arriba ves cuántos siniestros graves se esperaría evitar.' },
      ],
    }
    if (c === 'Cómo se hizo' || c === 'Fuentes' || c === 'Tu reto') return { pregunta: '¿Hablamos del reto de tu entidad?', opciones: [agenda] }
  }
  return null
}
