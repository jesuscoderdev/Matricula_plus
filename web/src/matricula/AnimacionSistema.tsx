/**
 * Matrícula+ · Cómo lo hicimos: los datos se convierten en un sistema vivo. Líneas de código,
 * cálculos y datos llegan volando al centro (Datos), se concentran hasta explotar (Modelo:
 * programación lineal) y de la explosión sale el mapa de Bogotá con los estudiantes de la simulación
 * (Decisión); al final aparece Proli saludando. Las cifras de los fragmentos salen de resultados.json.
 * Con «reducir movimiento» se ve directamente el final.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import ProliAnimado from '../componentes/ProliAnimado'
import { SALUDO_S } from '../componentes/proliGeometria'
import { entero, millonesDe, type DatosMatricula } from './datos'

type Fase = 'datos' | 'modelo' | 'mapa' | 'proli'
const TIEMPOS: [Fase, number][] = [['modelo', 3.2], ['mapa', 4.1], ['proli', 5.6]]
const ANCHO = 100

/** Un fragmento por cada ángulo alrededor del centro: entra desde el borde y se apaga al llegar */
function Fragmento({ texto, tipo, k, n }: { texto: string; tipo: 'codigo' | 'mate' | 'dato'; k: number; n: number }) {
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

/** El mapa: localidades y estudiantes (verde = ahora cerca; violeta = siguen lejos), proyectados al recuadro */
function MapaBogota({ datos }: { datos: DatosMatricula }) {
  const [[x0, y0], [x1, y1]] = datos.bboxCiudad
  const coslat = Math.cos((((y0 + y1) / 2) * Math.PI) / 180)
  const alto = (ANCHO * (y1 - y0)) / ((x1 - x0) * coslat)
  const px = (lon: number) => ((lon - x0) / (x1 - x0)) * ANCHO
  const py = (lat: number) => ((y1 - lat) / (y1 - y0)) * alto
  const caminos = useMemo(() => datos.croquis.flatMap((c) => c.anillos.map((a) => 'M' + a.map(([lo, la]) => `${px(lo).toFixed(2)},${py(la).toFixed(2)}`).join('L') + 'Z')), [datos])  // eslint-disable-line react-hooks/exhaustive-deps
  const p = datos.puntos
  return (
    <svg className="sistema__mapa" viewBox={`0 0 ${ANCHO} ${alto.toFixed(1)}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {caminos.map((d, i) => <path key={i} d={d} className="sistema__loc" />)}
      {p.lon.map((lo, i) => (
        <circle key={i} cx={px(lo)} cy={py(p.lat[i])} r={0.42}
                className={p.lejos_despues[i] ? 'sistema__nino sistema__nino--lejos' : 'sistema__nino'}
                style={{ animationDelay: `${((i * 0.6180339887) % 1) * 0.9}s` }} />
      ))}
    </svg>
  )
}

export default function AnimacionSistema({ datos, auto }: { datos: DatosMatricula; auto: boolean }) {
  const reducir = useReducedMotion()
  const [vuelta, setVuelta] = useState(0)
  const [fase, setFase] = useState<Fase>(reducir ? 'proli' : 'datos')
  const [saluda, setSaluda] = useState(false)
  const s = datos.r.simulacion

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

  const fragmentos: [string, 'codigo' | 'mate' | 'dato'][] = [
    ['linprog(costo, A_ub, b_ub)', 'codigo'], ['min Σ wᵢ · dᵢⱼ · xᵢⱼ', 'mate'], [`${entero(s.ninos)} estudiantes`, 'dato'],
    ['d = distancia(casa, colegio)', 'codigo'], ['Σⱼ xᵢⱼ = 1', 'mate'], [`${entero(s.sedes_con_cupos_de_nuevos)} sedes`, 'dato'],
    ['if estrato <= 2: w += 1', 'codigo'], ['Σᵢ xᵢⱼ ≤ cupoⱼ', 'mate'], [`${entero(s.manzanas_residenciales)} manzanas`, 'dato'],
    ['for niño in niños:', 'codigo'], ['d > 2 km', 'mate'], [`${millonesDe(s.distancias_calculadas)} de distancias`, 'dato'],
    ['xᵢⱼ ∈ {0, 1}', 'mate'], ['{ "nivel": "Primaria" }', 'dato'], ['edad < 10 → +1', 'codigo'],
    [`${entero(s.combinaciones_nino_colegio)} combinaciones`, 'dato'], ['w = 1 + estrato + edad', 'mate'], ['{ "estrato": 1 }', 'dato'],
  ]
  const leyenda = fase === 'datos' ? <><b>1 · Datos</b> conectados de fuentes públicas</>
    : fase === 'modelo' ? <><b>2 · Modelo</b>: programación lineal</>
      : <><b>3 · Decisión</b>: dónde puede estudiar cada niño</>

  return (
    <div className={`sistema sistema--${fase}`} aria-label="Datos conectados, un modelo de programación lineal y la asignación de cada estudiante en el mapa de Bogotá">
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
      {/* 3 · Decisión: el mapa con los estudiantes */}
      {(fase === 'mapa' || fase === 'proli') && (
        <motion.div className="sistema__mapa-caja" key={`mapa-${vuelta}`} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
          <MapaBogota datos={datos} />
        </motion.div>
      )}
      {/* 4 · Proli saluda */}
      <AnimatePresence>
        {fase === 'proli' && (
          <motion.span className="sistema__proli" key={`proli-${vuelta}`} initial={{ y: 40, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }}
                       transition={{ type: 'spring', stiffness: 180, damping: 12 }}>
            <ProliAnimado tamano={5.2} saludar={saluda} />
          </motion.span>
        )}
      </AnimatePresence>
      <p className="sistema__leyenda" aria-live="polite">{leyenda}</p>
      {!auto && fase === 'proli' && !reducir && <button className="boton-texto sistema__otra" onClick={() => setVuelta((x) => x + 1)}>↻ Ver de nuevo</button>}
    </div>
  )
}
