import { useRef, useState } from 'react'
import { APP_NAME, EMPRESA, SEGUNDOS_REINICIO_LOGO } from '../config'
import logoProliferante from '../assets/logo-proliferante.webp'

/** Nombre de la app: "Matrícula" en Fraunces + el "+" en violeta. */
export function NombreApp({ className = '' }: { className?: string }) {
  const termina = APP_NAME.endsWith('+')
  return (
    <span className={`marca-app ${className}`}>
      {termina ? APP_NAME.slice(0, -1) : APP_NAME}
      {termina && <span className="marca-app__mas">+</span>}
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

/** Logo oficial de Proliferante (empaquetado, funciona sin conexión). */
export function LogoEmpresa({ className = '' }: { className?: string }) {
  return <img className={`logo-empresa ${className}`} src={logoProliferante} alt={EMPRESA} draggable={false} />
}
