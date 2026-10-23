# Pendientes — Matrícula+ · ¿Dónde cabe cada niño?

Estado al 23-10-2026: además de lo de abajo, identidad del manual de marca, Proli asistente (IA, guía paso a paso y
cursor), optimización de cupos en Matrícula+ (sin separar hermanos) y colegio nuevo según la localidad.

Estado al 20-10-2026: las fases 0 a 4 del brief están hechas y la interfaz se rediseñó por completo (diseño "atlas",
reubicación como la SED, Equilibrada por defecto, zona crítica SED, 3–5 opciones, supuestos editables, simula una
familia, fichas de familia y colegio, modo presentación). Evento: 3 y 4 de noviembre.

## 1. Necesito de ustedes (bloquea el evento)
- [ ] **Enlace de reservas de Google Calendar** (Programa de citas de paola.a@proliferante.com): va en `AGENDA_CITA`
      (`web/src/config.ts`). Mientras esté vacío, los QR y botones de cita llevan a WhatsApp. Después, regenera
      `demo-offline.html` con `cd web && npm run build:archivo`.
- [ ] **Confirmar el número de WhatsApp** de Proliferante: hoy `WHATSAPP_CITA = '573125888421'`. El QR se genera
      solo desde `URL_CITA`; `QR_IMAGEN` solo hace falta si se quiere una imagen propia.
- [x] **Marca Proliferante:** Proli y el logo oficial (`web/src/assets/`) en la portada, el método y Agendar.
- [ ] **Hardware del tótem:** ¿Windows o Android? ¿Táctil? ¿Resolución exacta? Probar `totem\lanzar-totem.bat`
      en el equipo real. No se ha ejecutado completo porque abre Chrome en kiosco; sí se probó la URL que arma.

## 2. Verificar antes del evento
- [ ] **Prueba de 2 horas** en el equipo real: `?modo=auto` sin internet, revisando que no haya errores en
      consola (F12) y que la memoria no crezca. En el desarrollo se hizo una prueba más corta.
- [ ] Que el táctil responda, que el mapa vaya fluido y que el texto se lea a 1–2 m con la luz del recinto.
- [ ] Probar el reinicio oculto (mantener presionado el logo 3 s) en la pantalla táctil real.
- [ ] Revisar los textos con comunicaciones: portada, títulos de los capítulos, frases de lectura y etiquetas de los presets.
- [ ] En el tótem el relato tiene scroll en Acción y Resultado: decidir si se aceptan o se recortan textos tras verlo en la pantalla real.

### Procedimiento de la prueba de 2 horas
1. `totem\lanzar-totem.bat auto`, o abrir `web/demo-offline.html?modo=auto` en Chrome, con el wifi apagado.
2. Abrir la consola (F12) y dejarla en "Errores".
3. A las 2 h: sin errores rojos y la app sigue recorriendo los pasos. La memoria (Administrador de tareas de
   Chrome) debe mantenerse estable, sin crecer de forma sostenida.

## 3. Mejoras posibles (si hay tiempo o después del evento)
- [ ] **Varios colegios nuevos** a la vez (hoy uno; los cupos ya son editables en Supuestos).
- [ ] **Saber 11 real** por sede (ICFES) para que las preferencias consideren calidad.
- [ ] **Tiempos de viaje** con la red vial o el SITP, en lugar de la distancia en línea recta.
- [ ] **Simular por nivel** (preescolar, primaria, secundaria, media).
- [ ] **Jornada única** solo en las sedes que aún no la tienen (el dataset de matrícula en jornada única lo permite).
- [ ] **Reubicación en Python** para validarla también contra el motor de referencia (hoy solo la fase 1).

## 4. Notas técnicas
- `python -m engine.build_scenarios` regenera `scenarios/` y `web/public/simulador/`. Después hay que correr
  `npm run build` (servidor/PWA) y `npm run build:archivo` (doble clic).
- Con la app instalada como PWA, los cambios llegan en la siguiente visita (`autoUpdate`). En el tótem
  conviene recargar una vez después de cada build.
- `web/public/_previa-stand.html` es una herramienta de desarrollo y se publica con el build. Es inofensiva.
- En la consola aparecen mensajes **DEBUG** de luma.gl ("uniform block reflection failed…"). Son informativos
  de la librería del mapa, no errores.
- [ ] Validar en Python la optimización de cupos y la reubicación optimizada (hoy solo las verifica `npm run verificar`).
