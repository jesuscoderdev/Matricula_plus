import { useRef, useState } from 'react'
import { APP_NAME, EMPRESA, SEGUNDOS_REINICIO_LOGO } from '../config'

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
 * Logo con botón OCULTO de reinicio: mantenerlo presionado N segundos reinicia el demo
 * (para el personal del stand). Un toque normal no hace nada.
 */
export function LogoReinicio({ alReiniciar }: { alReiniciar: () => void }) {
  const t = useRef<number | undefined>(undefined)
  const [cargando, setCargando] = useState(false)
  const soltar = () => { window.clearTimeout(t.current); setCargando(false) }
  return (
    <span
      className={`logo-reinicio ${cargando ? 'logo-reinicio--cargando' : ''}`}
      style={{ ['--seg' as string]: `${SEGUNDOS_REINICIO_LOGO}s` }}
      onPointerDown={() => {
        setCargando(true)
        t.current = window.setTimeout(() => { setCargando(false); alReiniciar() }, SEGUNDOS_REINICIO_LOGO * 1000)
      }}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
    >
      <NombreApp />
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
