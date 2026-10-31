-- Proli V9 (especificación de Paola, 31-oct-2026, sección 7.1): CRM mínimo del stand GovTech.
-- Se ejecuta una sola vez en Supabase → SQL Editor → New query → pegar todo → Run.
--
-- Seguridad: RLS activado en todas las tablas y SIN políticas. Así nadie puede leer ni escribir con la
-- clave pública (anon); solo el servidor de Proli (api/registro.ts, api/conversa.ts) con la clave
-- service_role, que vive en las variables de entorno de Vercel y nunca llega al navegador.
-- El equipo consulta los datos en Table Editor o en la vista v_solicitudes.

create extension if not exists pgcrypto;

-- Asesores de Proliferante (sección 5). Debe coincidir con api/_proli/v9/asesores.ts
create table if not exists staff_directory (
  staff_id      text primary key,
  display_name  text not null,
  email         text not null,
  enabled       boolean not null default true
);
insert into staff_directory (staff_id, display_name, email) values
  ('paola',  'Paola Arciniegas',     'paola.a@proliferante.com'),
  ('vero',   'Vero Rincón',          'vero.r@proliferante.com'),
  ('juan',   'Juan Esteban Estrada', 'juan.e@proliferante.com'),
  ('felipe', 'Felipe Narváez',       'felipe.n@proliferante.com'),
  ('natalia','Natalia Caro',         'nati.c@proliferante.com')
on conflict (staff_id) do update set display_name = excluded.display_name, email = excluded.email;

-- Una sesión = un visitante en una pantalla (se aísla y se cierra; sin transcripción completa)
create table if not exists sessions (
  session_id        uuid primary key,
  channel           text not null check (channel in ('stand', 'celular', 'escritorio', 'qr')),
  device_id         text,
  state             text not null,
  opened_at         timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  question_count    int not null default 0,
  offtopic_count    int not null default 0,
  staff_id          text references staff_directory (staff_id),
  closed_reason     text
);

create table if not exists contacts (
  contact_id    uuid primary key default gen_random_uuid(),
  full_name     text not null,
  organization  text not null,
  role          text,
  email         text not null unique,   -- en minúsculas: deduplicación por correo
  phone         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Tres finalidades separadas (sección 9): gestionar la cita, conservar la ficha, comunicaciones comerciales
create table if not exists consents (
  consent_id      uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references contacts (contact_id) on delete cascade,
  purpose         text not null check (purpose in ('gestionar_cita', 'conservar_ficha', 'comunicaciones_comerciales')),
  granted         boolean not null,
  "timestamp"     timestamptz not null default now(),
  policy_version  text not null,
  source          text not null
);

-- La ficha aprobada por el visitante (solo si autorizó conservarla)
create table if not exists discoveries (
  discovery_id           uuid primary key default gen_random_uuid(),
  session_id             uuid references sessions (session_id),
  contact_id             uuid references contacts (contact_id) on delete cascade,
  organization           text,
  role                   text,
  objective_declared     text not null,
  situation_declared     text,
  hypothesis_unverified  text,
  pending_validation     text,
  visitor_approved       boolean not null default false,
  staff_id               text references staff_directory (staff_id),
  created_at             timestamptz not null default now()
);

-- Reservas. Fase 1: «solicitada» con franja preferida (sin calendario). Fase 2: «confirmada» con evento real.
create table if not exists bookings (
  booking_id         uuid primary key default gen_random_uuid(),
  contact_id         uuid not null references contacts (contact_id) on delete cascade,
  session_id         uuid references sessions (session_id),
  staff_id           text references staff_directory (staff_id),   -- null = asesor_por_asignar
  staff_pending      boolean not null default false,
  calendar_event_id  text,
  starts_at          timestamptz,
  ends_at            timestamptz,
  timezone           text not null default 'America/Bogota',
  meeting_type       text not null default 'meet' check (meeting_type in ('meet', 'presencial')),
  preferred_slot     text,
  purpose            text,
  status             text not null default 'solicitada'
                     check (status in ('solicitada', 'bloqueada', 'confirmada', 'reprogramada', 'cancelada', 'realizada', 'no_asistio')),
  idempotency_key    text not null unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- Dos pantallas no pueden quedarse con el mismo horario confirmado (fase 2)
create unique index if not exists bookings_horario_unico on bookings (starts_at)
  where status in ('bloqueada', 'confirmada', 'reprogramada');

-- Estado comercial (sección 7.1). Nunca «oportunidad» por el solo hecho de chatear o reservar.
create table if not exists interactions (
  interaction_id  uuid primary key default gen_random_uuid(),
  contact_id      uuid references contacts (contact_id) on delete cascade,
  session_id      uuid references sessions (session_id),
  channel         text not null,
  staff_id        text references staff_directory (staff_id),
  owner_id        text references staff_directory (staff_id),   -- responsable_comercial_de_seguimiento
  next_action     text,
  "timestamp"     timestamptz not null default now(),
  status          text not null check (status in ('interes_recibido', 'reunion_confirmada', 'reunion_realizada',
                    'oportunidad_en_evaluacion', 'siguiente_compromiso_acordado', 'cancelada', 'no_asistio', 'exploratorio'))
);

alter table staff_directory enable row level security;
alter table sessions        enable row level security;
alter table contacts        enable row level security;
alter table consents        enable row level security;
alter table discoveries     enable row level security;
alter table bookings        enable row level security;
alter table interactions    enable row level security;

-- Lo que el equipo del stand revisa: cada solicitud con su contacto, asesor y ficha
create or replace view v_solicitudes with (security_invoker = true) as
select b.created_at, b.status, b.preferred_slot, b.meeting_type,
       c.full_name, c.organization, c.role, c.email, c.phone,
       coalesce(s.display_name, 'Por asignar') as asesor,
       b.purpose, d.objective_declared, d.hypothesis_unverified,
       b.booking_id, b.calendar_event_id
from bookings b
join contacts c on c.contact_id = b.contact_id
left join staff_directory s on s.staff_id = b.staff_id
left join lateral (select * from discoveries x where x.contact_id = b.contact_id order by x.created_at desc limit 1) d on true
order by b.created_at desc;
