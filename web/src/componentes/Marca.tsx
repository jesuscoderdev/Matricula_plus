import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { APP_NAME, EMPRESA, SEGUNDOS_ANIMACION_LOGO, SEGUNDOS_REINICIO_LOGO } from '../config'
import logoProliferante from '../assets/logo-proliferante.webp'

// Ritmo del logo de la cabecera: "Matrícula+" un rato, se agrupa en "M+", se queda así otro rato
// y se abre de nuevo (cada SEGUNDOS_ANIMACION_LOGO)
const SEG_ABIERTO = SEGUNDOS_ANIMACION_LOGO
const SEG_COMPACTO = SEGUNDOS_ANIMACION_LOGO
const PASO_LETRA = 0.045

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
 * El nombre que "respira": las letras entre la M y el + se recogen hacia la M hasta dejar "M+",
 * y luego se vuelven a abrir. Con "reducir movimiento" queda fijo.
 */
function NombreAnimado() {
  const reducir = useReducedMotion()
  const [compacto, setCompacto] = useState(false)
  useEffect(() => {
    if (reducir) return
    const id = window.setTimeout(() => setCompacto((c) => !c), (compacto ? SEG_COMPACTO : SEG_ABIERTO) * 1000)
    return () => window.clearTimeout(id)
  }, [compacto, reducir])
  const termina = APP_NAME.endsWith('+')
  const palabra = termina ? APP_NAME.slice(0, -1) : APP_NAME
  const medio = [...palabra.slice(1)]
  return (
    <span className="marca-app" aria-label={APP_NAME}>
      <span aria-hidden>{palabra[0]}</span>
      {medio.map((l, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="marca-app__letra"
          initial={false}
          animate={compacto
            ? { width: 0, opacity: 0, x: '-0.4em', filter: 'blur(3px)' }
            : { width: 'auto', opacity: 1, x: 0, filter: 'blur(0px)' }}
          // Al cerrar se recogen desde el + hacia la M; al abrir salen desde la M
          transition={{ duration: 0.38, ease: [0.65, 0, 0.35, 1], delay: (compacto ? medio.length - 1 - i : i) * PASO_LETRA }}
        >
          {l}
        </motion.span>
      ))}
      {termina && (
        <motion.span aria-hidden className="marca-app__mas" initial={false}
                     animate={compacto ? { scale: [1, 1.25, 1], rotate: 90 } : { scale: [1, 1.25, 1], rotate: 0 }}
                     transition={{ duration: 0.5, delay: compacto ? medio.length * PASO_LETRA : 0 }}>
          +
        </motion.span>
      )}
    </span>
  )
}

/**
 * Logo de la cabecera. Un toque lleva al inicio (portada). Mantenerlo presionado N segundos
 * también reinicia el demo (para el personal del stand, en el tótem).
 */
export function LogoReinicio({ alReiniciar }: { alReiniciar: () => void }) {
  const t = useRef<number | undefined>(undefined)
  const [cargando, setCargando] = useState(false)
  const soltar = () => { window.clearTimeout(t.current); setCargando(false) }
  return (
    <button
      type="button"
      className={`logo-reinicio ${cargando ? 'logo-reinicio--cargando' : ''}`}
      style={{ ['--seg' as string]: `${SEGUNDOS_REINICIO_LOGO}s` }}
      title="Volver al inicio"
      onClick={alReiniciar}
      onPointerDown={() => {
        setCargando(true)
        t.current = window.setTimeout(() => { setCargando(false); alReiniciar() }, SEGUNDOS_REINICIO_LOGO * 1000)
      }}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
    >
      <NombreAnimado />
    </button>
  )
}

/** Logo oficial de Proliferante (empaquetado, funciona sin conexión). */
export function LogoEmpresa({ className = '' }: { className?: string }) {
  return <img className={`logo-empresa ${className}`} src={logoProliferante} alt={EMPRESA} draggable={false} />
}
