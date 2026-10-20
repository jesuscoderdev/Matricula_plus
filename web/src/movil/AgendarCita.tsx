import { useState, type FormEvent } from 'react'
import BotonGrande from '../componentes/BotonGrande'
import Proli from '../componentes/Proli'
import { APP_NAME, CALENDLY_CITA, EMPRESA, whatsappCon } from '../config'

/**
 * "Agendar cita". No hay backend: el formulario arma un mensaje de WhatsApp que
 * el visitante envía desde su celular. Si hay enlace de Calendly, se ofrece ese.
 */
export default function AgendarCita() {
  const [f, setF] = useState({ nombre: '', entidad: '', cargo: '', mensaje: '' })
  const cambiar = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const texto = [
      `Hola ${EMPRESA}, vi la demo de ${APP_NAME} y quiero agendar una cita.`,
      `Nombre: ${f.nombre}`,
      f.entidad && `Entidad: ${f.entidad}`,
      f.cargo && `Cargo: ${f.cargo}`,
      f.mensaje && `Mensaje: ${f.mensaje}`,
    ].filter(Boolean).join('\n')
    window.open(whatsappCon(texto), '_blank', 'noopener')
  }

  return (
    <div className="pantalla">
      <header className="pantalla__cabeza">
        <Proli tamano={5} globo={<>Hola, soy <b>Proli</b> de Proliferante.</>} />
        <span className="kicker">Hablemos</span>
        <h1 className="titulo titulo--chico">Agendar una cita</h1>
        <p className="subtitulo">Te mostramos {APP_NAME} con los datos de tu entidad.</p>
      </header>

      {CALENDLY_CITA && (
        <section className="bloque">
          <BotonGrande onClick={() => window.open(CALENDLY_CITA, '_blank', 'noopener')}>Elegir fecha y hora</BotonGrande>
          <div className="separador">o escríbenos por WhatsApp</div>
        </section>
      )}

      <form className="bloque formulario" onSubmit={enviar}>
        <label>Nombre<input required value={f.nombre} onChange={cambiar('nombre')} autoComplete="name" /></label>
        <label>Entidad<input value={f.entidad} onChange={cambiar('entidad')} autoComplete="organization" /></label>
        <label>Cargo<input value={f.cargo} onChange={cambiar('cargo')} autoComplete="organization-title" /></label>
        <label>Mensaje (opcional)<textarea rows={3} value={f.mensaje} onChange={cambiar('mensaje')} /></label>
        <button className="boton boton--primario" type="submit">Enviar por WhatsApp</button>
        <p className="supuesto">No guardamos tus datos: el mensaje sale desde tu WhatsApp.</p>
      </form>
    </div>
  )
}
