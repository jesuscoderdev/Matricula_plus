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

// Duración de cada paso del flujo guiado en modo automático (segundos): ~55 s por vuelta
export const DURACION_PASOS = { problema: 10, accion: 15, resultado: 15, supuestos: 5, metodo: 10 }

// --- Colores (en sintonía con estilos.css). Accesibles: azul / naranja, nunca solo color ---
export const COLORES = {
  azulOscuro: [20, 33, 61] as [number, number, number],      // #14213D
  fondo: [246, 244, 238] as [number, number, number],        // #F6F4EE
  naranja: [180, 86, 26] as [number, number, number],        // #B4561A
  naranjaClaro: [232, 137, 61] as [number, number, number],  // #E8893D
  azul: [47, 111, 181] as [number, number, number],          // #2F6FB5
}

/** Escala secuencial de % sin cupo (claro → naranja oscuro), con sus cortes para la leyenda. */
export const ESCALA_SIN_CUPO: { hasta: number; color: [number, number, number]; etiqueta: string }[] = [
  { hasta: 10, color: [244, 236, 222], etiqueta: '< 10%' },
  { hasta: 20, color: [240, 202, 160], etiqueta: '10–20%' },
  { hasta: 30, color: [232, 160, 98], etiqueta: '20–30%' },
  { hasta: 40, color: [205, 113, 52], etiqueta: '30–40%' },
  { hasta: 101, color: [150, 66, 18], etiqueta: '≥ 40%' },
]
