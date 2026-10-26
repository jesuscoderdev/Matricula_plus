import { useState, type FormEvent } from 'react'
import Proli from '../componentes/Proli'
import QrCita from '../componentes/QrCita'
import { AGENDA_CITA, APP_NAME, EMPRESA, WHATSAPP_CITA, whatsappCon } from '../config'
import { esTotem } from '../modo'
import type { PropsCapitulo } from './tipos'

/**
 * Agendar una cita, sin backend. Primero el calendario: la página de reservas de Google Calendar de
 * Proliferante, donde el visitante elige fecha y hora y la cita queda en el calendario con Google
 * Meet. Segunda opción, WhatsApp: el formulario arma el mensaje que el visitante envía desde su
 * celular y, después, la app le ofrece igual la página de reservas para que la cita quede agendada.
 */
export default function Agendar({ modo }: PropsCapitulo) {
  const [f, setF] = useState({ nombre: '', entidad: '', cargo: '', mensaje: '' })
  const [enviado, setEnviado] = useState(false)
  const cambiar = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const abrirAgenda = () => window.open(AGENDA_CITA, '_blank', 'noopener')
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const texto = [
      `Hola ${EMPRESA}, vi la demo ${APP_NAME} en el GovTech Summit y quiero agendar una reunión.`,
      `Nombre: ${f.nombre}`,
      f.entidad && `Entidad: ${f.entidad}`,
      f.cargo && `Cargo: ${f.cargo}`,
      f.mensaje && `Mensaje: ${f.mensaje}`,
    ].filter(Boolean).join('\n')
    window.open(whatsappCon(texto), '_blank', 'noopener')
    setEnviado(true)
  }
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">Hablemos</span>
        <h1 className="display">Llévalo a <em>tu entidad</em></h1>
        <p className="lead">Cuéntanos tu reto y buscamos juntos cómo resolverlo. <span className="acento">Este demo se hizo con datos abiertos; imagina lo que podemos hacer con los de tu entidad.</span></p>
      </header>
      {esTotem(modo) ? <QrCita /> : AGENDA_CITA && (
        <div className="agenda">
          <button className="boton boton--violeta boton--ancho" onClick={abrirAgenda}>Elige fecha y hora →</button>
          <p className="nota">Treinta minutos por videollamada. La invitación te llega al correo con el enlace de Google Meet.</p>
        </div>
      )}
      {!esTotem(modo) && WHATSAPP_CITA && (enviado ? (
        <div className="tarjeta tarjeta--violeta">
          <b>¡Listo! Te respondemos por WhatsApp.</b>
          {AGENDA_CITA && <>
            <span className="nota">Para no esperar, elige ya la fecha y hora de la cita:</span>
            <button className="boton boton--violeta" onClick={abrirAgenda}>Elegir fecha y hora →</button>
          </>}
        </div>
      ) : (
        <form className="formulario" onSubmit={enviar}>
          {AGENDA_CITA && <span className="etiqueta">¿Prefieres escribirnos?</span>}
          <label>Nombre<input required value={f.nombre} onChange={cambiar('nombre')} autoComplete="name" /></label>
          <label>Entidad<input value={f.entidad} onChange={cambiar('entidad')} autoComplete="organization" /></label>
          <label>Cargo<input value={f.cargo} onChange={cambiar('cargo')} autoComplete="organization-title" /></label>
          <label>Mensaje (opcional)<textarea rows={3} value={f.mensaje} onChange={cambiar('mensaje')} /></label>
          <button className={`boton ${AGENDA_CITA ? 'boton--claro' : ''}`} type="submit">Enviar por WhatsApp</button>
          <p className="nota">No guardamos tus datos: el mensaje sale desde tu WhatsApp.</p>
        </form>
      ))}
      {!AGENDA_CITA && !WHATSAPP_CITA && <p className="nota">Pronto podrás agendar aquí una cita con el equipo de {EMPRESA}.</p>}
      <Proli tamano={5} globo={<>Hola, soy <b>Proli</b>. ¡Cuéntanos tu reto!</>} />
    </div>
  )
}
