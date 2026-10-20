/**
 * Configuración de marca y enlaces. Todo lo que cambia entre eventos vive aquí.
 */

// Nombre de la app (se muestra en toda la interfaz)
export const APP_NAME = 'Matrícula+'

// Empresa que presenta la demo
export const EMPRESA = 'Proliferante'

// QR en el cierre (app en el celular + agendar cita). Apagado hasta tener la URL pública.
export const MOSTRAR_QR = false

// URL que codifica el QR de la app. Si queda vacía, se usa la URL actual sin parámetros.
export const URL_APP = ''

// Agendar una cita. WHATSAPP: número en formato internacional sin "+" (PENDIENTE: número real).
// Si CALENDLY tiene un enlace, el botón lo abre en vez del formulario de WhatsApp.
export const WHATSAPP_CITA = '570000000000'
export const CALENDLY_CITA = ''
export const URL_CITA = CALENDLY_CITA ||
  `https://wa.me/${WHATSAPP_CITA}?text=${encodeURIComponent(`Hola ${EMPRESA}, quiero agendar una cita sobre ${APP_NAME}.`)}`

/** Enlace de WhatsApp con un mensaje armado desde el formulario de cita. */
export const whatsappCon = (mensaje: string) => `https://wa.me/${WHATSAPP_CITA}?text=${encodeURIComponent(mensaje)}`

// Segundos sin interacción antes de volver al modo espera (stand)
export const SEGUNDOS_INACTIVIDAD = 20

// Colores del mapa en RGB (deck.gl necesita arreglos). Mantener en sintonía con estilos.css
export const COLORES = {
  deficit: [255, 99, 99] as [number, number, number],
  superavit: [46, 204, 138] as [number, number, number],
  equilibrio: [92, 104, 125] as [number, number, number],
  acento: [96, 165, 250] as [number, number, number],
  colegio: [255, 255, 255] as [number, number, number],
  borde: [11, 15, 23] as [number, number, number],
}
