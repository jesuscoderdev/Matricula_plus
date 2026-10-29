/**
 * Las pantallas de Presupuesto+ (panel de texto junto al mapa), con la estructura de Matrícula+:
 * Problema → Solución → Antes y después → Resultados → Cómo se hizo → Tu reto.
 *
 * Ninguna cifra se escribe a mano: salen de los datos (experiencia.json, fuentes.json, resumen.json,
 * sitios.geojson), casi todas a través de guion.ts. El mensaje: el presupuesto rinde más cuando se
 * escoge con más información. Mirar un solo año deja información por fuera; el modelo suma la
 * historia de cada esquina y la de sus parecidas, y así la plata va a las esquinas con más riesgo.
 * La predicción es el cómo, no el fin. Un solo escenario: las esquinas que alcanzan con el primer
 * presupuesto. No se muestra que los siniestros «bajaron» (invita a pensar que una obra funcionó).
 */
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BotonInicio, BotonTema, LogoEmpresa, MarcaDeAgua, NombreApp } from '../componentes/Marca'
import Proli, { ProliMarca } from '../componentes/Proli'
import QrCita from '../componentes/QrCita'
import Veredicto from '../componentes/Veredicto'
import { NOMBRE_MOVILIDAD, URL_CITA, urlCitaCon } from '../config'
import { pedirAProli, useReto } from '../proli/ordenes'
import { esTotem, type Modo } from '../modo'
import { entero, millones, nombreLocalidad, pct, pctFraccion, type DatosMovilidad, type Escenario, type Nivel, type PuntoCurva } from './datos'
import { guionDe, type Forma } from './guion'

export type CapituloMov = 'problema' | 'escoge' | 'falla' | 'ysi' | 'antes' | 'resultados' | 'presupuesto' | 'como' | 'fuentes' | 'cierre'
export type VistaMov = 'portada' | CapituloMov
/** Seis secciones (lo que se ve en la navegación), de una a dos pantallas cada una */
export const SECCIONES_MOV: { nombre: string; vistas: CapituloMov[] }[] = [
  { nombre: 'Problema', vistas: ['problema', 'escoge'] },
  { nombre: 'Solución', vistas: ['falla', 'ysi'] },
  { nombre: 'Antes y después', vistas: ['antes'] },
  { nombre: 'Resultados', vistas: ['resultados', 'presupuesto'] },
  { nombre: 'Cómo se hizo', vistas: ['como', 'fuentes'] },
  { nombre: 'Tu reto', vistas: ['cierre'] },
]
/** Cada pantalla, en orden (el nombre es el que oye Proli) */
export const CAPITULOS_MOV: { id: CapituloMov; nombre: string }[] = [
  { id: 'problema', nombre: 'El presupuesto no alcanza' },
  { id: 'escoge', nombre: '¿Cuáles 3 esquinas arreglarías tú?' },
  { id: 'falla', nombre: 'Escogiste mirando un solo año' },
  { id: 'ysi', nombre: '¿Y si se usa toda la información?' },
  { id: 'antes', nombre: 'Antes y después' },
  { id: 'resultados', nombre: 'Resultados' },
  { id: 'presupuesto', nombre: 'Presupuesto' },
  { id: 'como', nombre: 'Cómo se hizo' },
  { id: 'fuentes', nombre: 'Fuentes' },
  { id: 'cierre', nombre: 'Tu reto' },
]
export const seccionDe = (c: CapituloMov) => SECCIONES_MOV.findIndex((x) => x.vistas.includes(c))
export const kicker = (c: CapituloMov) => `${seccionDe(c) + 1} de ${SECCIONES_MOV.length} · ${SECCIONES_MOV[seccionDe(c)].nombre}`
export const ESQUINAS_A_ESCOGER = 3

export interface PropsMov {
  datos: DatosMovilidad
  modo: Modo
  ir: (v: VistaMov) => void
  tocadas: number[]
  setTocadas: (t: number[]) => void
  /** presupuesto en millones de pesos */
  monto: number
  setMonto: (m: number) => void
  /** Antes y después: qué lista se ve en el mapa (mirando solo 2024 o con el modelo) */
  lista: 'contar' | 'modelo'
  setLista: (l: 'contar' | 'modelo') => void
  alInicio?: () => void
  /** el logo de Proliferante lleva a la portada del stand */
  alPortada?: () => void
}

// --- Datos derivados (todo sale de los archivos) ---
export const anioBase = (d: DatosMovilidad) => d.experiencia.pantalla_1_usted_decide.anio_mostrado
export const anioVal = (d: DatosMovilidad) => d.resumen.anio_validacion
/** "115 m", leído de la unidad del modelo */
export const tamanoHex = (d: DatosMovilidad) => d.resumen.unidad.match(/[\d.,]+\s*m\b/)?.[0] ?? ''
/** Fracción de siniestros que evita una obra en barrio (40 % → 0,4) */
const reduccion = (d: DatosMovilidad) => d.experiencia.pantalla_presupuesto_barrio.reduccion_supuesta_pct / 100
export const nombreForma = (d: DatosMovilidad, f: Forma) =>
  f === 'contar1' ? `Mirando solo ${anioBase(d)}` : f === 'contar2' ? `Mirando ${anioBase(d) - 1} y ${anioBase(d)}` : NOMBRE_MOVILIDAD
const loc = (d: DatosMovilidad, i: number) => nombreLocalidad(d.sitios.localidades[d.sitios.loc[i]])
/** Ancho de una barra: proporcional, dejando sitio para el número al lado */
const ancho = (fraccion: number, rem = 3.4) => `calc((100% - ${rem}rem) * ${Math.max(0, Math.min(1, fraccion))})`
const entrar = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }
/** Las esquinas que escogió el visitante (o, si no escogió, las tres primeras de la lista) */
export const tusEsquinas = (d: DatosMovilidad, tocadas: number[]) => (tocadas.length ? tocadas : guionDe(d).tablaDesordenada.slice(0, ESQUINAS_A_ESCOGER))

export function Cabeza({ c, titulo, children }: { c: CapituloMov; titulo: ReactNode; children?: ReactNode }) {
  return (
    <header className="panel__cabeza">
      <span className="kicker">{kicker(c)}</span>
      <h1 className="display">{titulo}</h1>
      {children}
    </header>
  )
}
function Cifra({ n, children, tono }: { n: ReactNode; children: ReactNode; tono?: 'acento' | 'bueno' | 'contar' }) {
  return <div className={`cifra-mov ${tono ? `cifra-mov--${tono}` : ''}`}><b>{n}</b><span>{children}</span></div>
}
const Respuesta = ({ children }: { children: ReactNode }) => <p className="respuesta-mov">{children}</p>
function Pie({ modo, children }: { modo: Modo; children: ReactNode }) {
  return <div className="panel__pie">{modo !== 'auto' && children}</div>
}

// ---------------------------------------------------------------- portada
export function PortadaMov({ datos, modo, ir, alInicio, alPortada }: PropsMov) {
  const c = datos.experiencia.contexto_ciudad
  const totem = esTotem(modo)
  return (
    <>
      <div className="portada__contenido">
        <MarcaDeAgua className="marca-agua--portada" />
        <motion.div className="portada__marca" {...entrar} transition={{ delay: 0.05 }}>
          <div className="portada__logos">
            {alInicio && modo !== 'auto' && <BotonInicio alInicio={alInicio} />}
            <LogoEmpresa alTocar={alPortada} />
            <span className="portada__sep" aria-hidden />
            <span className="marca-bloque"><ProliMarca /><NombreApp nombre={NOMBRE_MOVILIDAD} /></span>
          </div>
          <span className="etiqueta">GovTech · 3–4 nov 2026</span>
          <BotonTema />
        </motion.div>
        <motion.span className="kicker" {...entrar} transition={{ delay: 0.15 }}>Presupuesto para seguridad vial · Bogotá</motion.span>
        <motion.p className="portada-mov__contexto" {...entrar} transition={{ delay: 0.2 }}>
          En {anioVal(datos)}, <b>{entero(c.fallecidos_2025)} personas murieron</b> en las vías de Bogotá y <b>{entero(c.lesionados_2025)}</b> resultaron heridas.
          El presupuesto para arreglar esquinas no alcanza para todas.
        </motion.p>
        <motion.h1 className="display portada-mov__titulo" {...entrar} transition={{ delay: 0.28 }}>
          <span>Mismo presupuesto. Más información.</span>
          <span className="portada-mov__l2">Mejores esquinas.</span>
        </motion.h1>
        <motion.p className="portada-mov__l3" {...entrar} transition={{ delay: 0.36 }}>
          {NOMBRE_MOVILIDAD} mira la historia de cada esquina y la de miles de esquinas parecidas para decidir dónde invertir primero.
        </motion.p>
      </div>
      <div className="portada__pie">
        {modo !== 'auto' && (
          <motion.div className="fila" {...entrar} transition={{ delay: 0.5 }}>
            <button className="boton boton--violeta boton--latir" onClick={() => ir('problema')}>Ver cómo →</button>
          </motion.div>
        )}
        {totem && (
          <div className="fila fila--entre">
            <span className="toca">{modo === 'auto' ? 'Recorrido automático' : 'Toca para empezar'}</span>
            {modo === 'auto' && <Proli tamano={6} lado="derecha" globo={<>Hola, soy <b>Proli</b>. ¿Qué esquinas arreglarías tú primero?</>} />}
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 1. Problema
export function Problema({ datos, modo, ir }: PropsMov) {
  const g = guionDe(datos)
  const p = datos.experiencia.pantalla_presupuesto_barrio
  return (
    <div className="panel">
      <Cabeza c="problema" titulo={<>El presupuesto no alcanza para <em>todas</em> las esquinas</>}>
        <p className="lead">En {anioBase(datos)}:</p>
      </Cabeza>
      <div className="cifras-mov">
        <Cifra n={entero(g.conGraves)} tono="acento">esquinas de barrio con siniestros graves</Cifra>
        <Cifra n={entero(p.escenarios.bajo.esquinas)}>esquinas que alcanzan con {millones(p.escenarios.bajo.presupuesto_millones)} (≈ {entero(p.costo_por_esquina_millones)} millones cada una)</Cifra>
      </div>
      <Respuesta>¿Cuáles escoger para que la plata rinda más?</Respuesta>
      <p className="nota">Siniestro grave: con al menos un herido o un muerto. Cada esquina es una zona de {tamanoHex(datos)}. Fuente: Secretaría Distrital de Movilidad.</p>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('escoge')}>¿Cuáles escogerías tú? →</button></Pie>
    </div>
  )
}

export function Escoge({ datos, modo, ir, tocadas, setTocadas }: PropsMov) {
  const g = guionDe(datos)
  const s = datos.sitios
  const listo = tocadas.length >= ESQUINAS_A_ESCOGER
  const tocar = (i: number) => setTocadas(tocadas.includes(i) ? tocadas.filter((x) => x !== i) : [...tocadas, i].slice(-ESQUINAS_A_ESCOGER))
  return (
    <div className="panel">
      <Cabeza c="escoge" titulo={<>¿Cuáles <em>{ESQUINAS_A_ESCOGER} esquinas</em> arreglarías tú?</>}>
        <p className="lead">Estas fueron las {g.tabla.length} esquinas de barrio con más siniestros graves en {anioBase(datos)}.</p>
      </Cabeza>
      <div className="lista-mov">
        {g.tablaDesordenada.map((i, k) => (
          <button key={i} className="esq-mov" aria-pressed={tocadas.includes(i)} disabled={modo === 'auto'} onClick={() => tocar(i)} data-proli={`esquina-${k + 1}`}>
            <span className="esq-mov__n">{k + 1}</span>
            <span className="esq-mov__donde"><b>{loc(datos, i)}</b><small>esquina de barrio · zona de {tamanoHex(datos)}</small></span>
            <span className="esq-mov__k">{entero(s.k24[i])} <small>siniestros graves en {anioBase(datos)}</small></span>
          </button>
        ))}
      </div>
      <p className="nota">También puedes tocarlas en el mapa.</p>
      <Pie modo={modo}>
        <button className={`boton boton--ancho ${listo ? 'boton--violeta boton--latir' : ''}`} disabled={!listo} onClick={() => ir('falla')}>
          {listo ? 'Listo, seguir →' : `Escoge ${ESQUINAS_A_ESCOGER - tocadas.length} más`}
        </button>
      </Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 2. Solución
export function Falla({ datos, modo, ir, tocadas }: PropsMov) {
  const g = guionDe(datos)
  const s = datos.sitios
  const mias = tusEsquinas(datos, tocadas)
  const a0 = anioBase(datos)
  const max = Math.max(1, ...mias.flatMap((i) => [s.k23[i], s.k24[i]]))
  const suma = (v: number[]) => mias.reduce((t, i) => t + v[i], 0)
  const cambio = g.cambiosPresupuesto
  const esc = datos.experiencia.pantalla_presupuesto_barrio.escenarios.bajo
  return (
    <div className="panel">
      <Cabeza c="falla" titulo={<>Escogiste mirando <em>un solo año</em></>}>
        <p className="lead">{tocadas.length ? 'Tus' : 'Las'} {mias.length} esquinas tuvieron <b>{entero(suma(s.k24))} siniestros graves</b> en {a0}.
          Es una buena pista, pero un solo año no cuenta toda la historia.</p>
      </Cabeza>
      <div className="barras-mov">
        {mias.map((i) => (
          <div key={i} className="barra-mov">
            <span className="barra-mov__n">{g.tablaDesordenada.indexOf(i) + 1 || '·'}</span>
            <div className="barra-mov__pistas">
              <span className="pista-mov"><i className="pista-mov__antes" style={{ width: `${(s.k23[i] / max) * 75}%` }} />{a0 - 1}: <b>{entero(s.k23[i])}</b></span>
              <span className="pista-mov"><i className="pista-mov__despues" style={{ width: `${(s.k24[i] / max) * 75}%` }} />{a0}: <b>{entero(s.k24[i])}</b></span>
            </div>
          </div>
        ))}
      </div>
      <p className="nota-mov">Si con {millones(esc.presupuesto_millones)} se arreglan las <b>{entero(esc.esquinas)} esquinas con más siniestros graves en {a0}</b>:</p>
      <div className="cifras-mov">
        <Cifra n={entero(cambio.salen.n)} tono="contar"><b>entran por un solo año malo:</b> {entero(cambio.salen.k24)} siniestros graves en {a0}, pero solo {entero(cambio.salen.k23)} en {a0 - 1}</Cifra>
        <Cifra n={entero(cambio.entran.n)} tono="bueno"><b>quedan por fuera</b> aunque tuvieron {entero(cambio.entran.k23)} siniestros graves en {a0 - 1}: en {a0} solo tuvieron {entero(cambio.entran.k24)}</Cifra>
      </div>
      <Respuesta>Mirar un solo año deja información por fuera. Así, parte de la plata puede ir a esquinas donde el riesgo fue pasajero.</Respuesta>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('ysi')}>¿Y si se usa toda la información? →</button></Pie>
    </div>
  )
}

/** Cómo cruza la información el modelo, en general (sin una esquina en particular): aparece por pasos */
function Cruce({ datos }: { datos: DatosMovilidad }) {
  const r = datos.resumen
  const [e0, e1] = r.periodo_estimacion
  const paso = (k: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.3 + k * 0.9, duration: 0.45 } })
  return (
    <div className="cruce-mov" aria-label="Historia de la esquina más esquinas parecidas da el riesgo estimado de cada esquina">
      <motion.div className="cruce-mov__caja" {...paso(0)}>
        <b>Su historia</b>
        <span>Los siniestros graves de cada esquina en {e0} y en {e1}, no solo del último año.</span>
      </motion.div>
      <motion.span className="cruce-mov__signo" aria-hidden {...paso(0.5)}>+</motion.span>
      <motion.div className="cruce-mov__caja" {...paso(1)}>
        <b>Sus esquinas parecidas</b>
        <span>Del mismo tipo de vía y con una cantidad de calle parecida, entre {entero(r.universo.por_zona.local)} esquinas de barrio.</span>
      </motion.div>
      <motion.span className="cruce-mov__signo" aria-hidden {...paso(1.5)}>↓</motion.span>
      <motion.div className="cruce-mov__caja cruce-mov__caja--fin" {...paso(2)}>
        <b>Riesgo estimado de cada esquina</b>
        <span>Cuántos siniestros graves se esperan al año. Si un año se sale de lo normal, las parecidas lo equilibran.</span>
      </motion.div>
    </div>
  )
}

export function Ysi({ datos, modo, ir }: PropsMov) {
  const [vuelta, setVuelta] = useState(0)
  const a0 = anioBase(datos)
  return (
    <div className="panel">
      <Cabeza c="ysi" titulo={<>¿Y si se usa <em>toda</em> la información?</>}>
        <p className="lead">{NOMBRE_MOVILIDAD} aplica <b>Bayes empírico</b>, un método estadístico que cruza más información para estimar el riesgo de cada esquina.</p>
      </Cabeza>
      <Cruce key={vuelta} datos={datos} />
      {modo !== 'auto' && <button className="boton-texto" onClick={() => setVuelta((x) => x + 1)}>↻ Ver de nuevo</button>}
      <div className="dos-mov">
        <div className="dos-mov__contar">
          <b>Mirando solo {a0}</b>
          <span>Escoge las esquinas que tuvieron un año malo, aunque haya sido pasajero.</span>
        </div>
        <div className="dos-mov__proli">
          <b>{NOMBRE_MOVILIDAD}</b>
          <span>Escoge las esquinas que llevan años con riesgo.</span>
        </div>
      </div>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Qué es cada cosa? ▾</summary>
        <ul className="pruebas-mov">
          <li><b>Siniestro grave:</b> con heridos o muertos (criterio de 30 días).</li>
          <li><b>Esquina:</b> una zona de {tamanoHex(datos)}. Calles de barrio y avenidas se separan con la red vial de OpenStreetMap.</li>
          <li><b>Riesgo estimado:</b> cuántos siniestros graves se esperan al año en la esquina. Es una estimación, no una certeza.</li>
          <li><b>Bayes empírico</b> (Hauer, 1997): mezcla la historia de la esquina con la de sus parecidas. Es un método reconocido en seguridad vial.</li>
        </ul>
        <p className="nota">No se sabe con exactitud cómo escoge hoy cada entidad sus esquinas. Aquí se compara con escoger por los siniestros del último año, que es el método
          básico de la guía nacional del Ministerio de Transporte. La misma guía recomienda combinarlo con modelos estadísticos, como este.</p>
      </details>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('antes')}>Ver el antes y el después →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 3. Antes y después
/** El modelo «piensa» antes de mostrar el antes y el después: tres pasos que se encienden uno a uno */
function Piensa({ pasos, alTerminar }: { pasos: ReactNode[]; alTerminar: () => void }) {
  const [hechos, setHechos] = useState(0)
  useEffect(() => {
    const t = 650
    const relojes = pasos.map((_, i) => setTimeout(() => setHechos(i + 1), t * (i + 0.3)))
    relojes.push(setTimeout(alTerminar, t * (pasos.length + 0.6)))
    return () => relojes.forEach(clearTimeout)
  }, [pasos.length, alTerminar])
  return (
    <div className="piensa-mov" role="status">
      {pasos.map((p, i) => <p key={i} className={i < hechos ? 'listo' : ''}>{p}</p>)}
    </div>
  )
}

export function Antes({ datos, modo, ir, tocadas, lista, setLista }: PropsMov) {
  const G = guionDe(datos)
  const p = G.comparacionPresupuesto
  const esc = datos.experiencia.pantalla_presupuesto_barrio.escenarios.bajo
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const enModelo = new Set(p.modelo.lista)
  const tuyas = tocadas.filter((i) => enModelo.has(i)).length
  const quieto = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [listo, setListo] = useState(quieto)
  const terminar = useCallback(() => setListo(true), [])
  const cabeza = (
    <Cabeza c="antes" titulo={<>Mirando solo {a0} se escogen unas esquinas. <em>Con {NOMBRE_MOVILIDAD}, otras.</em></>}>
      <p className="lead">Con {millones(esc.presupuesto_millones)} alcanza para <b>{entero(p.esquinas)} esquinas de barrio</b>. De una forma a la otra
        cambian <b>{entero(G.cambiosPresupuesto.entran.n)}</b>: salen las de un solo año malo y entran las que llevan años con riesgo.</p>
    </Cabeza>
  )
  if (!listo) return (
    <div className="panel">
      {cabeza}
      <Piensa alTerminar={terminar} pasos={[
        <>Conectando 3 años de siniestros graves ({a0 - 1}, {a0} y {a1})…</>,
        <>Comparando cada esquina con miles de esquinas parecidas…</>,
        <>Calculando el riesgo de cada esquina de barrio…</>,
      ]} />
    </div>
  )
  return (
    <motion.div className="panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      {cabeza}
      {modo !== 'auto' && (
        <div className="segmentos" role="group" aria-label="Qué esquinas se ven en el mapa">
          <button className={`segmento ${lista === 'contar' ? 'segmento--activo' : ''}`} onClick={() => setLista('contar')} data-proli="lista-contar">Mirando solo {a0}</button>
          <button className={`segmento ${lista === 'modelo' ? 'segmento--activo' : ''}`} onClick={() => setLista('modelo')} data-proli="lista-modelo">Con {NOMBRE_MOVILIDAD}</button>
        </div>
      )}
      {tocadas.length > 0 && (
        <div className="tarjeta tarjeta--violeta">
          <span className="etiqueta">Tus {tocadas.length} esquinas</span>
          <p>{tuyas === tocadas.length ? `${NOMBRE_MOVILIDAD} también las escoge todas.` : tuyas === 0 ? `${NOMBRE_MOVILIDAD} no escoge ninguna de ellas.`
            : `${NOMBRE_MOVILIDAD} también escoge ${tuyas} de ellas.`}</p>
        </div>
      )}
      <h2 className="subtitulo-mov">¿Qué pasó en {a1}?</h2>
      <div className="cifras-mov">
        <Cifra n={entero(p.modelo.hubo)} tono="bueno">siniestros graves tuvieron en {a1} las esquinas de {NOMBRE_MOVILIDAD}. Las escogidas mirando solo {a0}: {entero(p.contar1.hubo)}</Cifra>
        <Cifra n={<>≈ {entero(p.modelo.espera)}</>} tono="acento">siniestros graves esperaba {NOMBRE_MOVILIDAD} en sus esquinas para {a1}. Hubo {entero(p.modelo.hubo)}: su estimación se acerca a lo que pasó</Cifra>
      </div>
      <Respuesta>Con más información, la plata va a las esquinas donde hay más riesgo. Ahí es donde una obra puede evitar más siniestros.</Respuesta>
      <p className="nota">{a1} es un año que el modelo no vio: se estimó solo con {a0 - 1} y {a0}.</p>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Y si se miran dos años? ▾</summary>
        <ul className="pruebas-mov">
          <li>Mirando {a0 - 1} y {a0} se escogen casi las mismas esquinas que con {NOMBRE_MOVILIDAD} ({entero(p.contar2.comun)} de {entero(p.esquinas)}), y en {a1} tuvieron
            {' '}{entero(p.contar2.hubo)} siniestros graves. Mirar más de un año ya es sumar información.</li>
          <li>La diferencia está en cuánto se espera. Mirando los dos años, se esperaría que en {a1} se repitiera su promedio:
            {' '}{entero(p.contar2.espera)} siniestros graves en esas esquinas, y hubo {entero(p.contar2.hubo)}. {NOMBRE_MOVILIDAD}, que suma las esquinas
            parecidas, esperaba ≈ {entero(p.modelo.espera)} y hubo {entero(p.modelo.hubo)}.</li>
          <li>Muchas esquinas empatan con el mismo número de siniestros. Los empates se rompen por el año más reciente y luego por el código de la zona, como en el modelo.</li>
        </ul>
      </details>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('resultados')}>¿Y cuánto se evita? →</button></Pie>
    </motion.div>
  )
}

// ---------------------------------------------------------------- 4. Resultados
export function Resultados({ datos, modo, ir }: PropsMov) {
  const G = guionDe(datos)
  const p = G.comparacionPresupuesto
  const r = reduccion(datos)
  const esc = datos.experiencia.pantalla_presupuesto_barrio
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const mas = Math.round((p.modelo.hubo - p.contar1.hubo) * r)
  const masPct = Math.round((100 * (p.modelo.hubo - p.contar1.hubo)) / Math.max(1, p.contar1.hubo))
  return (
    <div className="panel">
      <Cabeza c="resultados" titulo={<>Con <em>{millones(esc.escenarios.bajo.presupuesto_millones)}</em>…</>}>
        <p className="lead">Alcanza para <b>{entero(p.esquinas)} esquinas de barrio</b>. Si en cada una se pone un reductor de velocidad, que baja ≈ {entero(esc.reduccion_supuesta_pct)} % los siniestros con heridos, se evitarían:</p>
      </Cabeza>
      <div className="cifras-mov">
        <Cifra n={<>≈ {entero(p.modelo.hubo * r)}</>} tono="bueno">siniestros graves evitados al año en las esquinas de {NOMBRE_MOVILIDAD}</Cifra>
        <Cifra n={<>≈ {entero(p.contar1.hubo * r)}</>} tono="contar">siniestros graves evitados al año en las esquinas escogidas mirando solo {a0}</Cifra>
      </div>
      <Veredicto etiqueta="Con la misma plata" cifra={`${mas >= 0 ? '+' : '−'}${entero(Math.abs(mas))}`}
                 frase={`siniestros graves evitados al año (${pct(masPct)})`}
                 nota={<>Porque la plata llega a las esquinas con más riesgo.</>} />
      <Respuesta>Mismo presupuesto, mejores esquinas: más siniestros evitados.</Respuesta>
      <p className="nota">Calculado con los siniestros graves que hubo en {a1} en las esquinas que escoge cada forma.</p>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('presupuesto')} data-proli="cap-presupuesto">¿Y con otro presupuesto? →</button></Pie>
    </div>
  )
}

/** La curva: siniestros graves evitados al año según el monto, con las esquinas del modelo. */
function CurvaPresupuesto({ puntos, monto }: { puntos: PuntoCurva[]; monto: number }) {
  const W = 320, H = 150, m = { izq: 6, der: 6, arr: 10, aba: 20 }
  const xMax = puntos[puntos.length - 1].presupuesto_millones
  const yMax = Math.max(...puntos.map((p) => p.metodo_esperado))
  const x = (v: number) => m.izq + (W - m.izq - m.der) * (v / xMax)
  const y = (v: number) => H - m.aba - (H - m.arr - m.aba) * (v / yMax)
  const linea = `M${x(0)},${y(0)} ` + puntos.map((p) => `L${x(p.presupuesto_millones).toFixed(1)},${y(p.metodo_esperado).toFixed(1)}`).join(' ')
  const p = puntos.find((q) => q.presupuesto_millones === monto) ?? puntos[0]
  const derecha = x(monto) > W * 0.75
  return (
    <figure className="curva">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Con ${millones(p.presupuesto_millones)} se evitarían ≈ ${entero(p.metodo_esperado)} siniestros graves al año.`}>
        <line x1={x(0)} x2={x(xMax)} y1={y(0)} y2={y(0)} className="curva__base" />
        <path d={linea} className="curva__metodo" />
        <line x1={x(monto)} x2={x(monto)} y1={m.arr} y2={y(0)} className="curva__guia" />
        <circle cx={x(monto)} cy={y(p.metodo_esperado)} r="4.2" className="curva__punto" />
        <text x={x(monto) + (derecha ? -7 : 7)} y={y(p.metodo_esperado) + 13} textAnchor={derecha ? 'end' : 'start'} className="curva__valor">≈ {entero(p.metodo_esperado)}</text>
        <text x={x(0)} y={H - 5} className="curva__eje">$0</text>
        <text x={x(xMax)} y={H - 5} textAnchor="end" className="curva__eje">{millones(xMax)}</text>
      </svg>
      <figcaption className="curva__leyenda">
        <span><i className="curva__clave curva__clave--metodo" />Siniestros graves evitados al año, según el presupuesto</span>
      </figcaption>
    </figure>
  )
}

export function Presupuesto({ datos, modo, ir, monto, setMonto }: PropsMov) {
  const p = datos.experiencia.pantalla_presupuesto_barrio
  const puntos = datos.experiencia.presupuesto_curva.puntos
  const i = Math.max(0, puntos.findIndex((q) => q.presupuesto_millones >= monto))
  const e = puntos[i]
  // Atajos: los tres montos de referencia (los mismos que usa Proli)
  const atajos = Object.entries(p.escenarios) as [Nivel, Escenario][]
  const r = datos.experiencia.presupuesto_reparto
  const fila = r.filas.reduce((a, b) => (Math.abs(b.presupuesto_millones - monto) < Math.abs(a.presupuesto_millones - monto) ? b : a))
  const maxR = Math.max(fila.todo_en_barrio, fila.todo_en_avenidas, fila.mejor_combinacion.esperado)
  const mejor = fila.mejor_combinacion
  return (
    <div className="panel">
      <Cabeza c="presupuesto" titulo={<>¿Qué logras con <em>{millones(e.presupuesto_millones)}</em>?</>}>
        <p className="lead">Elige cuánto invertir en reductores de velocidad (≈ {entero(p.costo_por_esquina_millones)} millones por esquina). {NOMBRE_MOVILIDAD} los pone primero en las
          esquinas de más riesgo y estima cuántos siniestros graves se evitarían.</p>
      </Cabeza>
      <div className="deslizador deslizador--monto">
        <label htmlFor="monto-mov">Presupuesto</label>
        <output>{millones(e.presupuesto_millones)}</output>
        <input id="monto-mov" type="range" min={0} max={puntos.length - 1} step={1} value={i} disabled={modo === 'auto'}
               onChange={(ev) => setMonto(puntos[+ev.target.value].presupuesto_millones)} />
      </div>
      <div className="chips">
        {atajos.map(([n, esc]) => (
          <button key={n} data-proli={`presupuesto-${n}`} disabled={modo === 'auto'} onClick={() => setMonto(esc.presupuesto_millones)}
                  className={`chip ${esc.presupuesto_millones === e.presupuesto_millones ? 'chip--activo' : ''}`}>{millones(esc.presupuesto_millones)}</button>
        ))}
      </div>
      <Veredicto etiqueta={<>Alcanza para {entero(e.esquinas)} esquinas de barrio</>}
                 cifra={`≈ ${entero(e.metodo_esperado)}`}
                 frase="siniestros graves menos al año (estimado)"
                 nota={<>Más dinero alcanza más esquinas, pero cada peso rinde un poco menos: primero van las de más riesgo.</>} />
      <CurvaPresupuesto puntos={puntos} monto={e.presupuesto_millones} />
      <h2 className="subtitulo-mov">¿Barrio o avenidas?</h2>
      <div className="reparto-red">
        <div className="reparto-red__fila">
          <span>Todo en calles de barrio</span>
          <span className="promesa__pista"><i className="promesa__barra promesa__barra--metodo" style={{ width: ancho(fila.todo_en_barrio / maxR) }} /><b>≈ {entero(fila.todo_en_barrio)}</b></span>
        </div>
        <div className="reparto-red__fila">
          <span>Todo en avenidas</span>
          <span className="promesa__pista"><i className="promesa__barra promesa__barra--metodo" style={{ width: ancho(fila.todo_en_avenidas / maxR) }} /><b>≈ {entero(fila.todo_en_avenidas)}</b></span>
        </div>
        <div className="reparto-red__fila reparto-red__fila--mejor">
          <span>La mejor combinación<small>{entero(mejor.esquinas_barrio)} esquinas de barrio{mejor.intersecciones_avenida > 0 ? ` y ${entero(mejor.intersecciones_avenida)} intersecciones` : ' y ninguna avenida'}</small></span>
          <span className="promesa__pista"><i className="promesa__barra promesa__barra--ocurrio" style={{ width: ancho(mejor.esperado / maxR) }} /><b>≈ {entero(mejor.esperado)}</b></span>
        </div>
      </div>
      <p className="nota">Siniestros graves menos al año con {millones(fila.presupuesto_millones)}, según {NOMBRE_MOVILIDAD}. Un reductor cuesta ≈ {entero(r.costos_millones.local)} millones; un semáforo
        con paso peatonal anticipado, hasta ≈ {entero(r.costos_millones.arterial)} millones. Si en avenidas solo hay que reprogramar el semáforo (menos de ≈ {entero(fila.avenidas_compiten_si_cuestan_menos_de_millones)} millones), conviene sumarlas.</p>
      <details className="como-calculamos">
        <summary className="boton-texto">Cómo se calcula esto ▾</summary>
        <p className="nota">Obra en barrio: {p.intervencion}, a ≈ {entero(p.costo_por_esquina_millones)} millones cada una; se supone que reduce un {entero(p.reduccion_supuesta_pct)} % los
          siniestros con heridos. En avenidas: {r.intervenciones.arterial.toLowerCase()}, −{entero(r.reducciones_pct.arterial)} %. La mejor combinación se calcula con
          un modelo de optimización (problema de la mochila) sobre el riesgo de cada esquina.</p>
        <div className="aviso-mov" role="note"><b>Ojo:</b> {datos.fuentes.advertencia}</div>
      </details>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('como')}>¿Cómo se hizo? →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 5. Cómo se hizo
export function Como({ datos, modo, ir }: PropsMov) {
  const r = datos.resumen
  const [e0, e1] = r.periodo_estimacion
  return (
    <div className="panel">
      <Cabeza c="como" titulo={<>Se unieron datos que estaban <em>sueltos</em></>} />
      <div className="cajitas-mov">
        <div className="cajita-mov"><b>{entero(datos.fuentes.fuentes.length)} fuentes públicas</b><span>Siniestros graves {e0}–{r.anio_validacion}, red vial, efectividad y costo de las obras.</span></div>
        <div className="cajita-mov"><b>Bogotá en zonas de {tamanoHex(datos)}</b><span>{entero(r.universo.por_zona.local)} de barrio y {entero(r.universo.por_zona.arterial)} de avenida.</span></div>
        <div className="cajita-mov"><b>Riesgo estimado de cada esquina</b><span>Su historia y la de sus esquinas parecidas (Bayes empírico, Hauer 1997).</span></div>
        <div className="cajita-mov"><b>Probado con un año que no vio</b><span>Se estimó con {e0} y {e1} y se comparó con {r.anio_validacion}.</span></div>
      </div>
      <p className="acento">Y puede seguir aprendiendo: con datos de obras, tráfico y velocidad, diría qué obra funciona y dónde.</p>
      <ul className="fuentes-lista-mov">
        {datos.fuentes.fuentes.map((f) => <li key={f.dato}>{f.fuente} · {f.dato}</li>)}
      </ul>
      <p className="nota">No se muestran siniestros individuales ni datos de personas (Ley 1581 de 2012).</p>
      <Pie modo={modo}>
        <button className="boton boton--ancho boton--violeta" onClick={() => ir('cierre')}>Tu reto →</button>
        <button className="boton-texto" onClick={() => ir('fuentes')}>De dónde salen los datos</button>
      </Pie>
    </div>
  )
}

export function Fuentes({ datos, modo, ir }: PropsMov) {
  const f = datos.fuentes
  const totem = esTotem(modo)
  return (
    <div className="panel">
      <Cabeza c="fuentes" titulo={f.titulo_sugerido} />
      <ul className="fuentes-mov">
        {f.fuentes.map((x) => (
          <li key={x.dato}>
            <b>{x.dato}</b>
            <span>{x.fuente} · {x.anio}</span>
            {!totem && <a href={x.url} target="_blank" rel="noopener noreferrer">{x.url.replace(/^https?:\/\//, '').split('/')[0]}</a>}
          </li>
        ))}
      </ul>
      <p className="nota mov-sec">{f.cruces}</p>
      <p className="nota mov-sec">{f.metodo_validacion}</p>
      <p className="nota mov-sec">Nombres técnicos: que un año muy malo suela venir seguido de uno más tranquilo se llama <b>regresión a la media</b>.
        El método es el de <b>Bayes empírico</b> (Hauer, 1997), reconocido en seguridad vial. Su pequeño error se explica por la caída de toda la ciudad
        en {anioVal(datos)} ({pctFraccion(datos.resumen.validacion_2025.local.tendencia_2025_vs_promedio)} en calles de barrio), que ningún cálculo podía anticipar.</p>
      <div className="aviso-mov" role="note">{f.advertencia}</div>
      <p className="etiqueta">Modelo {datos.experiencia.version_modelo}</p>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('cierre')}>Tu reto →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 6. Tu reto
export function Reto({ modo, ir, alInicio }: PropsMov) {
  const totem = esTotem(modo)
  const reto = useReto()
  return (
    <div className="panel">
      <Cabeza c="cierre" titulo={<>¿Tienes un reto así en tu <em>entidad</em>?</>}>
        <p className="lead">Lo que hicimos aquí con las vías lo podemos hacer con tus datos: conectarlos, estimar el riesgo y decidir dónde invertir primero <b>para que el presupuesto rinda más</b>.</p>
      </Cabeza>
      <div className="cierre">
        <Proli tamano={5.5} globo={<>Cuéntame tu reto: lo resolvemos con <b>los datos de tu entidad</b>.</>} />
        <QrCita />
      </div>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--violeta boton--ancho" onClick={() => pedirAProli('Tengo un reto en mi entidad')}>Cuéntaselo a Proli</button>}
        {!totem && URL_CITA && <button className="boton boton--claro boton--ancho" onClick={() => window.open(urlCitaCon(reto), '_blank', 'noopener')}>Agenda una cita</button>}
        {modo !== 'auto' && (
          <div className="fila">
            <button className="boton-texto" onClick={() => ir('portada')}>Ver de nuevo</button>
            <button className="boton-texto" onClick={() => ir('fuentes')}>De dónde salen los datos</button>
            {alInicio && <button className="boton-texto" onClick={alInicio}>Ver otros proyectos</button>}
          </div>
        )}
      </div>
    </div>
  )
}
