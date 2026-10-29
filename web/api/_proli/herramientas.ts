/**
 * Herramientas de Proli: acciones sobre la interfaz que ejecuta el NAVEGADOR (src/proli/ordenes.ts),
 * no el servidor. Por eso solo mueven pantallas y controles del demo; ninguna envía datos ni escribe
 * nada. Los valores son listas cerradas (enum) y `strict` garantiza entradas válidas.
 *
 * Los nombres y valores deben coincidir con los que entiende src/proli/ordenes.ts.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { LOCALIDADES_MATRICULA } from './conocimiento.js'

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
  h('movilidad_capitulo', 'Presupuesto+ (antes Movilidad+): va a un paso. problema = 3.285 lugares para intervenir, recursos para 166; solucion = mirar un solo período oculta patrones (las 46 zonas que salen y las 46 que entran, en 2023 y 2024); antes = Antes y después (con el mismo presupuesto cambian 46 decisiones); resultados = qué pasó en 2025 en cada selección (análisis retrospectivo); como = Cómo lo hicimos; metodologia = abre la metodología (fuentes, supuestos y limitaciones); reto = Tu reto (Proli y agenda).',
    objeto({ capitulo: { type: 'string', enum: ['portada', 'problema', 'solucion', 'antes', 'resultados', 'como', 'metodologia', 'reto'] } })),
  h('movilidad_lista', 'Presupuesto+: en Antes y después, muestra en el mapa la selección basada en 2024 (contar) o qué cambia con Presupuesto+ (modelo).',
    objeto({ lista: { type: 'string', enum: ['contar', 'modelo'] } })),

  // --- Matrícula+ (abre el demo si no está abierto) ---
  h('matricula_capitulo', 'Matrícula+: va a una pantalla. problema = El problema; solucion = La solución; prioridad = ¿Quién es quién? (grupos con prioridad y por qué); antes = Antes y después; localidad = Mira tu localidad; resultados; faltan = ¿Dónde faltan cupos? (por nivel); como = Cómo se hizo; fuentes; reto = Tu reto (QR para agendar).',
    objeto({ capitulo: { type: 'string', enum: ['portada', 'problema', 'solucion', 'prioridad', 'antes', 'localidad', 'resultados', 'faltan', 'como', 'fuentes', 'reto'] } })),
  h('matricula_localidad', 'Matrícula+: muestra en «Mira tu localidad» cuántos niños quedan lejos hoy y con Matrícula+ en esa localidad, y qué nivel le falta (TODA_BOGOTA suelta la localidad).',
    objeto({ localidad: { type: 'string', enum: [...LOCALIDADES_MATRICULA, 'TODA_BOGOTA'] } })),
  h('matricula_reparto', 'Matrícula+: en Antes y después, muestra en el mapa los niños lejos con el reparto de hoy (orden de llegada) o con Matrícula+.',
    objeto({ reparto: { type: 'string', enum: ['hoy', 'despues'] } })),
  h('matricula_nivel', 'Matrícula+: en ¿Dónde faltan cupos?, colorea el mapa con los niños de un nivel que siguen lejos (TODOS = todos los niveles).',
    objeto({ nivel: { type: 'string', enum: ['TODOS', 'Preescolar', 'Primaria', 'Secundaria', 'Media'] } })),
]
