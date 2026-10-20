# Pendientes — Matrícula+ · ¿Dónde cabe cada niño?

Estado al 20-10-2026: las fases 0 a 4 del brief están hechas (validación de datos, motor + tests,
precálculo de 324 escenarios, interfaz de 5 pasos y kiosco). Evento: 3 y 4 de noviembre.

## 1. Necesito de ustedes (bloquea el evento)
- [ ] **Imagen del QR** para agendar cita: ponla en `web/public/` (p. ej. `qr-cita.png`) y su ruta en `QR_IMAGEN`
      (`web/src/config.ts`). Mientras no esté, el paso 5 muestra un recuadro "QR" de aviso. Después de agregarla, regenera
      `demo-offline.html` con `cd web && npm run build:archivo`.
- [ ] **Número de WhatsApp o enlace de Calendly** para el botón "Agendar" del celular: `WHATSAPP_CITA` /
      `CALENDLY_CITA` en `web/src/config.ts`. Ahora hay un número de prueba (`570000000000`).
- [x] **Marca Proliferante:** se usa a **Proli** (`web/src/assets/proli.webp`, tomado de
      `Proliferante_web/.../public/assets/brand/`) en la espera, el paso 5 y Agendar cita.
      El logo oficial (`logo.webp`, wordmark morado) también está en esa carpeta, por si se quiere agregar.
- [ ] **Hardware del tótem:** ¿Windows o Android? ¿Táctil? ¿Resolución exacta? Probar `totem\lanzar-totem.bat`
      en el equipo real. No se ha ejecutado completo porque abre Chrome en kiosco; sí se probó la URL que arma.

## 2. Verificar antes del evento
- [ ] **Prueba de 2 horas** en el equipo real: `?modo=auto` sin internet, revisando que no haya errores en
      consola (F12) y que la memoria no crezca. En el desarrollo se hizo una prueba más corta.
- [ ] Que el táctil responda, que el mapa vaya fluido y que el texto se lea a 1–2 m con la luz del recinto.
- [ ] Probar el reinicio oculto (mantener presionado el logo 3 s) en la pantalla táctil real.
- [ ] Revisar los textos con comunicaciones: frases de la espera, títulos de los pasos y etiquetas de los presets.

### Procedimiento de la prueba de 2 horas
1. `totem\lanzar-totem.bat auto`, o abrir `web/demo-offline.html?modo=auto` en Chrome, con el wifi apagado.
2. Abrir la consola (F12) y dejarla en "Errores".
3. A las 2 h: sin errores rojos y la app sigue recorriendo los pasos. La memoria (Administrador de tareas de
   Chrome) debe mantenerse estable, sin crecer de forma sostenida.

## 3. Mejoras posibles (si hay tiempo o después del evento)
- [ ] **Colegio nuevo más visible:** hoy +1.200 cupos frente a unos 37.000 niños sin cupo mueve poco. Se podrían
      simular varios colegios o más cupos (`cupos_colegio_nuevo` en `engine/simulador/config.py`).
- [ ] **Saber 11 real** por sede (ICFES) para que las preferencias consideren calidad.
- [ ] **Tiempos de viaje** con la red vial o el SITP, en lugar de la distancia en línea recta.
- [ ] **Simular por nivel** (preescolar, primaria, secundaria, media).
- [ ] **Jornada única** solo en las sedes que aún no la tienen (el dataset de matrícula en jornada única lo permite).
- [ ] **Modo detallado** con los 27 niveles de pesos (ya están precalculados en `scenarios/`).

## 4. Notas técnicas
- `python -m engine.build_scenarios` regenera `scenarios/` y `web/public/simulador/`. Después hay que correr
  `npm run build` (servidor/PWA) y `npm run build:archivo` (doble clic).
- Con la app instalada como PWA, los cambios llegan en la siguiente visita (`autoUpdate`). En el tótem
  conviene recargar una vez después de cada build.
- `web/public/_previa-stand.html` es una herramienta de desarrollo y se publica con el build. Es inofensiva.
- En la consola aparecen mensajes **DEBUG** de luma.gl ("uniform block reflection failed…"). Son informativos
  de la librería del mapa, no errores.
