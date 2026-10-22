/**
 * Configuración de marca, tiempos y enlaces. Todo lo que cambia entre eventos vive aquí.
 */

// Nombre de la app y del demostrador
export const APP_NAME = 'Matrícula+'
export const TITULO_SIMULADOR = '¿Dónde cabe cada niño?'
export const EMPRESA = 'Proliferante'
// Web de la empresa (footer: enlace en celular y PC; QR en el tótem, donde un enlace sacaría de la app)
export const URL_EMPRESA = 'https://proliferante.com'
export const LEMA_EMPRESA = 'Innovación aplicada a retos de crecimiento'

// --- Imágenes configurables (en web/public/) ---
// Vacío = no se pide ningún archivo (así no hay errores en consola si todavía no existe).
// QR del cierre: p. ej. './qr-cita.png'. Sin imagen se genera uno local con URL_CITA si
// MOSTRAR_QR_GENERADO es true; si no, se muestra un recuadro de aviso.
export const QR_IMAGEN = ''
export const MOSTRAR_QR_GENERADO = false
// Logo de la empresa: p. ej. './logo-proliferante.svg'. Vacío = nombre en texto.
export const LOGO_IMAGEN = ''

// URL que codifica el QR de la app en el celular (vacía = URL actual sin parámetros)
export const URL_APP = ''

// Agendar una cita. WHATSAPP: número internacional sin "+" (PENDIENTE: número real).
export const WHATSAPP_CITA = '570000000000'
export const CALENDLY_CITA = ''
export const URL_CITA = CALENDLY_CITA ||
  `https://wa.me/${WHATSAPP_CITA}?text=${encodeURIComponent(`Hola ${EMPRESA}, quiero agendar una cita sobre ${APP_NAME}.`)}`

/** Enlace de WhatsApp con un mensaje armado desde el formulario de cita. */
export const whatsappCon = (mensaje: string) => `https://wa.me/${WHATSAPP_CITA}?text=${encodeURIComponent(mensaje)}`

// --- Kiosco ---
export const SEGUNDOS_INACTIVIDAD = 30        // vuelve al inicio sin interacción
export const SEGUNDOS_REINICIO_LOGO = 3       // mantener presionado el logo para reiniciar
export const SEGUNDOS_ANIMACION_LOGO = 5.3    // el logo alterna "Matrícula+" ↔ "M+" cada N segundos

// Duración de cada capítulo en modo automático (segundos): ~67 s por vuelta.
// Problema y Acción incluyen la animación del proceso en la localidad.
export const DURACION_PASOS = { portada: 6, problema: 14, accion: 21, resultado: 12, laboratorio: 6, metodo: 8 }

// --- Portada del stand (primera pantalla, antes de elegir proyecto) ---
// Pantalla de atracción: se ve desde lejos y se toca para entrar. Voz del manual: la pregunta es
// retadora (señala el problema), Proli es cercano y el eslogan es el cierre del manual de marca.
export const PORTADA_STAND = {
  evento: 'GovTech Summit 2026 · Bogotá · 3 y 4 de noviembre',
  kicker: 'Decisiones públicas con datos abiertos',
  // La parte entre corchetes va resaltada (segunda voz del titular)
  pregunta: '¿Y si los datos de su entidad [ya tuvieran la respuesta]?',
  bajada: 'Dos decisiones reales de Bogotá, resueltas con datos abiertos en un minuto: dónde cabe cada niño y qué esquina conviene arreglar primero.',
  eslogan: 'Hacemos simple lo complejo',
  acento: 'Inyectamos capacidades que multiplican posibilidades',
  proli: '¡Hola! Soy Proli. Toque la pantalla y se lo muestro.',
  tocar: 'Toque la pantalla para empezar',
  boton: 'Empezar →',
}
// Modo automático: segundos en la portada antes de pasar a conocer a Proli
export const SEGUNDOS_PORTADA_AUTO = 7

// --- Conozca a Proli (segunda pantalla) ---
// Presenta a Proli como el guía del stand. Personalidad del manual de marca (pág. 17): curioso,
// inteligente, inquieto, optimista y un poco retador; voz cercana, ingeniosa y clara.
// Los «pedidos» son acciones reales (entran a un demo); cuando Proli converse con IA, esta misma
// zona será la entrada a la conversación. No prometer aquí nada que la app todavía no haga.
export const PROLI_INTRO = {
  kicker: 'Su guía en este stand',
  nombre: 'Proli',
  saludo: '¡Hola! Soy Proli, el curioso de Proliferante. Hoy le muestro dos retos reales de Bogotá y lo acompaño en cada paso.',
  esencia: 'Siempre hay otra posibilidad por descubrir',
  ayudas: [
    { icono: 'guia', titulo: 'Lo guío paso a paso', texto: 'Del problema a la decisión, en un minuto.' },
    { icono: 'cifra', titulo: 'Le explico cada cifra', texto: 'Qué significa y de dónde sale.' },
    { icono: 'equipo', titulo: 'Lo conecto con el equipo', texto: 'Para verlo con los datos de su entidad.' },
  ],
  pedidosTitulo: 'Pídamelo así',
  // Uno por demo; «ver los dos» es el botón principal de la pantalla
  pedidos: [
    { texto: '«Muéstreme dónde faltan cupos»', proyecto: 'educacion' },
    { texto: '«¿Qué esquina arreglo primero?»', proyecto: 'movilidad' },
  ] as { texto: string; proyecto: IdProyecto | null }[],
  boton: 'Ver los demos →',
}
// Modo automático: segundos con Proli antes de pasar a elegir proyecto
export const SEGUNDOS_PROLI_AUTO = 9

// --- Página de inicio (elegir proyecto) ---
// Nombre y pregunta de la sección de movilidad (se cambian aquí)
export const NOMBRE_MOVILIDAD = 'Movilidad+'
export const TITULO_MOVILIDAD = 'Con este presupuesto, ¿dónde se evitan más siniestros graves?'
export const LEMA_MOVILIDAD = 'Las avenidas ya se vigilan. ¿Y las esquinas de su barrio?'

export type IdProyecto = 'educacion' | 'movilidad'
/**
 * Proyectos de la página de inicio, en orden. Para sumar un tercero: agregar su id a IdProyecto,
 * una entrada aquí y su componente en Inicio.tsx. Con `proximamente` se muestra como tarjeta
 * discreta, sin entrar.
 */
export const PROYECTOS: {
  id: IdProyecto
  area: string            // tema del proyecto (kicker de la tarjeta)
  nombre: string          // marca (termina en "+" → cruz violeta)
  letra: string           // letra del icono
  variante: 'tinta' | 'violeta'
  pregunta: string
  bajada: string
  gancho: string          // lo que dice Proli en la tarjeta (voz retadora: una pregunta)
  cta: string             // llamado a la acción de la tarjeta: verbo + beneficio
  proximamente?: boolean
}[] = [
  { id: 'educacion', area: 'Educación', nombre: APP_NAME, letra: 'M', variante: 'tinta', pregunta: TITULO_SIMULADOR,
    bajada: 'Cupos en colegios oficiales de Bogotá: cómo repartirlos mejor.',
    gancho: '¿Quién se queda sin cupo? Véalo en un minuto.', cta: 'Simular la asignación →' },
  { id: 'movilidad', area: 'Movilidad', nombre: NOMBRE_MOVILIDAD, letra: 'M', variante: 'violeta', pregunta: TITULO_MOVILIDAD,
    bajada: LEMA_MOVILIDAD,
    gancho: '¿Qué esquina arreglaría usted primero?', cta: 'Decidir dónde invertir →' },
]

// Llamado a la acción del inicio (para quien decide en una entidad pública). Voz del manual:
// retadora al señalar el problema, cercana al acompañar, rigurosa al entregar.
export const LLAMADO_INICIO = {
  kicker: 'Para entidades públicas',
  titulo: '¿Su entidad decide con datos o por costumbre?',
  texto: 'Estas demostraciones usan solo datos abiertos. Le mostramos cómo se verían con los datos y las reglas de su entidad.',
  boton: 'Agendar una conversación →',
}

// Modo automático sin ?proyecto: segundos en la página de inicio antes de entrar al siguiente proyecto
export const SEGUNDOS_INICIO_AUTO = 6

// Movilidad+: duración de cada capítulo en modo automático (segundos): ~60 s por vuelta
export const DURACION_PASOS_MOVILIDAD = { portada: 5, decide: 10, anio: 9, giro: 6, metodo: 9, presupuesto: 11, fuentes: 5, cierre: 5 }
// Movilidad+: esquinas que toca el visitante en "Usted decide"
export const ESQUINAS_A_TOCAR = 3
