/**
 * Herramientas de Proli: acciones sobre la interfaz que ejecuta el NAVEGADOR (src/proli/ordenes.ts),
 * no el servidor. Por eso solo mueven pantallas y controles del demo; ninguna envía datos ni escribe
 * nada. Los valores son listas cerradas (enum) y `strict` garantiza entradas válidas.
 *
 * Los nombres y valores deben coincidir con los que entiende src/proli/ordenes.ts.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { LOCALIDADES_MATRICULA, LOCALIDADES_MOVILIDAD } from './conocimiento.js'

type Herramienta = Anthropic.Beta.Messages.BetaTool

const objeto = (propiedades: Record<string, unknown>, requeridas = Object.keys(propiedades)) => ({
  type: 'object' as const,
  properties: propiedades,
  required: requeridas,
  additionalProperties: false,
})

// eager_input_streaming: las entradas se transmiten a medida que se generan; el navegador valida
// cada una contra estas mismas listas antes de ejecutarla (ver src/proli/ordenes.ts)
const h = (name: string, description: string, input_schema: ReturnType<typeof objeto>): Herramienta => ({
  name, description, input_schema, strict: true, eager_input_streaming: true,
})

export const HERRAMIENTAS: Herramienta[] = [
  h('ir_a_pantalla', 'Lleva al visitante a una pantalla fuera de los demos: la portada, la presentación de Proli o la página para elegir demo.',
    objeto({ pantalla: { type: 'string', enum: ['portada', 'conozca_a_proli', 'elegir_demo'] } })),
  h('abrir_demo', 'Abre uno de los dos demos desde su inicio.',
    objeto({ demo: { type: 'string', enum: ['matricula', 'movilidad'] } })),
  h('abrir_agenda', 'Lleva al capítulo con el código QR para agendar una conversación con el equipo de Proliferante, en el demo indicado.',
    objeto({ demo: { type: 'string', enum: ['matricula', 'movilidad'] } })),
  h('agendar_con_reto', 'Cuando ya conoces el reto del visitante: guarda un resumen de su reto para que el mensaje de WhatsApp y el código QR de la cita ya lo lleven escrito, y lo lleva al capítulo de agenda del demo indicado. El resumen: una o dos frases (máximo unos 250 caracteres) con el tipo de entidad, la decisión que le cuesta tomar y la información que tienen. NUNCA incluyas nombres de personas, teléfonos, correos, documentos ni otros datos personales.',
    objeto({ demo: { type: 'string', enum: ['matricula', 'movilidad'] }, resumen: { type: 'string' } })),

  // --- Movilidad+ (abre el demo si no está abierto) ---
  h('movilidad_capitulo', 'Movilidad+: va a un capítulo. decide = Tú decides; anio = Pasó un año; giro = El giro; metodo = El método; presupuesto; fuentes; cierre = Hablemos (QR).',
    objeto({ capitulo: { type: 'string', enum: ['portada', 'decide', 'anio', 'giro', 'metodo', 'presupuesto', 'fuentes', 'cierre'] } })),
  h('movilidad_localidad', 'Movilidad+: acerca el mapa a una localidad (o vuelve a toda Bogotá) en el capítulo «Tú decides».',
    objeto({ localidad: { type: 'string', enum: [...LOCALIDADES_MOVILIDAD, 'TODA_BOGOTA'] } })),
  h('movilidad_presupuesto', 'Movilidad+: muestra el capítulo Presupuesto con uno de los tres montos: bajo = $1.000 millones, medio = $5.000 millones, alto = $20.000 millones.',
    objeto({ nivel: { type: 'string', enum: ['bajo', 'medio', 'alto'] } })),
  h('movilidad_tipo_via', 'Movilidad+: en El método, muestra la comparación de calles de barrio o de avenidas.',
    objeto({ zona: { type: 'string', enum: ['barrio', 'avenidas'] } })),
  h('movilidad_anio_mapa', 'Movilidad+: en Pasó un año, muestra el mapa de 2024 o el de 2025.',
    objeto({ anio: { type: 'string', enum: ['2024', '2025'] } })),

  // --- Matrícula+ (abre el demo si no está abierto) ---
  h('matricula_capitulo', 'Matrícula+: va a un capítulo. problema; accion = elegir reglas y asignar; resultado; laboratorio = Supuestos; metodo = Así lo resolvimos; explorar = UPZ por UPZ; agendar.',
    objeto({ capitulo: { type: 'string', enum: ['portada', 'problema', 'accion', 'resultado', 'laboratorio', 'metodo', 'explorar', 'agendar'] } })),
  h('matricula_localidad', 'Matrícula+: elige la localidad y muestra en el capítulo Problema cómo se asignan hoy los cupos allí.',
    objeto({ localidad: { type: 'string', enum: [...LOCALIDADES_MATRICULA] } })),
  h('matricula_reglas', 'Matrícula+: cambia las reglas de prioridad en el capítulo Acción. equilibrada = cercanía, hermanos y vulnerabilidad pesan igual; cercania = primero quien vive cerca; familias = primero quien tiene hermanos; equidad = primero las familias vulnerables.',
    objeto({ reglas: { type: 'string', enum: ['equilibrada', 'cercania', 'familias', 'equidad'] } })),
  h('matricula_colegio_nuevo', 'Matrícula+: pone (o quita) un colegio nuevo de 1.200 cupos en uno de los proyectos reales de la Secretaría de Educación, en el capítulo Acción.',
    objeto({ ubicacion: { type: 'string', enum: ['tibabuyes', 'suba', 'bosa', 'kennedy', 'ciudad_bolivar', 'ninguno'] } })),
  h('matricula_colegio_sugerido', 'Matrícula+: pone el colegio nuevo donde más niños entran a alguno de los colegios que pidieron: en la localidad que el visitante eligió (el mejor proyecto de la SED o el mejor lugar que encuentra la simulación) o, sin localidad, el mejor proyecto de la SED para Bogotá. Devuelve dónde quedó y cuántos niños ayuda.',
    objeto({})),
  h('matricula_jornada_unica', 'Matrícula+: activa o desactiva la jornada única (−10 % de capacidad en todas las sedes) en el capítulo Acción.',
    objeto({ activa: { type: 'boolean' } })),
  h('matricula_resultados', 'Matrícula+: calcula, con la misma simulación que muestra la pantalla y con las reglas y supuestos que el visitante tiene ahora, los resultados de una localidad, de toda Bogotá o de la zona crítica (hoy frente a las reglas elegidas: fuera de sus opciones, primera opción, sin cupo cercano, vulnerables, viajes largos). Úsala para responder cifras por localidad o con reglas distintas. Con mostrar=true además lleva al visitante al capítulo Resultado de ese lugar.',
    objeto({ ambito: { type: 'string', enum: [...LOCALIDADES_MATRICULA, 'BOGOTA', 'ZONA_CRITICA'] }, mostrar: { type: 'boolean' } })),
  h('matricula_asignar', 'Matrícula+: toca ▶ Asignar en el capítulo Acción para ver la asignación con las reglas elegidas, ronda por ronda.',
    objeto({})),
]
