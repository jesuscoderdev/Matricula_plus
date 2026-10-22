# Estrategia de llamados a la acción — Matrícula+ y Movilidad+

Stand GovTech, 3 y 4 de noviembre de 2026. Objetivo único del demo: **que quien decide en una entidad
pública agende una conversación con Proliferante**. Todo lo demás (entender el problema, jugar con las
palancas) sirve a ese objetivo.

## Principios (Manual de marca Proliferante)

- **Dos filtros antes de publicar un texto:** ¿lo entiende alguien sin contexto? y *¿so what?* — cada
  característica va con su beneficio directo. Cero siglas internas.
- **Tres voces, según el momento:**
  - *Retadora* cuando señala el problema: una pregunta incómoda («¿Su entidad decide con datos o por costumbre?»).
  - *Cercana* cuando acompaña: Proli habla de frente («¿Qué esquina arreglaría usted primero?»).
  - *Rigurosa* cuando entrega: cifras con fuente («37.460 niños no quedan en ninguno de los colegios que pidieron»).
- **Una sola acción principal por pantalla**, en índigo (el color de la acción). El verde es el foco
  (lo que importa); Caveat Brush aparece una vez por sección, como firma emocional.
- **Nada de promesas sin respaldo:** no se ofrecen plazos, precios ni resultados que no estén en los datos.

## El embudo y dónde está cada llamado

| Momento | Dónde | Voz | Mensaje | Acción |
|---|---|---|---|---|
| 1. Atraer | Inicio · tarjeta Matrícula+ (Proli) | Retadora | «¿Quién se queda sin cupo? Véalo en un minuto.» | **Simular la asignación →** |
| 1. Atraer | Inicio · tarjeta Movilidad+ (Proli) | Cercana | «¿Qué esquina arreglaría usted primero?» | **Decidir dónde invertir →** |
| 2. Enganchar | Portada de cada proyecto | Rigurosa | La cifra que duele (37.460 niños / 562 fallecidos) | **Empezar el recorrido →** |
| 3. Probar | Acción / Usted decide | Cercana | El visitante mueve las palancas | **▶ Asignar** / tocar esquinas |
| 4. Convencer | Resultado y Supuestos | Rigurosa | Qué cambia, con supuestos editables | **Cómo lo hicimos →** |
| 5. Convertir | Método + Proli + QR | Cercana | «¿Lo vemos con los datos de tu entidad?» | **Agenda una cita** (QR / WhatsApp) |
| 5. Convertir | Inicio · franja «Para entidades públicas» | Retadora | «¿Su entidad decide con datos o por costumbre?» | **Agendar una conversación →** |

En el tótem (`?modo=stand` / `auto`) los enlaces se reemplazan por QR, porque un enlace sacaría a la
persona de la app; los globos de Proli en las tarjetas se ocultan por espacio.

## Dónde se cambian los textos

- `web/src/config.ts`: `PROYECTOS[].gancho` (lo que dice Proli en cada tarjeta), `PROYECTOS[].cta`
  (el botón de la tarjeta) y `LLAMADO_INICIO` (franja del inicio). `URL_CITA` / `WHATSAPP_CITA` es el
  destino de todos los llamados de cita (**pendiente: número real de WhatsApp**).

## Qué medir en el stand

- Visitantes que tocan una tarjeta / visitantes que llegan al capítulo Método.
- QR escaneados y mensajes de WhatsApp recibidos por día (el demo no guarda datos: se cuentan del lado
  de WhatsApp/Calendly).
- Pregunta de cierre en la conversación: *¿qué decisión de su entidad le gustaría ver así?* — alimenta
  el siguiente proyecto.
