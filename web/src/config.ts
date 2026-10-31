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
  // La parte entre corchetes va resaltada en morado. Textos del documento de Paola (29-oct): sin
  // explicaciones de IA, tecnología ni modelos, y sin resultados numéricos anticipados.
  pregunta: '¿[Cuánto más] podría lograr tu entidad con los datos que ya tiene?',
  bajada: 'Descúbrelo con dos retos reales de Bogotá.',
  proli: 'Toca la pantalla. Quiero mostrarte algo.',
  tocar: 'Toca la pantalla para empezar',
  boton: 'Descubrir',
}
// Modo automático: segundos en la portada antes de pasar a conocer a Proli
export const SEGUNDOS_PORTADA_AUTO = 7

// --- Conoce a Proli (segunda pantalla) ---
// Presenta a Proli como el guía del stand. Personalidad del manual de marca (pág. 17): curioso,
// inteligente, inquieto, optimista y un poco retador; voz cercana, ingeniosa y clara.
// Los «pedidos» son acciones reales (entran a un demo); cuando Proli converse con IA, esta misma
// zona será la entrada a la conversación. No prometer aquí nada que la app todavía no haga.
export const PROLI_INTRO = {
  nombre: 'Proli',
  // Lo que Proli «escribe» en su globo, y el texto debajo (documento de Paola, 29-oct: sin más contenido)
  saludo: 'Exploremos dos retos. Al final quiero conocer el tuyo.',
  texto: 'Te voy a mostrar cómo cambian las decisiones cuando ponemos los datos a trabajar.',
  boton: 'Ver los retos',
}
/** La página propia de Proli (govtech.proliferante.com/proli): lo que escribe y dice en voz alta al saludar */
export const PROLI_PAGINA = {
  // Reunión del 31-oct: Proli no es un «asistente virtual»; es un sistema inteligente que trabaja para lograr resultados
  saludo: 'Un sistema inteligente que trabaja para lograr resultados: uno datos, modelos matemáticos, personas e inteligencia artificial. Cuéntame, ¿qué problema quieres resolver?',
  // Al llegar desde el final de un demo («Contarle mi reto a Proli»)
  despues: 'Un sistema inteligente que trabaja para lograr resultados. Ya que conoces una pequeña parte de lo que podemos crear, hablemos de tu reto: ¿qué problema quieres resolver?',
  placeholder: 'Escribe tu pregunta o tu reto…',
  // La voz: apagada hasta tener los MP3 de ElevenLabs (con `true`, Proli saluda en voz alta y aparece
  // el botón «Escuchar a Proli»). Los MP3 deben decir exactamente el texto de arriba; si no están,
  // Proli habla con la voz del navegador
  voz: false,
  audioSaludo: './voz/proli-saludo.mp3',     // «Hola, soy Proli. » + saludo
  audioDespues: './voz/proli-despues.mp3',   // «Hola, soy Proli. » + despues
}
// Modo automático: segundos con Proli antes de pasar a elegir proyecto
export const SEGUNDOS_PROLI_AUTO = 9

// --- Página de inicio (elegir proyecto) ---
// Nombre y pregunta de la sección de movilidad (se cambian aquí). Se llamaba Movilidad+: el nombre
// nuevo dice el objetivo (asignar mejor el presupuesto), no una reducción de siniestros que no se demuestra.
export const NOMBRE_MOVILIDAD = 'Presupuesto+'
export const TITULO_MOVILIDAD = '¿Cómo decidir dónde invertir primero?'
export const LEMA_MOVILIDAD = 'Mismo presupuesto. Más información. Decisiones diferentes.'

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
  cta: string             // llamado a la acción de la tarjeta
  proximamente?: boolean
}[] = [
  { id: 'educacion', area: 'Educación', nombre: APP_NAME, letra: 'M', variante: 'tinta',
    pregunta: '¿Cómo lograr que más niños estudien cerca de casa?',
    bajada: 'Los mismos colegios. Los mismos cupos.',
    cta: 'Explorar' },
  { id: 'movilidad', area: 'Presupuesto · Seguridad vial', nombre: NOMBRE_MOVILIDAD, letra: 'P', variante: 'violeta',
    pregunta: '¿Cómo decidir dónde invertir primero?',
    bajada: 'El mismo presupuesto. Una priorización diferente.',
    cta: 'Explorar' },
]

// Modo automático sin ?proyecto: segundos en la página de inicio antes de entrar al siguiente proyecto
export const SEGUNDOS_INICIO_AUTO = 6

// Matrícula+: lema de la portada y de la entrada, y localidad de ejemplo del stand (acordada el 27-oct)
export const LEMA_MATRICULA = 'Mismos colegios, mismos cupos. Solo cambia la forma de repartirlos.'
export const LOCALIDAD_EJEMPLO_MATRICULA = 'Bosa'
// Matrícula+: duración de cada paso en modo automático (segundos): ~60 s por vuelta
export const DURACION_PASOS_MATRICULA = {
  portada: 6, problema: 8, solucion: 9, antes: 11, resultados: 12, como: 7, reto: 6,
}

// Presupuesto+: duración de cada paso en modo automático (segundos): ~60 s por vuelta
export const DURACION_PASOS_MOVILIDAD = {
  portada: 6, problema: 8, solucion: 10, antes: 12, resultados: 11, como: 7, reto: 6,
}
