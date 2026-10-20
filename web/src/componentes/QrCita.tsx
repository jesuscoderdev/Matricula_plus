import { useState } from 'react'
import Qr from './Qr'
import { MOSTRAR_QR_GENERADO, QR_IMAGEN, URL_CITA } from '../config'

/**
 * QR para agendar cita. Usa la imagen configurable (QR_IMAGEN en public/); si no existe,
 * genera uno local con URL_CITA cuando MOSTRAR_QR_GENERADO está activo; si no, un recuadro de aviso.
 */
export default function QrCita() {
  const [sinImagen, setSinImagen] = useState(!QR_IMAGEN)
  if (!sinImagen) {
    return (
      <figure className="qr">
        <img className="qr__img" src={QR_IMAGEN} alt="Código QR para agendar una cita" onError={() => setSinImagen(true)} />
        <figcaption>Escanea para agendar una cita</figcaption>
      </figure>
    )
  }
  if (MOSTRAR_QR_GENERADO) return <Qr texto={URL_CITA} etiqueta="Escanea para agendar una cita" />
  return (
    <figure className="qr">
      <div className="qr__img qr__img--pendiente">QR<br /><small>configura QR_IMAGEN</small></div>
      <figcaption>Agenda una cita con nuestro equipo</figcaption>
    </figure>
  )
}
