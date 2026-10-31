-- Proli V12 (31-oct-2026): aislamiento de sesiones, agenda real con Google Calendar y recordatorio 24 h antes.
-- Se ejecuta UNA vez en Supabase → SQL Editor → New query → pegar todo → Run (después de 001_proli_v9.sql).

-- Sesiones: secuencia de mensajes, reintentos idempotentes y revocación al reiniciar (V12, sección 7.4)
alter table sessions add column if not exists message_seq      int not null default 0;
alter table sessions add column if not exists last_request_id  text;
alter table sessions add column if not exists last_response    jsonb;
alter table sessions add column if not exists revoked_at       timestamptz;

-- Reservas: enlace de Meet, meta para el recordatorio, asignación por defecto y recordatorio enviado
alter table bookings add column if not exists meet_link            text;
alter table bookings add column if not exists objective_short      text;
alter table bookings add column if not exists assigned_by_default  boolean not null default false;
alter table bookings add column if not exists reminder_sent_at     timestamptz;

-- Un mismo asesor no puede tener dos reuniones a la misma hora; asesores distintos sí (Paola, 31-oct).
-- Reemplaza el índice de 001, que bloqueaba la hora para todo el equipo.
drop index if exists bookings_horario_unico;
create unique index if not exists bookings_asesor_horario on bookings (staff_id, starts_at)
  where status in ('bloqueada', 'confirmada', 'reprogramada');

-- Lo que revisa el equipo: ahora con fecha y hora de la reunión y el enlace
drop view if exists v_solicitudes;
create view v_solicitudes with (security_invoker = true) as
select b.starts_at at time zone 'America/Bogota' as reunion_hora_colombia, b.status, b.meeting_type, b.meet_link,
       c.full_name, c.organization, c.role, c.email, c.phone,
       coalesce(s.display_name, 'Por asignar') as asesor, b.assigned_by_default as asesor_por_defecto,
       b.purpose, d.objective_declared, d.hypothesis_unverified,
       b.reminder_sent_at, b.created_at, b.booking_id, b.calendar_event_id
from bookings b
join contacts c on c.contact_id = b.contact_id
left join staff_directory s on s.staff_id = b.staff_id
left join lateral (select * from discoveries x where x.contact_id = b.contact_id order by x.created_at desc limit 1) d on true
order by b.starts_at desc nulls last;
