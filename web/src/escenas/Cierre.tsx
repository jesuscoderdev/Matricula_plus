import BotonGrande from '../componentes/BotonGrande'
import { LogoEmpresa, NombreApp } from '../componentes/Marca'
import Qr from '../componentes/Qr'
import { MOSTRAR_QR, URL_APP, URL_CITA } from '../config'
import { esTotem } from '../modo'
import type { PropsEscena } from './tipos'

/** URL pública de la app sin parámetros (para el QR). */
const urlApp = () => URL_APP || window.location.origin + window.location.pathname

/** Paso 6: logo, QR a la app (si está activo) y agendar una cita. */
export default function Cierre({ ir, modo, alAgendar }: PropsEscena) {
  const totem = esTotem(modo)
  return (
    <div className="escena escena--opaca escena--centrada">
      <div className="cierre">
        <LogoEmpresa />
        <h1 className="titulo">Datos abiertos que se vuelven decisiones.</h1>
        {MOSTRAR_QR ? (
          <div className="cierre__qrs">
            <Qr texto={urlApp()} etiqueta={<>Lleva <NombreApp /> en tu celular</>} />
            {/* En el tótem no se abren enlaces externos: la cita también va por QR */}
            {totem && <Qr texto={URL_CITA} etiqueta="Agenda una cita" />}
          </div>
        ) : (
          totem && <div className="cierre__cta">¿Quieres verlo con tus datos?<br /><b>Habla con nuestro equipo aquí en el stand.</b></div>
        )}
      </div>
      <footer className="abajo">
        {!totem && <BotonGrande onClick={alAgendar}>Agendar una cita</BotonGrande>}
        {modo !== 'auto' && (
          <BotonGrande variante="secundario" onClick={() => ir('espera')}>Volver a empezar</BotonGrande>
        )}
      </footer>
    </div>
  )
}
