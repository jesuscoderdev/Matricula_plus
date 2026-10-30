/**
 * «Cómo lo hicimos» de los dos demos: los datos se convierten en un sistema vivo. Líneas de código,
 * cálculos y datos llegan volando al centro (1 · Datos), se concentran hasta explotar (2 · Modelo) y,
 * justo con la explosión, sale el mapa de Bogotá con el resultado (3 · Decisión); dos segundos después
 * aparece Proli en el centro, crece poco a poco y saluda una y otra vez. Cada demo pone sus
 * fragmentos (con cifras de sus datos), sus leyendas y los puntos de su mapa.
 * Con «reducir movimiento» se ve directamente el final.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import ProliAnimado from './ProliAnimado'
import { SALUDO_S } from './proliGeometria'

type Fase = 'datos' | 'modelo' | 'mapa' | 'proli'
// El mapa sale justo con la explosión; dos segundos después, Proli en el centro de Bogotá
const TIEMPOS: [Fase, number][] = [['modelo', 3.2], ['mapa', 4.2], ['proli', 5.2]]
const ANCHO = 100

export type TipoFragmento = 'codigo' | 'mate' | 'dato'
/** Un punto del mapa: `clase` le da el color (cerca, lejos, tenue, elegida) */
export interface PuntoMapa { lon: number; lat: number; clase: 'cerca' | 'lejos' | 'tenue' | 'elegida' }
type Bbox = [[number, number], [number, number]]

/** Un fragmento por cada ángulo alrededor del centro: entra desde el borde y se apaga al llegar */
function Fragmento({ texto, tipo, k, n }: { texto: string; tipo: TipoFragmento; k: number; n: number }) {
  const a = (2 * Math.PI * k) / n + (k % 2 ? 0.25 : -0.15)
  const r = 62 + (k % 3) * 9
  return (
    <motion.span className={`sistema__frag sistema__frag--${tipo}`}
                 initial={{ x: `${Math.cos(a) * r}cqw`, y: `${Math.sin(a) * r * 0.9}cqh`, opacity: 0, scale: 1.05 }}
                 animate={{ x: '0cqw', y: '0cqh', opacity: [0, 1, 1, 0], scale: 0.35 }}
                 transition={{ duration: 2.4, delay: (k * 0.11) % 1.1, ease: [0.45, 0, 0.75, 1], opacity: { times: [0, 0.15, 0.8, 1], duration: 2.4, delay: (k * 0.11) % 1.1 } }}>
      {texto}
    </motion.span>
  )
}

/** El mapa: las localidades y los puntos, proyectados al recuadro */
function MapaBogota({ bbox, anillos, puntos }: { bbox: Bbox; anillos: [number, number][][]; puntos: PuntoMapa[] }) {
  const [[x0, y0], [x1, y1]] = bbox
  const coslat = Math.cos((((y0 + y1) / 2) * Math.PI) / 180)
  const alto = (ANCHO * (y1 - y0)) / ((x1 - x0) * coslat)
  const px = (lon: number) => ((lon - x0) / (x1 - x0)) * ANCHO
  const py = (lat: number) => ((y1 - lat) / (y1 - y0)) * alto
  const caminos = useMemo(() => anillos.map((a) => 'M' + a.map(([lo, la]) => `${px(lo).toFixed(2)},${py(la).toFixed(2)}`).join('L') + 'Z'), [anillos])  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <svg className="sistema__mapa" viewBox={`0 0 ${ANCHO} ${alto.toFixed(1)}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {caminos.map((d, i) => <path key={i} d={d} className="sistema__loc" />)}
      {puntos.map((p, i) => (
        <circle key={i} cx={px(p.lon)} cy={py(p.lat)} r={p.clase === 'elegida' ? 0.85 : p.clase === 'tenue' ? 0.3 : 0.42}
                className={`sistema__punto sistema__punto--${p.clase}`} style={{ animationDelay: `${((i * 0.6180339887) % 1) * 0.9}s` }} />
      ))}
    </svg>
  )
}

export default function AnimacionSistema({ fragmentos, leyendas, bbox, anillos, puntos, auto, etiqueta }: {
  fragmentos: [string, TipoFragmento][]
  leyendas: { datos: ReactNode; modelo: ReactNode; decision: ReactNode }
  bbox: Bbox
  anillos: [number, number][][]
  puntos: PuntoMapa[]
  auto: boolean
  /** lo que describe la animación para lectores de pantalla */
  etiqueta: string
}) {
  const reducir = useReducedMotion()
  const [vuelta, setVuelta] = useState(0)
  const [fase, setFase] = useState<Fase>(reducir ? 'proli' : 'datos')
  const [saluda, setSaluda] = useState(false)

  useEffect(() => {
    if (reducir) return
    setFase('datos')
    const ids = TIEMPOS.map(([f, t]) => window.setTimeout(() => setFase(f), t * 1000))
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [vuelta, reducir])
  // Proli saluda una y otra vez
  useEffect(() => {
    if (fase !== 'proli' || reducir) return
    setSaluda(true)
    const id = window.setInterval(() => setSaluda((x) => !x), SALUDO_S * 1000 + 150)
    return () => window.clearInterval(id)
  }, [fase, reducir])

  const leyenda = fase === 'datos' ? leyendas.datos : fase === 'modelo' ? leyendas.modelo : leyendas.decision
  return (
    <div className={`sistema sistema--${fase}`} aria-label={etiqueta}>
      {/* 1 · Datos: los fragmentos vuelan al centro */}
      {fase === 'datos' && (
        <div className="sistema__nube" key={`nube-${vuelta}`}>
          {fragmentos.map(([texto, tipo], k) => <Fragmento key={texto} texto={texto} tipo={tipo} k={k} n={fragmentos.length} />)}
          <motion.span className="sistema__nucleo" initial={{ scale: 0.2, opacity: 0.3 }} animate={{ scale: [0.2, 0.6, 1.1], opacity: [0.3, 0.7, 1] }} transition={{ duration: 3.1, ease: 'easeIn' }} />
        </div>
      )}
      {/* 2 · Modelo: la explosión */}
      <AnimatePresence>
        {fase === 'modelo' && (
          <motion.div className="sistema__explosion" key={`boom-${vuelta}`} exit={{ opacity: 0 }}>
            <motion.span className="sistema__destello" initial={{ opacity: 0.95, scale: 0.4 }} animate={{ opacity: 0, scale: 1.6 }} transition={{ duration: 0.8, ease: 'easeOut' }} />
            <motion.span className="sistema__onda" initial={{ scale: 0.1, opacity: 1 }} animate={{ scale: 9, opacity: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
            <motion.span className="sistema__onda sistema__onda--2" initial={{ scale: 0.1, opacity: 1 }} animate={{ scale: 6, opacity: 0 }} transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }} />
            {Array.from({ length: 28 }, (_, k) => {
              const a = (2 * Math.PI * k) / 28 + (k % 2) * 0.1
              return <motion.i key={k} className="sistema__chispa" initial={{ x: 0, y: 0, opacity: 1 }}
                               animate={{ x: `${Math.cos(a) * (35 + (k % 3) * 8)}cqw`, y: `${Math.sin(a) * (35 + (k % 3) * 8)}cqh`, opacity: 0, scale: 0.4 }} transition={{ duration: 0.85, ease: 'easeOut' }} />
            })}
          </motion.div>
        )}
      </AnimatePresence>
      {/* 3 · Decisión: el mapa sale con la explosión */}
      {fase !== 'datos' && (
        <motion.div className="sistema__mapa-caja" key={`mapa-${vuelta}`} initial={{ scale: 0.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 110, damping: 13 }}>
          <MapaBogota bbox={bbox} anillos={anillos} puntos={puntos} />
        </motion.div>
      )}
      {/* 4 · Proli en el centro, crece y saluda */}
      <AnimatePresence>
        {fase === 'proli' && (
          <motion.span className="sistema__proli" key={`proli-${vuelta}`} initial={{ opacity: 0, scale: 0.12 }} animate={{ opacity: 1, scale: 1 }}
                       transition={{ opacity: { duration: 0.4 }, scale: { duration: 3.2, ease: [0.25, 0.1, 0.25, 1] } }}>
            <ProliAnimado saludar={saluda} />
          </motion.span>
        )}
      </AnimatePresence>
      <p className="sistema__leyenda" aria-live="polite">{leyenda}</p>
      {!auto && fase === 'proli' && !reducir && <button className="boton-texto sistema__otra" onClick={() => setVuelta((x) => x + 1)}>↻ Ver de nuevo</button>}
    </div>
  )
}
