import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { APP_NAME, EMPRESA, SEGUNDOS_ANIMACION_LOGO, SEGUNDOS_REINICIO_LOGO } from '../config'
import logoProliferante from '../assets/logo-proliferante.webp'
import { alternarTema, useTema } from '../tema'

// Ritmo del logo de la cabecera: "Matrícula+" un rato, se agrupa en "M+", se queda así otro rato
// y se abre de nuevo (cada SEGUNDOS_ANIMACION_LOGO)
const SEG_ABIERTO = SEGUNDOS_ANIMACION_LOGO
const SEG_COMPACTO = SEGUNDOS_ANIMACION_LOGO
const PASO_LETRA = 0.045

/** El "+" de la marca: cruz de brazos redondeados (no el carácter "+", que cambia con la fuente). */
export function Cruz() {
  return (
    <svg className="cruz" viewBox="0 0 7.2 7.2" aria-hidden>
      <path d="M3.6 1.3V5.9M1.3 3.6H5.9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

/** Nombre de la app: "Matrícula" en Fraunces + la cruz violeta en alto. */
export function NombreApp({ className = '' }: { className?: string }) {
  const termina = APP_NAME.endsWith('+')
  return (
    <span className={`marca-app ${className}`}>
      {termina ? APP_NAME.slice(0, -1) : APP_NAME}
      {termina && <span className="marca-app__mas"><Cruz /></span>}
    </span>
  )
}

/** Icono de la app: "M" sobre cuadro redondeado con la cruz violeta arriba a la derecha. */
export function IconoApp({ claro = false, className = '' }: { claro?: boolean; className?: string }) {
  return (
    <svg className={`icono-app ${claro ? 'icono-app--claro' : ''} ${className}`} viewBox="0 0 100 100" role="img" aria-label={APP_NAME}>
      <rect className="icono-app__fondo" width="100" height="100" rx="21" />
      <text className="icono-app__m" x="45" y="75" textAnchor="middle">M</text>
      <path className="icono-app__cruz" d="M75.3 16.6V32M67.6 24.3H83" strokeWidth="8.7" strokeLinecap="round" />
    </svg>
  )
}

// Pulso del logo como cargador: cualquier parte de la app lo dispara cuando algo se recalcula o carga
const eventos = new EventTarget()
export const pulsoLogo = () => eventos.dispatchEvent(new Event('pulso'))
const MS_PULSO = 900

/**
 * El nombre que "respira": las letras entre la M y el + se recogen hacia la M hasta dejar "M+",
 * y luego se vuelven a abrir. Sirve también de cargador (pulsoLogo) y, con `cargando`, late en
 * bucle rápido. "M+" queda centrado en el espacio del nombre completo (una copia invisible
 * reserva el ancho). Con "reducir movimiento" queda fijo.
 */
export function NombreAnimado({ cargando = false }: { cargando?: boolean }) {
  const reducir = useReducedMotion()
  const [compacto, setCompacto] = useState(false)
  const [pulso, setPulso] = useState(0)
  useEffect(() => {
    const alPulso = () => setPulso((x) => x + 1)
    eventos.addEventListener('pulso', alPulso)
    return () => eventos.removeEventListener('pulso', alPulso)
  }, [])
  useEffect(() => {
    if (!pulso || reducir) return
    setCompacto(true)
    const id = window.setTimeout(() => setCompacto(false), MS_PULSO)
    return () => window.clearTimeout(id)
  }, [pulso, reducir])
  useEffect(() => {
    if (reducir) return
    const seg = cargando ? 0.9 : compacto ? SEG_COMPACTO : SEG_ABIERTO
    const id = window.setTimeout(() => setCompacto((c) => !c), seg * 1000)
    return () => window.clearTimeout(id)
  }, [compacto, reducir, cargando])
  const termina = APP_NAME.endsWith('+')
  const palabra = termina ? APP_NAME.slice(0, -1) : APP_NAME
  const medio = [...palabra.slice(1)]
  return (
    <span className="marca-app marca-app--animada" aria-label={APP_NAME}>
      <span className="marca-app__molde" aria-hidden>{palabra}{termina && <span className="marca-app__mas"><Cruz /></span>}</span>
      <span className="marca-app__vivo" aria-hidden>
        <span>{palabra[0]}</span>
        {medio.map((l, i) => (
          <motion.span
            key={i}
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
          <motion.span className="marca-app__mas" initial={false}
                       // En "M+" la cruz se pega a la esquina de la M, como en el icono
                       animate={compacto ? { scale: [1, 1.25, 1], rotate: 90, x: '-0.16em' } : { scale: [1, 1.25, 1], rotate: 0, x: 0 }}
                       transition={{ duration: 0.5, delay: compacto ? medio.length * PASO_LETRA : 0 }}>
            <Cruz />
          </motion.span>
        )}
      </span>
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

/** Botón ☾/☀: cambia entre modo claro y oscuro (por defecto sigue al sistema). */
export function BotonTema() {
  const tema = useTema()
  const oscuro = tema === 'oscuro'
  return (
    <button type="button" className="boton-tema" onClick={(e) => { e.stopPropagation(); alternarTema() }}
            title={oscuro ? 'Modo claro' : 'Modo oscuro'} aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
      {oscuro ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  )
}
