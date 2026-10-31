import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AVISO_PRIVACIDAD } from '../../api/_proli/privacidad'
import { HojaRecorrido } from './Recorrido'

/**
 * El enlace «Aviso de privacidad» junto al QR de la cita. Abre el aviso en una hoja dentro de la página
 * (en el tótem no se puede salir a otro sitio). Va en un portal: el QR también vive dentro del panel de
 * Proli, que se oculta mientras hay una hoja abierta.
 */
export default function AvisoPrivacidad({ etiqueta = 'Aviso de privacidad' }: { etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false)
  if (AVISO_PRIVACIDAD.length === 0) return null
  return (
    <>
      <button type="button" className="qr__aviso" onClick={() => setAbierto(true)}>{etiqueta}</button>
      {createPortal(
        <HojaRecorrido abierta={abierto} cerrar={() => setAbierto(false)}>
          <h2 className="aviso__titulo">Aviso de privacidad</h2>
          <dl className="metodo-mov">
            {AVISO_PRIVACIDAD.map((s) => <div key={s.titulo}><dt>{s.titulo}</dt><dd>{s.texto}</dd></div>)}
          </dl>
          <button type="button" className="boton boton--violeta boton--ancho" onClick={() => setAbierto(false)}>Entendido</button>
        </HojaRecorrido>,
        document.body,
      )}
    </>
  )
}
