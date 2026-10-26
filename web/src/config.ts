/**
 * Configuración de marca, tiempos y enlaces. Todo lo que cambia entre eventos vive aquí.
 */

// Nombre de la app y del demostrador
export const APP_NAME = 'Matrícula+'
export const TITULO_SIMULADOR = '¿Cómo logramos que más niños tengan colegio cerca de casa?'
export const EMPRESA = 'Proliferante'
// Web de la empresa (footer: enlace en celular y PC; QR en el tótem, donde un enlace sacaría de la app)
export const URL_EMPRESA = 'https://proliferante.com'
export const LEMA_EMPRESA = 'Innovación aplicada a retos de crecimiento'

// --- Imágenes configurables (en web/public/) ---
// Vacío = no se pide ningún archivo (así no hay errores en consola si todavía no existe).
// QR del cierre: p. ej. './qr-cita.png'. Sin imagen se genera uno local con URL_CITA en cuanto
// hay agenda o WhatsApp configurados (más abajo); si no, se muestra un recuadro de aviso.
export const QR_IMAGEN = ''
// Logo de la empresa: p. ej. './logo-proliferante.svg'. Vacío = nombre en texto.
export const LOGO_IMAGEN = ''

// URL que codifica el QR de la app en el celular (vacía = URL actual sin parámetros)
export const URL_APP = ''

// --- Agendar una cita ---
// AGENDA_CITA: página de reservas del «Programa de citas» de Google Calendar de
// paola.a@proliferante.com (p. ej. 'https://calendar.app.google/…'). Cada reserva cae en su
// calendario con Google Meet y el visitante recibe la invitación por correo. PENDIENTE: enlace real.
export const AGENDA_CITA = ''
// WHATSAPP_CITA: número internacional, solo dígitos y sin "+" (p. ej. '573001234567'). PENDIENTE.
// Es la segunda opción: el visitante escribe y, para que su cita también quede en el calendario,
// la app le ofrece después la página de reservas (y conviene que la respuesta automática de
// WhatsApp Business de Proliferante incluya ese mismo enlace).
export const WHATSAPP_CITA = '573125888421'
/** El destino de los QR y botones de cita: primero el calendario; si no hay, WhatsApp. */
export const URL_CITA = AGENDA_CITA ||
  (WHATSAPP_CITA ? `https://wa.me/${WHATSAPP_CITA}?text=${encodeURIComponent(`Hola ${EMPRESA}, vi los demos en el GovTech Summit y quiero agendar una reunión.`)}` : '')
/** Con agenda o WhatsApp configurados, los QR de cita se generan solos (sin imagen aparte). */
export const MOSTRAR_QR_GENERADO = !!URL_CITA

/**
 * El destino de la cita con el reto que Proli resumió en la conversación. Con WhatsApp, el mensaje
 * ya lleva el reto escrito (el visitante lo envía desde su teléfono); sin reto, el destino normal.
 */
export const urlCitaCon = (reto: string) => (reto && WHATSAPP_CITA
  ? whatsappCon(`Hola ${EMPRESA}, vi los demos en el GovTech Summit y quiero agendar una reunión. Mi reto: ${reto}`)
  : URL_CITA)

/** Enlace de WhatsApp con un mensaje armado desde el formulario de cita. */
export const whatsappCon = (mensaje: string) => `https://wa.me/${WHATSAPP_CITA}?text=${encodeURIComponent(mensaje)}`

// --- Kiosco ---
export const SEGUNDOS_INACTIVIDAD = 60        // vuelve al inicio sin interacción (escribir a Proli también cuenta)
export const SEGUNDOS_REINICIO_LOGO = 3       // mantener presionado el logo para reiniciar
export const SEGUNDOS_ANIMACION_LOGO = 5.3    // el logo alterna "Matrícula+" ↔ "M+" cada N segundos

// Duración de cada capítulo en modo automático (segundos): ~67 s por vuelta.
// Problema y Acción incluyen la animación del proceso en la localidad.
export const DURACION_PASOS = { portada: 6, problema: 14, accion: 21, resultado: 12, laboratorio: 6, fuentes: 6, metodo: 8 }

// --- Portada del stand (primera pantalla, antes de elegir proyecto) ---
// Pantalla de atracción: se ve desde lejos y se toca para entrar. Voz del manual: la pregunta es
// retadora (señala el problema), Proli es cercano y el eslogan es el cierre del manual de marca.
export const PORTADA_STAND = {
  evento: 'GovTech Summit 2026 · Bogotá · 3 y 4 de noviembre',
  kicker: 'Retos públicos, resueltos con datos',
  // La parte entre corchetes va resaltada (segunda voz del titular). Titular aprobado en la reunión del 23-oct.
  pregunta: 'Mira en un minuto cómo Proliferante convierte un reto público en [una decisión que genera resultados]',
  bajada: 'Datos abiertos, modelos matemáticos y simulación, aplicados a dos retos reales de Bogotá.',
  eslogan: 'Hacemos simple lo complejo',
  acento: 'Inyectamos capacidades que multiplican posibilidades',
  proli: '¡Hola! Soy Proli. Toca la pantalla y te muestro cómo lo resolvemos.',
  tocar: 'Toca la pantalla para empezar',
  boton: 'Empezar →',
}
// Modo automático: segundos en la portada antes de pasar a conocer a Proli
export const SEGUNDOS_PORTADA_AUTO = 7

// --- Conoce a Proli (segunda pantalla) ---
// Presenta a Proli como el guía del stand. Personalidad del manual de marca (pág. 17): curioso,
// inteligente, inquieto, optimista y un poco retador; voz cercana, ingeniosa y clara.
// Los «pedidos» son acciones reales (entran a un demo); cuando Proli converse con IA, esta misma
// zona será la entrada a la conversación. No prometer aquí nada que la app todavía no haga.
export const PROLI_INTRO = {
  kicker: 'Tu guía en este recorrido',
  nombre: 'Proli',
  saludo: '¡Hola! Soy Proli, tu guía en esta visita. Te muestro cómo Proliferante resolvió dos retos reales de Bogotá, paso a paso y con las fuentes a la vista.',
  esencia: 'Siempre hay otra posibilidad por descubrir',
  ayudas: [
    { icono: 'guia', titulo: 'Te guío paso a paso', texto: 'Del problema a la decisión, en un minuto.' },
    { icono: 'cifra', titulo: 'Te explico cada cifra', texto: 'Qué significa y de dónde sale.' },
    { icono: 'equipo', titulo: 'Te conecto con el equipo', texto: 'Para hablar del reto de tu entidad.' },
  ],
  // Atajos a cada demo (vacío = no se muestran). Se quitaron en la reunión del 23-oct: sugerían que
  // Proli entiende voz o texto libre en esta pantalla y competían con el botón principal.
  pedidosTitulo: '',
  pedidos: [] as { texto: string; proyecto: IdProyecto | null }[],
  boton: 'Ver los retos →',
}
// Modo automático: segundos con Proli antes de pasar a elegir proyecto
export const SEGUNDOS_PROLI_AUTO = 9

// --- Página de inicio (elegir proyecto) ---
// Nombre y pregunta de la sección de movilidad (se cambian aquí)
export const NOMBRE_MOVILIDAD = 'Movilidad+'
export const TITULO_MOVILIDAD = 'El presupuesto no alcanza para todo. ¿Qué esquinas arreglarías primero?'
export const LEMA_MOVILIDAD = 'Las avenidas ya se vigilan. ¿Y las esquinas de tu barrio?'

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
  pregunta: string        // el reto, en una pregunta
  bajada: string          // qué vas a hacer en el demo
  gancho: string          // lo que dice Proli en la tarjeta (voz retadora: una pregunta)
  cta: string             // llamado a la acción de la tarjeta: verbo + beneficio
  proximamente?: boolean
}[] = [
  { id: 'educacion', area: 'Educación', nombre: APP_NAME, letra: 'M', variante: 'tinta',
    pregunta: '¿Cómo lograr una mejor asignación de cupos escolares?',
    bajada: 'Cambia los criterios y mira quién consigue colegio cerca de casa.',
    gancho: '¿Quién se queda por fuera? Míralo en un minuto.', cta: 'Explorar el reto →' },
  { id: 'movilidad', area: 'Seguridad vial', nombre: NOMBRE_MOVILIDAD, letra: 'M', variante: 'violeta',
    pregunta: '¿Dónde conviene invertir primero para evitar siniestros graves?',
    bajada: 'Mira cómo los datos ayudan a priorizar con un presupuesto limitado.',
    gancho: '¿Qué esquina arreglarías tú primero?', cta: 'Explorar el reto →' },
]

// Llamado a la acción del inicio (para quien decide en una entidad pública). Voz del manual:
// retadora al señalar el problema, cercana al acompañar, rigurosa al entregar.
export const LLAMADO_INICIO = {
  kicker: 'Para entidades públicas',
  titulo: '¿Tienes un reto en tu entidad?',
  texto: 'Estos demos usan solo datos abiertos. Cuéntale tu reto a Proli: te hace un par de preguntas y te ayuda a agendar con el equipo.',
  botonProli: 'Cuéntale tu reto a Proli →',
  boton: 'O agenda directamente una reunión',
}

// Modo automático sin ?proyecto: segundos en la página de inicio antes de entrar al siguiente proyecto
export const SEGUNDOS_INICIO_AUTO = 6

// Movilidad+: duración de cada capítulo en modo automático (segundos): ~60 s por vuelta
export const DURACION_PASOS_MOVILIDAD = { portada: 5, decide: 10, anio: 9, giro: 6, metodo: 9, presupuesto: 11, evaluar: 10, fuentes: 5, cierre: 5 }
// Movilidad+: esquinas que toca el visitante en "Tú decides"
export const ESQUINAS_A_TOCAR = 3
