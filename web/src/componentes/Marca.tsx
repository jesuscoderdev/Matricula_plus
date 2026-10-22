import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { APP_NAME, EMPRESA, SEGUNDOS_ANIMACION_LOGO, SEGUNDOS_REINICIO_LOGO } from '../config'
import logoLetras from '../assets/logo-proliferante-letras.webp'
import logoO from '../assets/logo-proliferante-o.webp'
import iconoProliferante from '../assets/icono-proliferante.webp'
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

/** Nombre de un proyecto ("Matrícula", "Movilidad"…) + la cruz violeta en alto. */
export function NombreApp({ className = '', nombre = APP_NAME }: { className?: string; nombre?: string }) {
  const termina = nombre.endsWith('+')
  return (
    <span className={`marca-app ${className}`}>
      {termina ? nombre.slice(0, -1) : nombre}
      {termina && <span className="marca-app__mas"><Cruz /></span>}
    </span>
  )
}

/**
 * Icono de un proyecto: la letra sobre cuadro redondeado con la cruz arriba a la derecha.
 * Variante "tinta" (Matrícula+: fondo tinta, cruz violeta) o "violeta" (Movilidad+: fondo violeta,
 * letra y cruz en crema), con la misma paleta.
 */
export function IconoApp({ claro = false, className = '', nombre = APP_NAME, letra = 'M', variante = 'tinta' }: {
  claro?: boolean; className?: string; nombre?: string; letra?: string; variante?: 'tinta' | 'violeta'
}) {
  return (
    <svg className={`icono-app icono-app--${variante} ${claro ? 'icono-app--claro' : ''} ${className}`} viewBox="0 0 100 100" role="img" aria-label={nombre}>
      <rect className="icono-app__fondo" width="100" height="100" rx="21" />
      <text className="icono-app__m" x="45" y="75" textAnchor="middle">{letra}</text>
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
export function NombreAnimado({ cargando = false, nombre = APP_NAME }: { cargando?: boolean; nombre?: string }) {
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
  const termina = nombre.endsWith('+')
  const palabra = termina ? nombre.slice(0, -1) : nombre
  const medio = [...palabra.slice(1)]
  return (
    <span className="marca-app marca-app--animada" aria-label={nombre}>
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
 * también reinicia el demo (para el personal del stand, en el tótem); con `alReiniciarTodo`,
 * el reinicio largo vuelve a la página de inicio (elegir proyecto).
 */
export function LogoReinicio({ alReiniciar, alReiniciarTodo, nombre = APP_NAME }: {
  alReiniciar: () => void; alReiniciarTodo?: () => void; nombre?: string
}) {
  const t = useRef<number | undefined>(undefined)
  const largo = useRef(false)   // el toque largo ya reinició: el clic que sigue no cuenta
  const [cargando, setCargando] = useState(false)
  const soltar = () => { window.clearTimeout(t.current); setCargando(false) }
  return (
    <button
      type="button"
      className={`logo-reinicio ${cargando ? 'logo-reinicio--cargando' : ''}`}
      style={{ ['--seg' as string]: `${SEGUNDOS_REINICIO_LOGO}s` }}
      title="Volver al inicio"
      onClick={() => { if (!largo.current) alReiniciar(); largo.current = false }}
      onPointerDown={() => {
        setCargando(true)
        largo.current = false
        t.current = window.setTimeout(() => { setCargando(false); largo.current = true; (alReiniciarTodo ?? alReiniciar)() }, SEGUNDOS_REINICIO_LOGO * 1000)
      }}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
    >
      <NombreAnimado nombre={nombre} />
    </button>
  )
}

// El logo partido en letras (píxeles de la imagen de 400 × 121): desde, hasta, centro de la letra (x, y)
// y orden de nacimiento, de la más cercana a la «o» verde a la más lejana. La «o» va en su propia imagen.
const LOGO_ANCHO = 400, LOGO_ALTO = 121
const TROZOS: [number, number, number, number, number][] = [
  [0, 43, 18.3, 47.7, 4], [43, 120, 70.5, 50.8, 1], [120, 139, 128.2, 35.6, 0], [139, 157, 148.6, 57.5, 2],
  [157, 185, 168.7, 71.1, 3], [185, 216, 198.1, 44.6, 5], [216, 254, 234.4, 42.4, 6], [254, 296, 274.3, 46.5, 7],
  [296, 336, 316.0, 40.0, 8], [336, 361, 348.3, 33.1, 9], [361, 400, 377.2, 40.6, 10],
]
const PASO_NACIMIENTO = 0.07  // s entre una letra y la siguiente

/**
 * Logo oficial de Proliferante (empaquetado, funciona sin conexión). Animado, como algo que prolifera:
 * aparece la «o» verde, de ella salen puntitos y cada puntito florece en una letra; al rato las letras
 * vuelven a ser puntitos, regresan a la «o» y la hacen brillar, y el ciclo empieza otra vez.
 * Con "reducir movimiento" queda quieto y completo.
 */
export function LogoEmpresa({ className = '', animado = true }: { className?: string; animado?: boolean }) {
  if (!animado) {
    // Letras y «o» en capas, como el animado: así en oscuro las letras pasan a blanco y la «o» sigue verde
    return (
      <span className={`logo-empresa logo-empresa--quieto ${className}`} role="img" aria-label={EMPRESA}>
        <img className="logo-letras" src={logoLetras} alt="" draggable={false} />
        <img className="logo-o" src={logoO} alt="" draggable={false} />
      </span>
    )
  }
  const pct = (x: number, total: number) => `${(x / total) * 100}%`
  return (
    <span className={`logo-empresa logo-empresa--vivo ${className}`} role="img" aria-label={EMPRESA}>
      {TROZOS.map(([x0, x1, cx, cy, k]) => (
        <i key={x0} className="logo-trozo" aria-hidden style={{
          left: pct(x0, LOGO_ANCHO), width: pct(x1 - x0, LOGO_ANCHO), backgroundImage: `url(${logoLetras})`,
          backgroundSize: `${(LOGO_ANCHO / (x1 - x0)) * 100}% 100%`, backgroundPosition: `${(x0 / (LOGO_ANCHO - (x1 - x0))) * 100}% 0`,
          '--cx': pct(cx - x0, x1 - x0), '--cy': pct(cy, LOGO_ALTO), '--d': `${k * PASO_NACIMIENTO}s`,
        } as CSSProperties} />
      ))}
      <img className="logo-o" src={logoO} alt="" draggable={false} />
      {TROZOS.map(([x0, , cx, cy, k]) => (
        <i key={`p${x0}`} className="logo-punto" aria-hidden
           style={{ '--x': pct(cx, LOGO_ANCHO), '--y': pct(cy, LOGO_ALTO), '--d': `${k * PASO_NACIMIENTO}s` } as CSSProperties} />
      ))}
    </span>
  )
}

/**
 * Marca de agua: el ícono de Proliferante en transparencia, como las cifras gigantes de fondo del
 * manual de marca. Decorativa; el color y la opacidad salen del tema.
 */
export function MarcaDeAgua({ className = '' }: { className?: string }) {
  return <span className={`marca-agua ${className}`} aria-hidden style={{ ['--icono' as string]: `url(${iconoProliferante})` }} />
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

/** Botón "← Inicio": vuelve a la página de inicio (elegir proyecto). */
export function BotonInicio({ alInicio, etiqueta = 'Volver al inicio (elegir proyecto)' }: { alInicio: () => void; etiqueta?: string }) {
  return (
    <button type="button" className="boton-tema boton-atras boton-inicio" onClick={(e) => { e.stopPropagation(); alInicio() }}
            title="Volver al inicio" aria-label={etiqueta}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
    </button>
  )
}
