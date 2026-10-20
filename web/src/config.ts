/**
 * Configuración de marca, tiempos y enlaces. Todo lo que cambia entre eventos vive aquí.
 */

// Nombre de la app y del demostrador
export const APP_NAME = 'Matrícula+'
export const TITULO_SIMULADOR = '¿Dónde cabe cada niño?'
export const EMPRESA = 'Proliferante'

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
export const MINUTOS_ANIMACION_LOGO = 5       // cada cuánto el logo pasa a "M+" y vuelve

// Duración de cada capítulo en modo automático (segundos): ~67 s por vuelta.
// Problema y Acción incluyen la animación del proceso en la localidad.
export const DURACION_PASOS = { portada: 6, problema: 14, accion: 21, resultado: 12, laboratorio: 6, metodo: 8 }
