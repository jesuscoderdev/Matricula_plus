/**
 * Textos literales de Proli (especificación de Paola V9–V12, secciones 2 y 3). Los pone el servidor o el
 * navegador, no el modelo. Archivo aparte y sin imports: lo usan el sitio (sin cargar el prompt), el
 * servidor y las pruebas.
 */
export const LITERAL = {
  apertura: '¡Hola! 👋 Soy Proli. ¡Qué gusto conocerte! ¿De qué entidad u organización vienes?',
  organizacion: '¿De qué entidad u organización vienes?',
  rol: '¡Qué bien! ¿Y qué haces allí?',
  meta: '¿Qué te gustaría lograr desde tu área? Piensa en algo que te haga decir: «¡Fui parte de esto y lo logramos!».',
  queEsProli: 'Un Proli es un sistema inteligente que resuelve problemas empresariales conectando datos, procesos, personas, IA y modelos matemáticos, con el único objetivo de mover los indicadores propuestos.',
  invitacion: '¿Lo exploramos en una conversación de 20 minutos?',
  agenda: '¡Claro! Déjame tus datos y elegimos un horario para conversar 20 minutos con el equipo.',
  salir: '¡Gracias por conversar conmigo! Si en algún momento quieres retomarlo, aquí estaremos.',
  sinObjetivo: 'No hace falta tenerlo claro ahora. Si quieres, lo exploramos con calma en una conversación de 20 minutos con el equipo, o puedes ver los demos.',
  cierreInvalido: 'Por ahora lo dejamos aquí. Puedes empezar de nuevo o explorar los demos.',
  limite: 'Gracias por todo lo que me contaste. Para seguir, lo mejor es una conversación de 20 minutos con el equipo, o puedes ver los demos.',
  capacidad: 'En Proliferante podemos ayudarte a abordar este reto partiendo de tu objetivo, entendiendo cómo funciona el sistema completo y conectando lo necesario para construir una solución que mueva el indicador que definamos juntos.',
  // Aclaraciones (V12, 2.2.2): una por etapa; no cuentan como pregunta de descubrimiento
  aclarar: {
    ESPERA_ORGANIZACION: 'Creo que no alcancé a entenderte 😊. ¿Me dices de qué organización vienes?',
    ESPERA_ROL: 'Creo que no alcancé a entenderte 😊. ¿Me cuentas qué haces en tu organización?',
    ESPERA_OBJETIVO: 'Creo que no alcancé a entenderte 😊. ¿Qué te gustaría lograr desde tu área?',
  } as Record<string, string>,
  confirmarNombre: (candidato: string) => `¿«${candidato}» es el nombre de tu organización? Si es así, responde «sí»; si no, escríbelo de nuevo.`,
}
