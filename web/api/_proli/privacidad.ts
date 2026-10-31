/**
 * Aviso de privacidad de Proliferante (Playbook GovTech 2026: Proli solo pide permiso de contacto con el
 * aviso aprobado a la vista). Se lee dentro de la página, en un modal (src/componentes/AvisoPrivacidad.tsx):
 * en el tótem no se puede salir a otro sitio. BORRADOR: el texto lo aprueba Paola.
 *
 * Lo usan las instrucciones de Proli (la regla la arma api/proli.ts) y el código QR de la cita
 * (src/componentes/QrCita.tsx): cambiarlo aquí basta para los dos. Sin imports: lo leen las pruebas en Node.
 * Siempre de «tú», como Proli (lo revisa pruebas/proli-tono.test.ts).
 */
export const AVISO_PRIVACIDAD: { titulo: string; texto: string }[] = [
  { titulo: 'Quién cuida tus datos',
    texto: 'Proliferante es responsable de los datos que decidas compartir en este stand, según la Ley 1581 de 2012 de protección de datos personales.' },
  { titulo: 'Qué datos',
    texto: 'Solo los que tú escribes o autorizas: tu nombre, tu entidad o cargo, tu reto y el canal por el que prefieres que te contactemos. Nunca pedimos cédula, contraseñas, datos de salud, de menores ni de otras personas.' },
  { titulo: 'Para qué',
    texto: 'Para coordinar contigo una conversación sobre tu reto y enviarte solo información relacionada. No vendemos ni compartimos tus datos con terceros.' },
  { titulo: 'Tu conversación con Proli',
    texto: 'Proli usa un servicio de inteligencia artificial para responderte. No guardamos la conversación: se borra al reiniciar o al cerrar la pantalla. Tus datos solo llegan al equipo si tú envías el mensaje de WhatsApp o escaneas el código.' },
  { titulo: 'Tus derechos',
    texto: 'Puedes conocer, actualizar, corregir o pedir que borremos tus datos, y retirar tu permiso cuando quieras. Díselo a Proli o escríbenos a hello@proliferante.com.' },
]
