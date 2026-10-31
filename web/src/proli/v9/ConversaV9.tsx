/**
 * Proli V9 (especificación de Paola, 31-oct-2026): la conversación breve de descubrimiento, la ficha
 * editable y el formulario de contacto y cita. Vive en la página de Proli (PaginaProli.tsx).
 *
 *  · Apertura sin botones: «¡Hola! 👋 Soy Proli… ¿De qué entidad u organización vienes?» y el campo.
 *  · Máximo 3 preguntas: los límites los aplica el servidor (api/conversa.ts); aquí solo se muestra.
 *  · Ficha: «Está bien» / «Editar resumen»; editarla no reabre el chat. Luego agendar, demos o terminar.
 *  · Formulario: contacto, asesor que atendió (o «No recuerdo»), franja preferida y tres consentimientos
 *    separados. Fase 1: la cita queda «solicitada» y el equipo confirma; nunca se muestra «confirmada».
 *  · Tótem: el asesor se elige antes en un selector discreto; tras 60 s sin actividad avisa y a los 90 s
 *    limpia todo (en el formulario, 120 y 180 s), para que el siguiente visitante no vea datos ajenos.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AvisoPrivacidad from '../../componentes/AvisoPrivacidad'
import { esTotem, type Modo } from '../../modo'
import { ASESORES, POR_ASIGNAR, asesorPorId } from '../../../api/_proli/v9/asesores'
import { LITERAL } from '../../../api/_proli/v9/literales'
import { ErrorProli, enviarTurno, nuevaClave, registrar, type Accion, type Canal, type Ficha } from './cliente'

const MAX_TEXTO = 500
const FRANJAS = [
  'Martes 3 de noviembre, en la mañana',
  'Martes 3 de noviembre, en la tarde',
  'Miércoles 4 de noviembre, en la mañana',
  'Miércoles 4 de noviembre, en la tarde',
  'Después del evento (el equipo me propone fecha)',
]
const NOTA_FICHA = 'Esta es una hipótesis inicial basada en lo que nos contaste; todavía no es un diagnóstico.'
const SIN_CONEXION = 'Ahora no puedo conversar, pero puedes dejar tus datos y el equipo te contacta para agendar 20 minutos.'
const CLAVE_ASESOR = 'proli-asesor'

interface Linea { quien: 'proli' | 'visitante'; texto: string }
type Vista = 'chat' | 'ficha' | 'opciones' | 'formulario' | 'listo'

const canalDe = (modo: Modo): Canal =>
  esTotem(modo) ? 'stand' : new URLSearchParams(window.location.search).get('origen') === 'qr' ? 'qr' : modo === 'celular' ? 'celular' : 'escritorio'
const leerAsesor = () => { try { return sessionStorage.getItem(CLAVE_ASESOR) } catch { return null } }
const guardarAsesor = (id: string | null) => { try { if (id) sessionStorage.setItem(CLAVE_ASESOR, id); else sessionStorage.removeItem(CLAVE_ASESOR) } catch { /* sin almacenamiento */ } }

/** Inactividad del tótem: aviso y reinicio (sección 3: 60 y 90 s; con el formulario abierto, el doble) */
function useInactividad(activo: boolean, largo: boolean, alReiniciar: () => void) {
  const [aviso, setAviso] = useState(false)
  const refReiniciar = useRef(alReiniciar)
  refReiniciar.current = alReiniciar
  useEffect(() => {
    if (!activo) return
    const [avisar, reiniciar] = largo ? [120, 180] : [60, 90]
    let a = 0, r = 0
    const programar = () => {
      window.clearTimeout(a); window.clearTimeout(r); setAviso(false)
      a = window.setTimeout(() => setAviso(true), avisar * 1000)
      r = window.setTimeout(() => refReiniciar.current(), reiniciar * 1000)
    }
    programar()
    const eventos = ['pointerdown', 'keydown', 'input'] as const
    eventos.forEach((e) => window.addEventListener(e, programar))
    return () => { window.clearTimeout(a); window.clearTimeout(r); eventos.forEach((e) => window.removeEventListener(e, programar)) }
  }, [activo, largo])
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
  const canal = canalDe(modo)
  const [lineas, setLineas] = useState<Linea[]>(() => [{ quien: 'proli', texto: LITERAL.apertura }])
  const [vista, setVista] = useState<Vista>(agendaInicial ? 'formulario' : 'chat')
  const [accion, setAccion] = useState<Accion>('chat')
  const [token, setToken] = useState<string | null>(null)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [aprobada, setAprobada] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [asesor, setAsesor] = useState<string | null>(leerAsesor)
  const [elegirAsesor, setElegirAsesor] = useState(false)
  const [listo, setListo] = useState<{ nombre: string; email: string; franja: string | null; enCola: boolean } | null>(null)
  const refLista = useRef<HTMLDivElement>(null)

  const reiniciar = useCallback(() => {
    setLineas([{ quien: 'proli', texto: LITERAL.apertura }]); setVista('chat'); setAccion('chat'); setToken(null)
    setFicha(null); setAprobada(false); setTexto(''); setOcupado(false); setListo(null)
    // En el tótem, el asesor se identifica de nuevo para cada atención
    if (totem) { guardarAsesor(null); setAsesor(null) }
  }, [totem])
  const terminar = () => { reiniciar(); alTerminar?.() }
  const aviso = useInactividad(totem, vista === 'formulario', terminar)

  useEffect(() => { refLista.current?.scrollTo({ top: refLista.current.scrollHeight, behavior: 'smooth' }) }, [lineas, vista, ocupado])

  const decir = (l: Linea) => setLineas((x) => [...x, l])
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t || ocupado || vista !== 'chat') return
    setTexto('')
    decir({ quien: 'visitante', texto: t })
    setOcupado(true)
    try {
      const r = await enviarTurno(t, token, canal, asesor)
      setToken(r.token)
      setAccion(r.accion)
      if (r.mensaje) decir({ quien: 'proli', texto: r.mensaje })
      if (r.accion === 'ficha' && r.ficha) { setFicha(r.ficha); setVista('ficha') }
      else if (r.accion === 'agenda') setVista('formulario')
      else if (r.accion === 'cerrado' || r.accion === 'terminado') setVista('opciones')
    } catch (err) {
      // La sesión venció o no hay conexión: el formulario sigue disponible (plan B)
      if (err instanceof ErrorProli && err.codigo === 'sesion') { reiniciar(); return }
      decir({ quien: 'proli', texto: SIN_CONEXION })
      setAccion('agenda')
      setVista('formulario')
    } finally {
      setOcupado(false)
    }
  }

  const chatAbierto = vista === 'chat' && accion === 'chat'
  const nombreAsesor = asesorPorId(asesor)?.nombre

  return (
    <section className="pagina-proli__chat conversa-v9" aria-label="Conversación con Proli">
      <header className="pagina-proli__chat-cabeza">
        <span><b>Proli</b><small>{ocupado ? 'Escribiendo…' : 'Sistema inteligente de Proliferante'}</small></span>
        {totem && (
          <button type="button" className="conversa-v9__asesor" onClick={() => setElegirAsesor(true)} aria-label="Asesor que atiende">
            {nombreAsesor ? `Asesor: ${nombreAsesor.split(' ')[0]}` : 'Asesor'}
          </button>
        )}
        {lineas.length > 1 && <button type="button" className="proli-panel__nuevo" onClick={reiniciar}>Reiniciar</button>}
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
              <button type="button" className="boton boton--claro" onClick={terminar}>Terminar</button>
            </motion.div>
          )}
          {vista === 'formulario' && (
            <motion.div key="formulario" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <FormularioV9 ficha={ficha} aprobada={aprobada} asesorFijo={asesor} canal={canal} token={token}
                            alCancelar={() => setVista(ficha ? 'opciones' : accion === 'chat' ? 'chat' : 'opciones')}
                            alEnviar={(r) => { setListo(r); setVista('listo') }} />
            </motion.div>
          )}
          {vista === 'listo' && listo && (
            <motion.div key="listo" className="conversa-v9__listo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="proli-panel__linea proli-panel__linea--proli">
                {listo.franja
                  ? `¡Listo, ${listo.nombre}! Recibimos tu solicitud para ${listo.franja.charAt(0).toLowerCase()}${listo.franja.slice(1)}. El equipo te escribe a ${listo.email} para confirmar el horario: todavía no es una cita confirmada.`
                  : `¡Listo, ${listo.nombre}! Guardamos tu resumen.`}
                {listo.enCola && ' Ahora no hay conexión: tu solicitud quedó guardada y se enviará apenas vuelva.'}
              </p>
              <div className="conversa-v9__opciones">
                <button type="button" className="boton boton--claro" onClick={alDemos}>Ver los demos</button>
                <button type="button" className="boton boton--violeta" onClick={terminar}>Terminar</button>
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

/** Contacto, asesor, franja y consentimientos (secciones 5, 6.1 y 9) */
function FormularioV9({ ficha, aprobada, asesorFijo, canal, token, alCancelar, alEnviar }: {
  ficha: Ficha | null; aprobada: boolean; asesorFijo: string | null; canal: Canal; token: string | null
  alCancelar: () => void
  alEnviar: (r: { nombre: string; email: string; franja: string | null; enCola: boolean }) => void
}) {
  const [clave] = useState(nuevaClave)
  const [f, setF] = useState({
    nombre: '', organizacion: ficha?.organizacion ?? '', email: '', cargo: ficha?.rol ?? '', celular: '',
    proposito: ficha?.objetivo ?? '', franja: '', modalidad: 'meet' as 'meet' | 'presencial',
    asesor: asesorFijo ?? '', gestionar: false, conservar: false, comunicaciones: false,
  })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const cambiar = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const presencialPosible = f.franja !== '' && !f.franja.startsWith('Después')

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.nombre.trim() || !f.organizacion.trim()) return setError('Escribe tu nombre y tu organización.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return setError('Revisa tu correo: lo necesitamos para enviarte la invitación.')
    if (!f.franja) return setError('Elige cuándo te queda mejor.')
    if (!f.asesor) return setError('Cuéntanos con quién conversaste, o elige «No recuerdo».')
    if (!f.gestionar) return setError('Para agendar necesitamos tu autorización para gestionar la cita.')
    setError(''); setEnviando(true)
    try {
      const estado = await registrar({
        token, canal, clave,
        contacto: { nombre: f.nombre.trim(), organizacion: f.organizacion.trim(), email: f.email.trim(), cargo: f.cargo.trim(), celular: f.celular.trim() },
        consentimientos: { gestionar_cita: f.gestionar, conservar_ficha: f.conservar, comunicaciones_comerciales: f.comunicaciones },
        asesor: f.asesor,
        ficha: ficha ? { ...ficha, aprobada } : null,
        agenda: { proposito: f.proposito.trim(), franja: f.franja, modalidad: presencialPosible ? f.modalidad : 'meet' },
      })
      alEnviar({ nombre: f.nombre.trim().split(' ')[0], email: f.email.trim(), franja: f.franja, enCola: estado === 'en_cola' })
    } catch (err) {
      const campo = err instanceof ErrorProli ? err.campo : undefined
      setError(campo === 'email' ? 'Revisa tu correo.' : campo ? 'Revisa los datos del formulario.' : 'No pudimos enviar tu solicitud. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="formulario-v9" onSubmit={enviar} noValidate>
      <b className="ficha-v9__titulo">Agenda 20 minutos con el equipo</b>
      <label>Nombre<input value={f.nombre} onChange={(e) => cambiar('nombre', e.target.value)} maxLength={120} autoComplete="name" required /></label>
      <label>Organización<input value={f.organizacion} onChange={(e) => cambiar('organizacion', e.target.value)} maxLength={160} autoComplete="organization" required /></label>
      <label>Correo<input type="email" value={f.email} onChange={(e) => cambiar('email', e.target.value)} maxLength={254} autoComplete="email" inputMode="email" required /></label>
      <div className="formulario-v9__fila">
        <label>Cargo <small>(opcional)</small><input value={f.cargo} onChange={(e) => cambiar('cargo', e.target.value)} maxLength={120} autoComplete="organization-title" /></label>
        <label>Celular <small>(opcional)</small><input value={f.celular} onChange={(e) => cambiar('celular', e.target.value)} maxLength={30} autoComplete="tel" inputMode="tel" /></label>
      </div>
      <label>¿De qué te gustaría hablar?<textarea value={f.proposito} onChange={(e) => cambiar('proposito', e.target.value)} maxLength={500} rows={2} /></label>

      <fieldset>
        <legend>¿Cuándo te queda mejor?</legend>
        {FRANJAS.map((x) => (
          <label key={x} className="formulario-v9__opcion">
            <input type="radio" name="franja" checked={f.franja === x} onChange={() => cambiar('franja', x)} />{x}
          </label>
        ))}
        {presencialPosible && (
          <div className="formulario-v9__modalidad">
            <label className="formulario-v9__opcion"><input type="radio" name="modalidad" checked={f.modalidad === 'meet'} onChange={() => cambiar('modalidad', 'meet')} />Virtual (Google Meet)</label>
            <label className="formulario-v9__opcion"><input type="radio" name="modalidad" checked={f.modalidad === 'presencial'} onChange={() => cambiar('modalidad', 'presencial')} />Presencial, en el stand</label>
          </div>
        )}
        <small>El equipo te confirma el horario exacto por correo.</small>
      </fieldset>

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

      <fieldset className="formulario-v9__permisos">
        <label className="formulario-v9__opcion"><input type="checkbox" checked={f.gestionar} onChange={(e) => cambiar('gestionar', e.target.checked)} />Autorizo a Proliferante a usar estos datos para gestionar esta cita.</label>
        {ficha && <label className="formulario-v9__opcion"><input type="checkbox" checked={f.conservar} onChange={(e) => cambiar('conservar', e.target.checked)} />Autorizo conservar mi resumen para preparar la conversación (opcional).</label>}
        <label className="formulario-v9__opcion"><input type="checkbox" checked={f.comunicaciones} onChange={(e) => cambiar('comunicaciones', e.target.checked)} />Quiero recibir información de Proliferante (opcional).</label>
        <small>Puedes leer el <AvisoPrivacidad etiqueta="aviso de privacidad" /> y retirar tu permiso cuando quieras.</small>
      </fieldset>

      {error && <p className="formulario-v9__error" role="alert">{error}</p>}
      <div className="conversa-v9__opciones">
        <button type="submit" className="boton boton--violeta" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</button>
        <button type="button" className="boton boton--claro" onClick={alCancelar} disabled={enviando}>Volver</button>
      </div>
    </form>
  )
}
