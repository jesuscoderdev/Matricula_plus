# Pendientes — Matrícula+

Estado al 20-10-2026: las 4 etapas están listas y probadas en Chrome (celular 390×844, tótem
1080×1920, modo auto y modo offline con el servidor apagado). La app web tiene cargados los
**datos reales**. Evento: 3 y 4 de noviembre.

## 1. Necesito de ustedes (bloquea el evento)

- [ ] **Decidir con qué datos se presenta.** Hoy la app muestra datos reales; los resultados y
      hallazgos están en el README, sección "Datos reales". Para cambiar:
      `python pipeline/run.py --fuente real` o `--fuente sintetica`, y después `cd web && npm run build`.
      ⚠️ `python pipeline/run.py` sin flag usa **sintéticos** y sobrescribe lo que muestra la app.
      Cambios de narrativa con datos reales:
      - La localidad foco pasa a ser **Suba** (−4.838 cupos). Bosa, Kennedy y Engativá tienen superávit a nivel de localidad.
      - Hay pocos niños sin cupo (724 de 776.068), porque la demanda pública está registrada donde se pide el cupo y no donde vive el niño.
- [ ] **Número de WhatsApp o enlace de Calendly** para "Agendar cita": `WHATSAPP_CITA` / `CALENDLY_CITA`
      en `web/src/config.ts`. Ahora hay un número de prueba (`570000000000`).
- [ ] **Logo de Proliferante** en SVG: `web/public/logo-proliferante.svg`. Mientras no esté, se muestra el nombre en texto.
- [ ] **Color de marca:** `--acento` en `web/src/estilos.css` (ahora azul `#60a5fa`) y `COLORES.acento` en `config.ts`.
- [ ] **URL pública + QR:** cuando haya hosting (con HTTPS, para que la PWA funcione offline en los celulares), poner
      `URL_APP` y `MOSTRAR_QR = true` en `web/src/config.ts`. El QR se genera localmente.
- [ ] **Hardware del tótem:** ¿Windows o Android? ¿Resolución exacta? Según la respuesta:
      - Windows: probar `totem\lanzar-totem.bat` (no se ha ejecutado; abre Chrome en kiosco) y configurar la pantalla en vertical sin suspensión.
      - Android: elegir entre servir desde un portátil en la red local o desde una URL con HTTPS. Instrucciones en el README, sección "Tótem".

## 2. Recomendado antes del evento

- [ ] **Probar en el tótem real:** que el táctil responda, que la animación de las líneas vaya fluida y que
      el texto se lea a 1–2 m con la luz del recinto.
- [ ] **Encuadre del mapa** en localidades de forma irregular (Suba queda pequeña, con mucho espacio
      vacío) y mapa de la ciudad más grande en el modo espera. Es ajuste de `margenArriba`/`margenAbajo` en `App.tsx`.
- [ ] **Revisar los textos** con alguien de comunicaciones: frases del modo espera, nota final de la
      escena Matrícula+, tarjetas de "¿Cómo lo hicimos?".
- [ ] **Probar la instalación PWA** en iPhone (Safari) y Android (Chrome) con la URL pública.
- [ ] **Crear el repositorio git.** La carpeta todavía no es un repositorio.

## 3. Mejoras del modelo (después del evento o si hay tiempo)

- [ ] **Demanda por lugar de residencia.** Es la limitación más grande con datos reales: hoy la demanda se
      ubica en el colegio solicitado, lo que subestima el desajuste territorial. Pedir a la SED la demanda por UPZ de residencia.
- [ ] **Calidad real:** reemplazar el puntaje simulado por el Saber 11 del ICFES (datos abiertos, por código DANE).
- [ ] **Tiempos de viaje reales** con la red vial o SITP, en lugar de distancia × 1,35.
- [ ] **Simular por nivel** (preescolar, primaria, secundaria, media) en vez del total agregado.
- [ ] **Límites oficiales de UPZ:** el dataset del portal tiene acceso restringido y hoy se usan los polígonos
      del dataset de aprobación escolar de la SED. Conviene confirmar que coinciden con los oficiales.
- [ ] **Validar los parámetros del cupo garantizado** con la SED: costo por posición en la lista (8 min),
      fuera de lista (45 min), penalización de viajes > 40 min (×6) y radio (8 km). Están en `pipeline/config.py`.
- [ ] **Escenario de política adicional:** abrir N cupos en las UPZ con déficit, o ruta escolar, para
      mostrar "dónde invertir".

## 4. Detalles técnicos menores

- `web/public/_previa-stand.html` es una herramienta de desarrollo y también se publica con el build. Es
  inofensiva, pero se puede quitar del build final.
- Si se cambian los JSON con la app ya instalada, la PWA se actualiza sola en la siguiente visita
  (`registerType: autoUpdate`). En el tótem conviene recargar una vez después de cada build.
