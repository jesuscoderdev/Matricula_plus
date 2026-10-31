# Proli V9: conversación breve, ficha y solicitud de cita

Implementa la **«PROLI | Especificación funcional y técnica para desarrollo», V9** (Paola, 31 de octubre de 2026). Se construye por fases, como se decidió el 31 de octubre. **Fase 1 (este cambio):** flujo V9 completo y CRM en Supabase; la cita queda *solicitada* y el equipo la confirma. **Fase 2:** agenda real con Google Calendar. Sin ella, Proli nunca dice «confirmada».

## Dónde vive

| Pieza | Archivo |
|---|---|
| Pantalla (chat, ficha editable, formulario, selector de asesor, inactividad del tótem) | `web/src/proli/v9/ConversaV9.tsx` (dentro de `web/src/proli/PaginaProli.tsx`) |
| Llamadas del navegador y cola sin conexión | `web/src/proli/v9/cliente.ts` |
| Turno de conversación (POST `/api/conversa`) | `web/api/conversa.ts` |
| Límites y transiciones (sección 3) | `web/api/_proli/v9/controlador.ts` |
| Prompt maestro (sección 8) y textos literales | `web/api/_proli/v9/prompt.ts` y `literales.ts` |
| Sesión firmada (HMAC): contadores que el navegador no puede alterar | `web/api/_proli/v9/sesion.ts` |
| Registro: contacto, consentimientos, ficha y solicitud (POST `/api/registro`) | `web/api/registro.ts` |
| CRM (Supabase REST) | `web/api/_proli/v9/almacen.ts` y `web/supabase/001_proli_v9.sql` |
| Asesores (sección 5) | `web/api/_proli/v9/asesores.ts` (igual que la tabla `staff_directory`) |

## Cómo funciona

- **Apertura.** El navegador muestra «¡Hola! 👋 Soy Proli. ¡Qué gusto conocerte! ¿De qué entidad u organización vienes?» y el campo de respuesta, sin botones.
- **Cada turno** va a `/api/conversa`:
  - el modelo (`claude-opus-5-5`, esfuerzo bajo) responde con un **JSON de esquema fijo**: clasificación, lo declarado, la siguiente acción y el mensaje;
  - el **controlador** decide. Aplica máximo 3 preguntas contando la de la apertura, una sola pregunta y hasta 280 caracteres por mensaje (si no, usa la pregunta literal), la definición literal de «Un Proli…», la regla de dos desvíos, que la agenda se abra en cualquier momento y que el chat no se reabra después de la ficha;
  - la hipótesis no puede vender automatización, chatbots, tableros ni IA si el visitante no los mencionó. Si lo hace, se pide otra; si tampoco sirve, Proli cierra con lo confirmado y sin hipótesis inventada.
- **La sesión viaja firmada** entre el navegador y el servidor. Cada visitante es una sesión aislada. La conversación completa no se guarda: en el CRM solo quedan el estado, los contadores, la ficha aprobada y la solicitud.
- **Ficha:** «Está bien» o «Editar resumen». Luego el visitante elige entre «Agendar 20 minutos», «Ver los demos» o «Terminar».
- **Formulario:**
  - nombre, organización, correo; cargo y celular son opcionales;
  - de qué quiere hablar y franja preferida (3 o 4 de noviembre, mañana o tarde, o después del evento), con modalidad Meet o presencial;
  - asesor. En el tótem se elige antes con el botón «Asesor»; en celular, con «¿Con quién conversaste?», que incluye «No recuerdo». Si no recuerda queda `asesor_por_asignar` y nunca se asigna uno al azar;
  - tres consentimientos separados. Gestionar la cita es obligatorio; conservar la ficha y recibir comunicaciones son opcionales y no vienen marcados.
- **Tótem:** después de 60 s sin actividad aparece «¿Sigues ahí?» y a los 90 s la pantalla se limpia y vuelve a la portada. Con el formulario abierto, los tiempos son 120 y 180 s.
- **Sin conexión:**
  - si `/api/conversa` falla, se ofrece directamente el formulario;
  - si `/api/registro` falla por red, la solicitud se guarda en el dispositivo y se envía sola al volver la conexión.
- **Panel de Proli dentro de los demos:** sigue guiando. Si el visitante habla de su reto, lo lleva a esta pantalla; si quiere agendar, lo lleva al formulario. El botón del paso 6, «Agendar 20 minutos», abre el formulario. Ya no hay WhatsApp ni QR.

## Variables de entorno (Vercel y `web/.env.local`; nunca en el código ni en el chat)

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | El modelo (ya existía). |
| `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` | El CRM. Sin ellas, `/api/registro` responde 503 y el navegador deja la solicitud en cola. |
| `PROLI_SECRETO` (opcional) | Firma de las sesiones. Si falta, se deriva de la clave de la API. |

En local (`npm run proli:local`), sin Supabase, los registros van a `web/.datos-locales/registros.jsonl`, que Git ignora.

## Pruebas

- `npm test`: tono, más 12 pruebas del controlador con un modelo simulado (C02, C07–C11, C23, C24, sesgo y ficha cerrada).
- `node scripts/proli-v9-pruebas.mjs`: los casos de conversación C02–C11 y C24 con el modelo real. Requiere el servidor local y gasta créditos. Resultado del 31 de octubre: **0 alertas**.

## Pendiente (fase 2 y dependencias de la especificación)

- [ ] **Google Calendar:** disponibilidad real, un solo evento de 20 minutos con invitación al visitante, a hello@ y al asesor, reprogramación, cancelación y bloqueo de horario (C12, C15–C18). Requiere una cuenta de servicio con acceso al calendario de hello@ y al de los cinco asesores, y los horarios autorizados.
- [ ] **Aviso a hello@** de cada solicitud (`notify_team`). Hasta entonces, el equipo revisa la vista `v_solicitudes` en Supabase.
- [ ] **Política de privacidad completa.** La del 23 de septiembre tiene campos pendientes y el aviso de `web/api/_proli/privacidad.ts` sigue siendo un borrador.
- [ ] **Confirmar que los seis correos existen** y reciben invitaciones.
- [ ] **Tablero mínimo del stand.** Por ahora: Supabase, Table Editor, `v_solicitudes`.
