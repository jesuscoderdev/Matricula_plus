/**
 * Google Calendar y Gmail en nombre de hello@proliferante.com, con el permiso OAuth que hello@ dio una vez
 * (scripts/google-autorizar.mjs): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN, solo en el
 * servidor. hello@ organiza cada reunión: el visitante y el asesor son los invitados (Paola, 31-oct).
 * El modelo nunca llega aquí: solo el código de agenda (V9, sección 7.2: operaciones acotadas).
 */
declare const process: { env: Record<string, string | undefined> }

export const hayGoogle = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN)

let acceso: { token: string; vence: number } | null = null
async function token(): Promise<string> {
  if (acceso && Date.now() < acceso.vence - 60_000) return acceso.token
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: process.env.GOOGLE_REFRESH_TOKEN!, grant_type: 'refresh_token' }),
  })
  const t = await r.json() as { access_token?: string; expires_in?: number; error?: string }
  if (!r.ok || !t.access_token) throw new Error(`google_token ${t.error ?? r.status}`)
  acceso = { token: t.access_token, vence: Date.now() + (t.expires_in ?? 3600) * 1000 }
  return acceso.token
}

async function google<T>(url: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(url, {
    method: opciones.method ?? 'GET',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
  })
  if (!r.ok) throw new Error(`google ${r.status} ${(await r.text()).slice(0, 300)}`)
  return r.json() as Promise<T>
}

/** Bloques ocupados de cada calendario entre dos instantes (solo horas, sin detalles de los eventos) */
export async function ocupados(correos: string[], desde: Date, hasta: Date): Promise<Record<string, { start: string; end: string }[]>> {
  const d = await google<{ calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }> }>(
    'https://www.googleapis.com/calendar/v3/freeBusy',
    { method: 'POST', body: { timeMin: desde.toISOString(), timeMax: hasta.toISOString(), timeZone: 'America/Bogota', items: correos.map((id) => ({ id })) } },
  )
  const salida: Record<string, { start: string; end: string }[]> = {}
  for (const c of correos) {
    const x = d.calendars?.[c]
    if (x?.errors?.length) throw new Error(`freebusy ${c} ${x.errors.map((e) => e.reason).join(',')}`)
    salida[c] = x?.busy ?? []
  }
  return salida
}

export interface Evento { id: string; enlace: string | null; invitados: string[] }

/** Crea UN evento en el calendario de hello@ con invitación al visitante y al asesor (y Meet si es virtual) */
export async function crearEvento(e: {
  titulo: string; descripcion: string; inicio: Date; fin: Date; invitados: string[]; meet: boolean; lugar?: string; clave: string
}): Promise<Evento> {
  const r = await google<{ id: string; hangoutLink?: string; attendees?: { email: string }[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      body: {
        summary: e.titulo, description: e.descripcion, location: e.lugar,
        start: { dateTime: e.inicio.toISOString(), timeZone: 'America/Bogota' },
        end: { dateTime: e.fin.toISOString(), timeZone: 'America/Bogota' },
        attendees: e.invitados.map((email) => ({ email })),
        guestsCanModify: false, guestsCanInviteOthers: false,
        reminders: { useDefault: true },
        ...(e.meet ? { conferenceData: { createRequest: { requestId: e.clave.slice(0, 60), conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
      },
    },
  )
  return { id: r.id, enlace: r.hangoutLink ?? null, invitados: (r.attendees ?? []).map((a) => a.email.toLowerCase()) }
}

/** Correo desde hello@ (texto plano, UTF-8) */
export async function enviarCorreo(para: string, asunto: string, texto: string) {
  const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64')
  const mensaje = [
    `To: ${para}`,
    'From: Equipo Proliferante <hello@proliferante.com>',
    `Subject: =?UTF-8?B?${b64(asunto)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(texto),
  ].join('\r\n')
  await google('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', body: { raw: Buffer.from(mensaje).toString('base64url') } })
}
