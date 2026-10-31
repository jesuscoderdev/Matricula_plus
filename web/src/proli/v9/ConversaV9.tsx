/**
 * Proli (especificación de Paola V9–V12): conversación breve de descubrimiento, ficha editable y reunión
 * real de 20 minutos. Vive en la página de Proli (PaginaProli.tsx).
 *
 *  · Apertura sin botones; las etapas, preguntas y cierres los decide el servidor (api/conversa.ts):
 *    aquí solo se muestran los estados que él autoriza.
 *  · Aislamiento (V12, 7.4): cada visitante es un componente <Visita> nuevo (key): al reiniciar, por
 *    «Terminar» o por inactividad, se desmonta entero (chat, ficha, formulario, horarios), se cancelan
 *    las peticiones en curso, se revoca la sesión en el servidor y las respuestas tardías se descartan.
 *    Nada del visitante se guarda en el navegador; solo el asesor que atiende el tótem.
 *  · Reunión: horarios libres de verdad (calendario del asesor + CRM), confirmación antes de enviar y
 *    «Tu reunión está confirmada» solo cuando Google creó el evento. Sin asesor, la reunión es con Paola.
 *  · Tótem: aviso a los 60 s sin actividad y pantalla limpia a los 90 s.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AvisoPrivacidad from '../../componentes/AvisoPrivacidad'
import { esTotem, type Modo } from '../../modo'
import { ASESORES, POR_ASIGNAR, asesorPorId } from '../../../api/_proli/v9/asesores'
import { LITERAL } from '../../../api/_proli/v9/literales'
import { ErrorProli, enviarTurno, nuevaClave, pedirHorarios, reservar, revocar, type Accion, type Canal, type Confirmada, type Ficha, type Horarios } from './cliente'

const MAX_TEXTO = 500
const DIAS_DEL_STAND = ['2026-11-03', '2026-11-04']
const HORARIOS_VISIBLES = 3
const NOTA_FICHA = 'Esta es una hipótesis inicial basada en lo que nos contaste; todavía no es un diagnóstico.'
const SIN_CONEXION = 'Ahora no puedo conversar, pero puedes agendar directamente 20 minutos con el equipo.'
const CLAVE_ASESOR = 'proli-asesor'   // configuración del tótem (no es un dato del visitante)

interface Linea { quien: 'proli' | 'visitante'; texto: string }
type Vista = 'chat' | 'ficha' | 'opciones' | 'formulario' | 'listo'

const canalDe = (modo: Modo): Canal =>
  esTotem(modo) ? 'stand' : new URLSearchParams(window.location.search).get('origen') === 'qr' ? 'qr' : modo === 'celular' ? 'celular' : 'escritorio'
const leerAsesor = () => { try { return sessionStorage.getItem(CLAVE_ASESOR) } catch { return null } }
const guardarAsesor = (id: string | null) => { try { if (id) sessionStorage.setItem(CLAVE_ASESOR, id); else sessionStorage.removeItem(CLAVE_ASESOR) } catch { /* sin almacenamiento */ } }

/** Inactividad del tótem (V12): aviso a los 60 s y reinicio a los 90 s, también con el formulario abierto */
function useInactividad(activo: boolean, alReiniciar: () => void) {
  const [aviso, setAviso] = useState(false)
  const refReiniciar = useRef(alReiniciar)
  refReiniciar.current = alReiniciar
  useEffect(() => {
    if (!activo) return
    let a = 0, r = 0
    const programar = () => {
      window.clearTimeout(a); window.clearTimeout(r); setAviso(false)
      a = window.setTimeout(() => setAviso(true), 60_000)
      r = window.setTimeout(() => { setAviso(false); refReiniciar.current() }, 90_000)
    }
    programar()
    const eventos = ['pointerdown', 'keydown', 'input'] as const
    eventos.forEach((e) => window.addEventListener(e, programar))
    return () => { window.clearTimeout(a); window.clearTimeout(r); eventos.forEach((e) => window.removeEventListener(e, programar)) }
  }, [activo])
  return aviso
}

export default function ConversaV9({ modo, agendaInicial, alDemos, alTerminar }: {
  modo: Modo
  /** llegó con «Agendar 20 minutos» (desde un demo): directo al formulario, sin descubrimiento (C11) */
  agendaInicial: boolean
  alDemos: () => void
  /** tótem: al terminar o por inactividad, a la portada */
  alTerminar?: () => void
}) {
  const totem = esTotem(modo)
  const [visita, setVisita] = useState(0)          // generación: cada visitante es un componente nuevo
  const [conAgenda, setConAgenda] = useState(agendaInicial)
  const [asesor, setAsesor] = useState<string | null>(leerAsesor)
  const [elegirAsesor, setElegirAsesor] = useState(false)
  const token = useRef<string | null>(null)

  const nuevaVisita = useCallback(() => {
    revocar(token.current)
    token.current = null
    setConAgenda(false)
    setVisita((v) => v + 1)
  }, [])
  const terminar = () => { nuevaVisita(); alTerminar?.() }
  const aviso = useInactividad(totem, terminar)

  return (
    <section className="pagina-proli__chat conversa-v9" aria-label="Conversación con Proli">
      <Visita key={visita} totem={totem} canal={canalDe(modo)} asesor={asesor} agendaInicial={conAgenda} token={token}
              alDemos={alDemos} alReiniciar={nuevaVisita} alTerminar={terminar} alElegirAsesor={totem ? () => setElegirAsesor(true) : undefined} />
      {elegirAsesor && (
        <div className="conversa-v9__capa" role="dialog" aria-label="¿Quién atiende?">
          <div className="conversa-v9__hoja">
            <b>¿Quién atiende en este momento?</b>
            <div className="conversa-v9__asesores">
              {ASESORES.map((a) => (
                <button key={a.id} type="button" className={`proli-panel__chip ${asesor === a.id ? 'proli-panel__chip--si' : ''}`}
                        onClick={() => { guardarAsesor(a.id); setAsesor(a.id); setElegirAsesor(false) }}>{a.nombre}</button>
              ))}
              <button type="button" className="proli-panel__chip" onClick={() => { guardarAsesor(null); setAsesor(null); setElegirAsesor(false) }}>Nadie por ahora</button>
            </div>
          </div>
        </div>
      )}
      {aviso && (
        <div className="conversa-v9__capa" role="alertdialog" aria-label="¿Sigues ahí?">
          <div className="conversa-v9__hoja">
            <b>¿Sigues ahí?</b>
            <p>En unos segundos la pantalla se limpia para el siguiente visitante.</p>
            <button type="button" className="boton boton--violeta">Sigo aquí</button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Un visitante: todo su estado vive aquí y desaparece al desmontarse */
function Visita({ totem, canal, asesor, agendaInicial, token, alDemos, alReiniciar, alTerminar, alElegirAsesor }: {
  totem: boolean; canal: Canal; asesor: string | null; agendaInicial: boolean; token: MutableRefObject<string | null>
  alDemos: () => void; alReiniciar: () => void; alTerminar: () => void; alElegirAsesor?: () => void
}) {
  const [lineas, setLineas] = useState<Linea[]>(() => [{ quien: 'proli', texto: LITERAL.apertura }])
  const [vista, setVista] = useState<Vista>(agendaInicial ? 'formulario' : 'chat')
  const [accion, setAccion] = useState<Accion>(agendaInicial ? 'agenda' : 'chat')
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [aprobada, setAprobada] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [confirmada, setConfirmada] = useState<(Confirmada & { email: string }) | null>(null)
  const refLista = useRef<HTMLDivElement>(null)
  const seq = useRef(0)
  const control = useRef(new AbortController())
  // Al desmontarse (reinicio, inactividad, otra pantalla), se cancela todo lo que estaba en camino
  useEffect(() => () => control.current.abort(), [])
  useEffect(() => { refLista.current?.scrollTo({ top: refLista.current.scrollHeight, behavior: 'smooth' }) }, [lineas, vista, ocupado])

  const decir = (l: Linea) => setLineas((x) => [...x, l])
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t || ocupado || vista !== 'chat') return
    setTexto('')
    decir({ quien: 'visitante', texto: t })
    setOcupado(true)
    const s = seq.current + 1
    try {
      const r = await enviarTurno({ texto: t, token: token.current, seq: s, canal, asesor }, control.current.signal)
      if (control.current.signal.aborted || r.seq !== s) return   // respuesta tardía de otra visita: se descarta
      seq.current = s
      token.current = r.token
      setAccion(r.accion)
      if (r.mensaje) decir({ quien: 'proli', texto: r.mensaje })
      if (r.accion === 'ficha' && r.ficha) { setFicha(r.ficha); setVista('ficha') }
      else if (r.accion === 'agenda') setVista('formulario')
      else if (r.accion === 'cerrado' || r.accion === 'terminado') setVista('opciones')
    } catch (err) {
      if (control.current.signal.aborted) return
      const codigo = err instanceof ErrorProli ? err.codigo : ''
      if (['sesion', 'sesion_cerrada', 'secuencia'].includes(codigo)) { alReiniciar(); return }
      // Sin conexión o falla del modelo: queda la agenda directa (plan B)
      decir({ quien: 'proli', texto: SIN_CONEXION })
      setAccion('agenda')
      setVista('formulario')
    } finally {
      if (!control.current.signal.aborted) setOcupado(false)
    }
  }

  const chatAbierto = vista === 'chat' && accion === 'chat'
  const nombreAsesor = asesorPorId(asesor)?.nombre

  return (
    <>
      <header className="pagina-proli__chat-cabeza">
        <span><b>Proli</b><small>{ocupado ? 'Escribiendo…' : 'Sistema inteligente de Proliferante'}</small></span>
        {alElegirAsesor && (
          <button type="button" className="conversa-v9__asesor" onClick={alElegirAsesor} aria-label="Asesor que atiende">
            {nombreAsesor ? `Asesor: ${nombreAsesor.split(' ')[0]}` : 'Asesor'}
          </button>
        )}
        {(lineas.length > 1 || vista !== 'chat') && <button type="button" className="proli-panel__nuevo" onClick={alReiniciar}>Reiniciar</button>}
      </header>

      <div className="pagina-proli__lista" ref={refLista} aria-live="polite">
        {lineas.map((l, i) => <p key={i} className={`proli-panel__linea proli-panel__linea--${l.quien}`}>{l.texto}</p>)}
        {ocupado && <span className="proli-panel__puntos" aria-hidden><i /><i /><i /></span>}

        <AnimatePresence>
          {ficha && (vista === 'ficha' || vista === 'opciones' || vista === 'formulario') && (
            <motion.div key="ficha" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <FichaV9 ficha={ficha} editable={vista === 'ficha'} aprobada={aprobada}
                       alCambiar={setFicha} alAprobar={() => { setAprobada(true); setVista('opciones') }} />
            </motion.div>
          )}
          {vista === 'opciones' && (
            <motion.div key="opciones" className="conversa-v9__opciones" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <button type="button" className="boton boton--violeta" onClick={() => setVista('formulario')}>Agendar 20 minutos</button>
              <button type="button" className="boton boton--claro" onClick={alDemos}>Ver los demos</button>
              <button type="button" className="boton boton--claro" onClick={alTerminar}>Terminar</button>
            </motion.div>
          )}
          {vista === 'formulario' && (
            <motion.div key="formulario" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <FormularioV9 ficha={ficha} aprobada={aprobada} asesorFijo={totem ? asesor : null} canal={canal} token={token.current} senal={control.current.signal}
                            alCancelar={() => setVista(ficha ? 'opciones' : accion === 'chat' ? 'chat' : 'opciones')}
                            alConfirmar={(c) => { setConfirmada(c); setVista('listo') }} />
            </motion.div>
          )}
          {vista === 'listo' && confirmada && (
            <motion.div key="listo" className="conversa-v9__listo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="ficha-v9 confirmada-v9">
                <b className="ficha-v9__titulo">¡Tu reunión está confirmada!</b>
                <p><b>{confirmada.fecha.charAt(0).toUpperCase() + confirmada.fecha.slice(1)}</b>, a las <b>{confirmada.hora}</b> (hora de Colombia) · 20 minutos</p>
                <p>{confirmada.modalidad === 'presencial' ? 'Presencial, en el stand de Proliferante.' : 'Virtual, por Google Meet.'} Con <b>{confirmada.asesor}</b> del equipo de Proliferante.</p>
                <p>Te enviamos la invitación a <b>{confirmada.email}</b>{confirmada.modalidad === 'presencial' ? '.' : ', con el enlace de la reunión.'}</p>
              </div>
              <div className="conversa-v9__opciones">
                <button type="button" className="boton boton--claro" onClick={alDemos}>Ver los demos</button>
                <button type="button" className="boton boton--violeta" onClick={alTerminar}>Terminar</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {chatAbierto && (
        <form className="proli-panel__escribir pagina-proli__escribir" onSubmit={enviar}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={MAX_TEXTO} placeholder="Escribe tu respuesta…"
                 disabled={ocupado} aria-label="Tu respuesta para Proli" enterKeyHint="send" autoComplete="off" />
          <button type="submit" className="boton boton--violeta" disabled={ocupado || !texto.trim()}>Enviar</button>
        </form>
      )}
      {chatAbierto && texto.length > MAX_TEXTO - 80 && <p className="conversa-v9__contador">{texto.length} / {MAX_TEXTO}</p>}
      <p className="pagina-proli__privacidad">Antes de compartir tus datos, revisa nuestro <AvisoPrivacidad etiqueta="aviso de privacidad" /></p>
    </>
  )
}

/** La ficha de salida (sección 4): editable antes de aprobarla; editarla no reabre el chat */
function FichaV9({ ficha, editable, aprobada, alCambiar, alAprobar }: {
  ficha: Ficha; editable: boolean; aprobada: boolean; alCambiar: (f: Ficha) => void; alAprobar: () => void
}) {
  const [editando, setEditando] = useState(false)
  const campos: [keyof Ficha, string][] = [
    ['organizacion', 'Organización'], ['rol', 'Rol'], ['objetivo', 'Lo que quieres lograr'],
    ['situacion', 'Situación conocida'], ['hipotesis', 'Hipótesis por validar'], ['por_conocer', 'Por conocer'],
  ]
  return (
    <div className="ficha-v9">
      <b className="ficha-v9__titulo">Tu resumen</b>
      <dl>
        {campos.filter(([k]) => editando || ficha[k]).map(([k, etiqueta]) => (
          <div key={k}>
            <dt>{etiqueta}</dt>
            <dd>
              {editando
                ? <textarea value={ficha[k]} maxLength={500} rows={k === 'hipotesis' || k === 'objetivo' ? 3 : 1}
                            onChange={(e) => alCambiar({ ...ficha, [k]: e.target.value })} aria-label={etiqueta} />
                : ficha[k]}
            </dd>
          </div>
        ))}
      </dl>
      <p className="ficha-v9__nota">{NOTA_FICHA}</p>
      {editable && !aprobada && (
        <div className="conversa-v9__opciones">
          <button type="button" className="boton boton--violeta" onClick={() => { setEditando(false); alAprobar() }}>{editando ? 'Guardar cambios' : 'Está bien'}</button>
          {!editando && <button type="button" className="boton boton--claro" onClick={() => setEditando(true)}>Editar resumen</button>}
        </div>
      )}
    </div>
  )
}

/** Contacto, asesor, horario real y permisos; luego confirmación (V9 6.1: «Confirmar detalles antes de enviar») */
function FormularioV9({ ficha, aprobada, asesorFijo, canal, token, senal, alCancelar, alConfirmar }: {
  ficha: Ficha | null; aprobada: boolean; asesorFijo: string | null; canal: Canal; token: string | null; senal: AbortSignal
  alCancelar: () => void
  alConfirmar: (c: Confirmada & { email: string }) => void
}) {
  const [clave] = useState(nuevaClave)
  const [f, setF] = useState({
    nombre: '', organizacion: ficha?.organizacion ?? '', email: '', cargo: ficha?.rol ?? '', celular: '',
    proposito: ficha?.objetivo ?? '', modalidad: 'meet' as 'meet' | 'presencial',
    asesor: asesorFijo ?? '', gestionar: false, conservar: false, comunicaciones: false,
  })
  const [horarios, setHorarios] = useState<Horarios | null>(null)
  const [cargando, setCargando] = useState(false)
  const [elegido, setElegido] = useState<{ inicio: string; hora: string; dia: string } | null>(null)
  const [todos, setTodos] = useState(false)
  const [desdeDia, setDesdeDia] = useState(0)   // los días se muestran de 10 en 10 (hasta el 3 de febrero)
  const [revisar, setRevisar] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const cambiar = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const nombreDia = (d: string) => horarios?.dias.find((x) => x.dia === d)?.nombre ?? d
  const presencialPosible = !!elegido && DIAS_DEL_STAND.includes(elegido.dia)
  const asesorReunion = asesorPorId(f.asesor)?.nombre ?? 'Paola Arciniegas'

  const cargar = useCallback(async (asesor: string, dia: string | null) => {
    setCargando(true); setError(''); setTodos(false)
    try {
      const h = await pedirHorarios(asesor, dia, senal)
      if (!senal.aborted) setHorarios(h)
    } catch (e) {
      if (!senal.aborted) setError(e instanceof ErrorProli && e.codigo === 'sin_conexion' ? 'Sin conexión: no pude traer los horarios. Intenta de nuevo en un momento.' : 'No pude traer los horarios del calendario. Intenta de nuevo en un momento.')
    } finally { if (!senal.aborted) setCargando(false) }
  }, [senal])
  // Los horarios dependen del asesor (cada asesor tiene su agenda; sin asesor, la de Paola)
  useEffect(() => { if (f.asesor) { setElegido(null); void cargar(f.asesor, null) } }, [f.asesor, cargar])

  const validar = () => {
    if (!f.nombre.trim() || !/[aeiouáéíóú]/i.test(f.nombre)) return 'Escribe tu nombre.'
    if (!f.organizacion.trim()) return 'Escribe tu organización.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return 'Revisa tu correo: ahí te llega la invitación.'
    if (!f.asesor) return 'Cuéntanos con quién conversaste, o elige «No recuerdo».'
    if (!elegido) return 'Elige un horario.'
    if (!f.gestionar) return 'Para agendar necesitamos tu autorización para gestionar la reunión.'
    return ''
  }
  const aRevisar = (e: FormEvent) => {
    e.preventDefault()
    const m = validar()
    setError(m)
    if (!m) setRevisar(true)
  }
  const confirmar = async () => {
    if (!elegido) return
    setError(''); setEnviando(true)
    try {
      const c = await reservar({
        token, canal, clave,
        contacto: { nombre: f.nombre.trim(), organizacion: f.organizacion.trim(), email: f.email.trim(), cargo: f.cargo.trim(), celular: f.celular.trim() },
        consentimientos: { gestionar_cita: f.gestionar, conservar_ficha: f.conservar, comunicaciones_comerciales: f.comunicaciones },
        asesor: f.asesor,
        ficha: ficha ? { ...ficha, aprobada } : null,
        agenda: { proposito: f.proposito.trim(), inicio: elegido.inicio, modalidad: presencialPosible ? f.modalidad : 'meet' },
      }, senal)
      if (!senal.aborted) alConfirmar({ ...c, email: f.email.trim() })
    } catch (err) {
      if (senal.aborted) return
      const e = err instanceof ErrorProli ? err : new ErrorProli('fallo')
      setRevisar(false)
      if (e.codigo === 'horario_tomado' || e.codigo === 'horario') {
        setError('Ese horario se acaba de ocupar. Elige otro, por favor.')
        setElegido(null); void cargar(f.asesor, elegido.dia)
      } else if (e.campo === 'email') setError('Revisa tu correo.')
      else if (e.campo === 'nombre') setError('Revisa tu nombre.')
      else if (e.codigo === 'sin_conexion') setError('Sin conexión: tu reunión no quedó agendada. Intenta de nuevo cuando vuelva la conexión.')
      else setError('No pudimos crear la reunión en el calendario. Intenta de nuevo o elige otro horario.')
    } finally { if (!senal.aborted) setEnviando(false) }
  }

  if (revisar && elegido) return (
    <div className="formulario-v9">
      <b className="ficha-v9__titulo">Confirma tu reunión</b>
      <p className="formulario-v9__resumen">
        <b>{nombreDia(elegido.dia).replace(/^./, (x) => x.toUpperCase())}</b>, a las <b>{elegido.hora}</b> (hora de Colombia) · 20 minutos<br />
        {presencialPosible && f.modalidad === 'presencial' ? 'Presencial, en el stand de Proliferante' : 'Virtual, por Google Meet'} · con <b>{asesorReunion}</b><br />
        La invitación llega a <b>{f.email.trim()}</b>.
      </p>
      {error && <p className="formulario-v9__error" role="alert">{error}</p>}
      <div className="conversa-v9__opciones">
        <button type="button" className="boton boton--violeta" onClick={confirmar} disabled={enviando}>{enviando ? 'Agendando…' : 'Confirmar reunión'}</button>
        <button type="button" className="boton boton--claro" onClick={() => setRevisar(false)} disabled={enviando}>Cambiar algo</button>
      </div>
    </div>
  )

  const visibles = horarios ? (todos ? horarios.horarios : horarios.horarios.slice(0, HORARIOS_VISIBLES)) : []
  return (
    <form className="formulario-v9" onSubmit={aRevisar} noValidate>
      <b className="ficha-v9__titulo">Agenda 20 minutos con el equipo</b>
      <label>Nombre<input value={f.nombre} onChange={(e) => cambiar('nombre', e.target.value)} maxLength={120} autoComplete="name" required /></label>
      <label>Organización<input value={f.organizacion} onChange={(e) => cambiar('organizacion', e.target.value)} maxLength={160} autoComplete="organization" required /></label>
      <label>Correo<input type="email" value={f.email} onChange={(e) => cambiar('email', e.target.value)} maxLength={254} autoComplete="email" inputMode="email" required /></label>
      <div className="formulario-v9__fila">
        <label>Cargo <small>(opcional)</small><input value={f.cargo} onChange={(e) => cambiar('cargo', e.target.value)} maxLength={120} autoComplete="organization-title" /></label>
        <label>Celular <small>(opcional)</small><input value={f.celular} onChange={(e) => cambiar('celular', e.target.value)} maxLength={30} autoComplete="tel" inputMode="tel" /></label>
      </div>
      <label>¿De qué te gustaría hablar?<textarea value={f.proposito} onChange={(e) => cambiar('proposito', e.target.value)} maxLength={500} rows={2} /></label>

      {asesorFijo ? (
        <p className="formulario-v9__asesor">Conversaste con <b>{asesorPorId(asesorFijo)?.nombre}</b>.</p>
      ) : (
        <fieldset>
          <legend>¿Con quién conversaste en nuestro equipo?</legend>
          <div className="conversa-v9__asesores">
            {ASESORES.map((a) => (
              <button key={a.id} type="button" className={`proli-panel__chip ${f.asesor === a.id ? 'proli-panel__chip--si' : ''}`} onClick={() => cambiar('asesor', a.id)}>{a.nombre}</button>
            ))}
            <button type="button" className={`proli-panel__chip ${f.asesor === POR_ASIGNAR ? 'proli-panel__chip--si' : ''}`} onClick={() => cambiar('asesor', POR_ASIGNAR)}>No recuerdo / no conversé con nadie</button>
          </div>
        </fieldset>
      )}

      {f.asesor && (
        <fieldset>
          <legend>¿Cuándo te queda mejor? <small>(hora de Colombia)</small></legend>
          {horarios && (
            <div className="conversa-v9__asesores formulario-v9__dias">
              {desdeDia > 0 && <button type="button" className="proli-panel__chip" onClick={() => setDesdeDia((x) => Math.max(0, x - 10))}>← Fechas anteriores</button>}
              {horarios.dias.slice(desdeDia, desdeDia + 10).map((d) => (
                <button key={d.dia} type="button" className={`proli-panel__chip ${horarios.dia === d.dia ? 'proli-panel__chip--si' : ''}`}
                        onClick={() => { setElegido(null); void cargar(f.asesor, d.dia) }}>{d.nombre}</button>
              ))}
              {desdeDia + 10 < horarios.dias.length && <button type="button" className="proli-panel__chip" onClick={() => setDesdeDia((x) => x + 10)}>Más fechas →</button>}
            </div>
          )}
          {cargando ? <small>Buscando horarios libres…</small> : horarios && (
            visibles.length ? (
              <div className="conversa-v9__asesores">
                {visibles.map((h) => (
                  <button key={h.inicio} type="button" className={`proli-panel__chip ${elegido?.inicio === h.inicio ? 'proli-panel__chip--si' : ''}`}
                          onClick={() => setElegido({ ...h, dia: horarios.dia })}>{h.hora}</button>
                ))}
                {!todos && horarios.horarios.length > HORARIOS_VISIBLES && (
                  <button type="button" className="proli-panel__chip" onClick={() => setTodos(true)}>Ver más horarios</button>
                )}
              </div>
            ) : <small>No quedan horarios libres ese día. Elige otro.</small>
          )}
          {presencialPosible && (
            <div className="formulario-v9__modalidad">
              <label className="formulario-v9__opcion"><input type="radio" name="modalidad" checked={f.modalidad === 'meet'} onChange={() => cambiar('modalidad', 'meet')} />Virtual (Google Meet)</label>
              <label className="formulario-v9__opcion"><input type="radio" name="modalidad" checked={f.modalidad === 'presencial'} onChange={() => cambiar('modalidad', 'presencial')} />Presencial, en el stand</label>
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="formulario-v9__permisos">
        <label className="formulario-v9__opcion"><input type="checkbox" checked={f.gestionar} onChange={(e) => cambiar('gestionar', e.target.checked)} />Autorizo a Proliferante a usar estos datos para gestionar esta reunión.</label>
        {ficha && <label className="formulario-v9__opcion"><input type="checkbox" checked={f.conservar} onChange={(e) => cambiar('conservar', e.target.checked)} />Autorizo conservar mi resumen para preparar la conversación (opcional).</label>}
        <label className="formulario-v9__opcion"><input type="checkbox" checked={f.comunicaciones} onChange={(e) => cambiar('comunicaciones', e.target.checked)} />Quiero recibir información de Proliferante (opcional).</label>
        <small>Puedes leer el <AvisoPrivacidad etiqueta="aviso de privacidad" /> y retirar tu permiso cuando quieras.</small>
      </fieldset>

      {error && <p className="formulario-v9__error" role="alert">{error}</p>}
      <div className="conversa-v9__opciones">
        <button type="submit" className="boton boton--violeta">Revisar y confirmar</button>
        <button type="button" className="boton boton--claro" onClick={alCancelar}>Volver</button>
      </div>
    </form>
  )
}
