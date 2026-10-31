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
  h('abrir_agenda', 'Abre el formulario para agendar 20 minutos con el equipo de Proliferante (pantalla de Proli). El visitante deja ahí sus datos y elige cuándo le queda mejor; el equipo le confirma el horario por correo. No confirma ninguna cita.',
    objeto({ demo: { type: 'string', enum: ['matricula', 'movilidad'] } })),
  h('agendar_con_reto', 'Cuando el visitante tiene un reto o una meta y quiere contarla: lo lleva a la conversación de Proli, donde cuenta su meta en pocas preguntas, recibe un resumen con una hipótesis por validar y puede agendar 20 minutos. No escribas datos personales en resumen.',
    objeto({ demo: { type: 'string', enum: ['matricula', 'movilidad'] }, resumen: { type: 'string' } })),

  h('borrar_reto', 'Cuando el visitante retira su permiso, pide que no lo contacten o que borres sus datos: quita su nombre, su entidad y su reto del mensaje de WhatsApp y del código QR (vuelven al mensaje genérico). Úsala de inmediato, sin insistir.',
    objeto({})),

  // --- Movilidad+ (abre el demo si no está abierto) ---
  h('movilidad_capitulo', 'Presupuesto+ (antes Movilidad+): va a un paso. problema = con un presupuesto limitado, la pregunta es dónde invertir primero (mapa de la selección basada en 2024); solucion = la pregunta «¿y si las esquinas más peligrosas no fueran simplemente las que tuvieron más accidentes el último año?» y su respuesta: Presupuesto+ analiza los registros históricos y compara lugares con comportamientos similares para estimar su riesgo; antes = Antes y después (con el mismo presupuesto cambian 46 decisiones); resultados = qué pasó en 2025 en cada selección (análisis retrospectivo); como = Cómo lo hicimos; metodologia = abre la metodología (fuentes, supuestos y limitaciones); reto = Tu reto (Proli y agenda).',
    objeto({ capitulo: { type: 'string', enum: ['portada', 'problema', 'solucion', 'antes', 'resultados', 'como', 'metodologia', 'reto'] } })),
  h('movilidad_lista', 'Presupuesto+: en Antes y después, muestra en el mapa la selección basada en 2024 (contar) o qué cambia con Presupuesto+ (modelo).',
    objeto({ lista: { type: 'string', enum: ['contar', 'modelo'] } })),

  // --- Matrícula+ (abre el demo si no está abierto) ---
  h('matricula_capitulo', 'Matrícula+: va a un paso o abre un detalle. problema = El problema (estudiantes lejos en el escenario de referencia); solucion = La solución (cómo los datos se convierten en una asignación); antes = La gran revelación (escenario de referencia frente a Matrícula+); resultados = La segunda revelación (grupos prioritarios, hermanos y dónde faltan cupos); como = Cómo lo hicimos; reto = Tu reto (Proli y agenda). Detalles: escenario = cómo se definió el escenario de referencia; criterios = criterios del modelo (prioridades y por qué); datos = tabla por localidad y nivel; metodologia = fuentes, supuestos y limitaciones.',
    objeto({ capitulo: { type: 'string', enum: ['portada', 'problema', 'solucion', 'antes', 'resultados', 'como', 'reto', 'escenario', 'criterios', 'datos', 'metodologia'] } })),
  h('matricula_localidad', 'Matrícula+: en La segunda revelación, acerca el mapa a una localidad y muestra cuántos estudiantes quedan lejos en el escenario de referencia y con Matrícula+, y qué nivel le falta (TODA_BOGOTA suelta la localidad).',
    objeto({ localidad: { type: 'string', enum: [...LOCALIDADES_MATRICULA, 'TODA_BOGOTA'] } })),
  h('matricula_reparto', 'Matrícula+: en La gran revelación, muestra en el mapa los estudiantes lejos en el escenario de referencia (hoy = orden de llegada simulado) o con Matrícula+ (despues).',
    objeto({ reparto: { type: 'string', enum: ['hoy', 'despues'] } })),
]
