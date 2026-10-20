import { useState } from 'react'
import { APP_NAME, EMPRESA } from '../config'

/** Nombre de la app: "Matrícula" + el "+" en color de acento. */
export function NombreApp({ className = '' }: { className?: string }) {
  const termina = APP_NAME.endsWith('+')
  return (
    <span className={`nombre-app ${className}`}>
      {termina ? APP_NAME.slice(0, -1) : APP_NAME}
      {termina && <span className="nombre-app__mas">+</span>}
    </span>
  )
}

/**
 * Logo de la empresa. Si existe public/logo-proliferante.svg se usa;
 * si no, se muestra el nombre como marca tipográfica.
 */
export function LogoEmpresa() {
  const [sinImagen, setSinImagen] = useState(false)
  if (sinImagen) return <span className="logo-texto">{EMPRESA.toLowerCase()}</span>
  return <img className="logo-img" src="./logo-proliferante.svg" alt={EMPRESA} onError={() => setSinImagen(true)} />
}
