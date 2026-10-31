/**
 * Horarios de las reuniones de 20 minutos (Paola, 31-oct): desde el 3 de noviembre de 2026, de 8:00 a 17:30
 * hora de Colombia (UTC-5, sin horario de verano), de lunes a viernes y sin festivos. Cada horario se ocupa
 * POR ASESOR: dos asesores pueden tener reuniones a la misma hora, un mismo asesor no (y hello@ organiza
 * todas, así que su calendario no bloquea). Sin imports: lo usan el servidor y las pruebas.
 */
export const MINUTOS_REUNION = 20
export const PRIMER_DIA = '2026-11-03'
export const HORA_INICIO = 8 * 60          // 8:00
export const HORA_FIN = 17 * 60 + 30       // 17:30: cada 20 minutos desde las 8:00, la última empieza a las 17:00
export const DIAS_ADELANTE = 30            // hasta cuántos días hábiles se ofrecen
export const ANTICIPACION_MIN = 30         // no se ofrece un horario que empieza en menos de 30 minutos
const OFFSET_BOGOTA = -5 * 60

// Festivos de Colombia en el periodo (Ley 51 de 1983)
const FESTIVOS = new Set(['2026-11-16', '2026-12-08', '2026-12-25', '2027-01-01', '2027-01-11'])

/** Fecha «AAAA-MM-DD» de Bogotá para un instante */
export const diaBogota = (d: Date) => new Date(d.getTime() + OFFSET_BOGOTA * 60_000).toISOString().slice(0, 10)
/** Instante de un día de Bogotá a cierta hora (minutos desde medianoche) */
export const instante = (dia: string, minutos: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + (minutos - OFFSET_BOGOTA) * 60_000)
const minutosBogota = (d: Date) => { const l = new Date(d.getTime() + OFFSET_BOGOTA * 60_000); return l.getUTCHours() * 60 + l.getUTCMinutes() }

export function esDiaHabil(dia: string): boolean {
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay()
  return semana !== 0 && semana !== 6 && !FESTIVOS.has(dia) && dia >= PRIMER_DIA
}

/** Los próximos días hábiles con horarios, desde hoy o desde el 3 de noviembre */
export function diasDisponibles(ahora = new Date()): string[] {
  const dias: string[] = []
  let d = Date.parse(`${diaBogota(ahora) > PRIMER_DIA ? diaBogota(ahora) : PRIMER_DIA}T12:00:00Z`)
  while (dias.length < DIAS_ADELANTE) {
    const dia = new Date(d).toISOString().slice(0, 10)
    if (esDiaHabil(dia) && horariosDelDia(dia, ahora).length) dias.push(dia)
    d += 86_400_000
  }
  return dias
}

/** Todos los inicios posibles de un día (antes de mirar calendarios) */
export function horariosDelDia(dia: string, ahora = new Date()): Date[] {
  if (!esDiaHabil(dia)) return []
  const salida: Date[] = []
  for (let m = HORA_INICIO; m + MINUTOS_REUNION <= HORA_FIN; m += MINUTOS_REUNION) {
    const inicio = instante(dia, m)
    if (inicio.getTime() - ahora.getTime() >= ANTICIPACION_MIN * 60_000) salida.push(inicio)
  }
  return salida
}

/** ¿Este inicio es uno de los horarios ofrecidos? (el servidor no confía en lo que manda el navegador) */
export function esHorarioValido(inicio: Date, ahora = new Date()): boolean {
  if (Number.isNaN(inicio.getTime())) return false
  const dia = diaBogota(inicio)
  return horariosDelDia(dia, ahora).some((h) => h.getTime() === inicio.getTime()) && diasDisponibles(ahora).includes(dia)
}

/** Quita los horarios que se cruzan con algún bloque ocupado */
export function libres(horarios: Date[], ocupados: { start: string | Date; end: string | Date }[]): Date[] {
  return horarios.filter((h) => {
    const ini = h.getTime(), fin = ini + MINUTOS_REUNION * 60_000
    return !ocupados.some((o) => new Date(o.start).getTime() < fin && new Date(o.end).getTime() > ini)
  })
}

/** «martes 3 de noviembre» y «10:20 a. m.» en hora de Colombia */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function fechaLarga(d: Date): string {
  const dia = diaBogota(d)
  const f = new Date(`${dia}T12:00:00Z`)
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}`
}
export function horaCorta(d: Date): string {
  const m = minutosBogota(d)
  const h = Math.floor(m / 60), min = m % 60
  return `${((h + 11) % 12) + 1}:${String(min).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}
