/**
 * Las pantallas de Movilidad+ (panel de texto junto al mapa), con la estructura de Matrícula+:
 * Problema → Solución → Antes y después → Resultados → Cómo se hizo → Tu reto.
 *
 * Ninguna cifra se escribe a mano: salen de los datos (experiencia.json, fuentes.json, resumen.json,
 * sitios.geojson), casi todas a través de guion.ts. El mensaje tiene dos patas: el modelo cambia qué
 * esquinas se escogen (frente a mirar solo el último año) y espera lo que de verdad pasa. No se
 * afirma cómo escoge hoy Bogotá: «una forma común de escoger es contar».
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
import { FORMAS, guionDe, parecidas, type Forma } from './guion'

export type CapituloMov = 'problema' | 'escoge' | 'falla' | 'ysi' | 'antes' | 'resultados' | 'localidad' | 'presupuesto' | 'como' | 'fuentes' | 'cierre'
export type VistaMov = 'portada' | CapituloMov
/** Seis secciones (lo que se ve en la navegación), de una a tres pantallas cada una */
export const SECCIONES_MOV: { nombre: string; vistas: CapituloMov[] }[] = [
  { nombre: 'Problema', vistas: ['problema', 'escoge'] },
  { nombre: 'Solución', vistas: ['falla', 'ysi'] },
  { nombre: 'Antes y después', vistas: ['antes'] },
  { nombre: 'Resultados', vistas: ['resultados', 'localidad', 'presupuesto'] },
  { nombre: 'Cómo se hizo', vistas: ['como', 'fuentes'] },
  { nombre: 'Tu reto', vistas: ['cierre'] },
]
/** Cada pantalla, en orden (el nombre es el que oye Proli) */
export const CAPITULOS_MOV: { id: CapituloMov; nombre: string }[] = [
  { id: 'problema', nombre: 'El presupuesto no alcanza' },
  { id: 'escoge', nombre: '¿Cuáles 3 esquinas arreglarías tú?' },
  { id: 'falla', nombre: '¿Qué falla aquí?' },
  { id: 'ysi', nombre: '¿Y si cada esquina se midiera con toda su información?' },
  { id: 'antes', nombre: 'Antes y después' },
  { id: 'resultados', nombre: 'Resultados' },
  { id: 'localidad', nombre: 'Tu localidad' },
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
  localidad: number | null
  setLocalidad: (l: number | null) => void
  /** presupuesto en millones de pesos */
  monto: number
  setMonto: (m: number) => void
  /** Antes y después: qué lista se ve en el mapa (contando solo 2024 o con el modelo) */
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
const decimal = (n: number, d = 1) => n.toLocaleString('es-CO', { maximumFractionDigits: d })
const veces = (a: number, b: number) => (a / Math.max(1, b)).toLocaleString('es-CO', { maximumFractionDigits: 1 })
/** Fracción de siniestros que evita una obra en barrio (40 % → 0,4) */
const reduccion = (d: DatosMovilidad) => d.experiencia.pantalla_presupuesto_barrio.reduccion_supuesta_pct / 100
export const nombreForma = (d: DatosMovilidad, f: Forma) =>
  f === 'contar1' ? `Contar solo ${anioBase(d)}` : f === 'contar2' ? `Contar ${anioBase(d) - 1} + ${anioBase(d)}` : NOMBRE_MOVILIDAD
const loc = (d: DatosMovilidad, i: number) => nombreLocalidad(d.sitios.localidades[d.sitios.loc[i]])
/** Ancho de una barra: proporcional, dejando sitio para el número al lado */
const ancho = (fraccion: number, rem = 3.4) => `calc((100% - ${rem}rem) * ${Math.max(0, Math.min(1, fraccion))})`
const entrar = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }
/** Las esquinas que escogió el visitante (o, si no escogió, las tres primeras de la lista) */
export const tusEsquinas = (d: DatosMovilidad, tocadas: number[]) => (tocadas.length ? tocadas : guionDe(d).tabla.slice(0, ESQUINAS_A_ESCOGER))

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
function EsperoHubo({ etiqueta, espera, hubo, max, bien = false }: { etiqueta: ReactNode; espera: number; hubo: number; max: number; bien?: boolean }) {
  return (
    <div className={`promesa ${bien ? 'promesa--bien' : ''}`}>
      <div className="promesa__cabeza"><b>{etiqueta}</b></div>
      <div className="promesa__fila"><span className="promesa__etiqueta">Esperaba</span>
        <span className="promesa__pista"><i className={`promesa__barra ${bien ? 'promesa__barra--metodo' : 'promesa__barra--promete'}`} style={{ width: ancho(espera / max) }} /><b>{bien ? `≈ ${entero(espera)}` : entero(espera)}</b></span></div>
      <div className="promesa__fila"><span className="promesa__etiqueta">Hubo</span>
        <span className="promesa__pista"><i className="promesa__barra promesa__barra--ocurrio" style={{ width: ancho(hubo / max), animationDelay: '0.25s' }} /><b>{entero(hubo)}</b></span></div>
    </div>
  )
}

// ---------------------------------------------------------------- portada
export function PortadaMov({ datos, modo, ir, alInicio, alPortada }: PropsMov) {
  const c = datos.experiencia.contexto_ciudad
  const g = guionDe(datos).comparacion30
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
        <motion.span className="kicker" {...entrar} transition={{ delay: 0.15 }}>Seguridad vial · Bogotá</motion.span>
        <motion.p className="portada-mov__contexto" {...entrar} transition={{ delay: 0.2 }}>
          En {anioVal(datos)}, <b>{entero(c.fallecidos_2025)} personas murieron</b> en las vías de Bogotá y <b>{entero(c.lesionados_2025)}</b> resultaron heridas.
          El presupuesto no alcanza para arreglar todas las esquinas.
        </motion.p>
        {/* Las dos patas: el modelo acierta (espera ≈ hubo) y sus esquinas son donde el riesgo sigue (hubo más) */}
        <motion.h1 className="display portada-mov__titulo" {...entrar} transition={{ delay: 0.28 }}>
          <span>Mirando los siniestros del año anterior, en los {entero(g.esquinas)} puntos más peligrosos se esperaban{' '}
            <span className="n-contar">{entero(g.contar1.espera)}</span> siniestros graves. Hubo <span className="n-contar">{entero(g.contar1.hubo)}</span>.</span>
          <span className="portada-mov__l2">Con {NOMBRE_MOVILIDAD} se esperaban {entero(g.modelo.espera)}. Hubo {entero(g.modelo.hubo)}.</span>
        </motion.h1>
        <motion.p className="portada-mov__l3" {...entrar} transition={{ delay: 0.36 }}>
          Mismos datos. Un modelo que separa el riesgo real del azar, para que la plata de las obras viales vaya donde de verdad evita siniestros.
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
      <Respuesta>¿Dónde poner la plata para evitar más siniestros graves?</Respuesta>
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
        <p className="lead">Una forma común de escoger es <b>contar</b>: arreglar las esquinas con más siniestros graves. Estas son las {g.tabla.length} esquinas de barrio con más siniestros graves en {anioBase(datos)}.</p>
      </Cabeza>
      <div className="lista-mov">
        {g.tabla.map((i, k) => (
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
          {listo ? `Ver qué pasó en ${anioVal(datos)} →` : `Escoge ${ESQUINAS_A_ESCOGER - tocadas.length} más`}
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
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const max = Math.max(1, ...mias.flatMap((i) => [s.k24[i], s.k25[i]]))
  const suma = (v: number[]) => mias.reduce((t, i) => t + v[i], 0)
  const c = g.comparacion30.contar1
  const antes = datos.experiencia.pruebas_regresion_a_la_media.un_anio_antes
  return (
    <div className="panel">
      <Cabeza c="falla" titulo={<>¿Qué <em>falla</em> aquí?</>}>
        <p className="lead">{tocadas.length ? 'Escogiste' : 'Estas son'} contando: las de más siniestros graves en {a0}.
          En {tocadas.length ? 'tus esquinas' : 'ellas'} pasaron de <b>{entero(suma(s.k24))} siniestros graves</b> en {a0} a <b>{entero(suma(s.k25))}</b> en {a1}.</p>
      </Cabeza>
      <div className="barras-mov">
        {mias.map((i) => (
          <div key={i} className="barra-mov">
            <span className="barra-mov__n">{g.tabla.indexOf(i) + 1 || '·'}</span>
            <div className="barra-mov__pistas">
              <span className="pista-mov"><i className="pista-mov__antes" style={{ width: `${(s.k24[i] / max) * 75}%` }} />{a0}: <b>{entero(s.k24[i])}</b></span>
              <span className="pista-mov"><i className="pista-mov__despues" style={{ width: `${(s.k25[i] / max) * 75}%` }} />{a1}: <b>{entero(s.k25[i])}</b></span>
            </div>
          </div>
        ))}
      </div>
      <div className="cifras-mov">
        <Cifra n={<>{entero(c.espera)} → {entero(c.hubo)}</>} tono="contar">siniestros graves en {a0} y en {a1} en las {entero(g.comparacion30.esquinas)} esquinas de barrio con más siniestros graves en {a0}</Cifra>
        <Cifra n={<>{entero(g.bajaron)} de {entero(g.comparacion30.esquinas)}</>}>esquinas tuvieron menos siniestros graves en {a1}. Pasa cada año: las {entero(antes.de)} esquinas con más en {antes.anio} bajaron de {entero(antes.graves_antes)} a {entero(antes.graves_despues)} siniestros graves al año siguiente</Cifra>
      </div>
      <Respuesta>Un año muy malo es, en parte, azar. Si solo cuentas, prometes de más y puedes invertir donde el riesgo ya iba a bajar.</Respuesta>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('ysi')}>¿Qué pasaría si…? →</button></Pie>
    </div>
  )
}

/**
 * La animación: una esquina con un año malo. Contar solo el último año espera ese año; contar los dos
 * años, su promedio; el modelo la acerca a lo normal en sus esquinas parecidas (las parecidas la
 * «jalan»). Al final aparece lo que pasó de verdad.
 */
function Arrastre({ datos, i }: { datos: DatosMovilidad; i: number }) {
  const s = datos.sitios
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const k23 = s.k23[i], k24 = s.k24[i], dos = (k23 + k24) / 2, modelo = s.kappa[i], k25 = s.k25[i]
  const normal = parecidas(datos, i).porAnio
  const tope = Math.ceil((Math.max(k23, k24) + 1) / 2) * 2
  const y = (v: number) => 160 - (129 / tope) * v
  const T = { anios: 300, uno: 900, dos: 1900, jalar: 3000, fin: 4800, real: 5100 }
  const quieto = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [t, setT] = useState(quieto ? T.real + 1 : 0)
  useEffect(() => {
    if (quieto) return
    let id = 0
    const inicio = performance.now()
    const p = (ms: number) => { const x = ms - inicio; setT(x); if (x < T.real + 100) id = requestAnimationFrame(p) }
    id = requestAnimationFrame(p)
    return () => cancelAnimationFrame(id)
  }, [quieto])  // eslint-disable-line react-hooks/exhaustive-deps
  const avance = (desde: number, hasta: number) => 1 - (1 - Math.min(1, Math.max(0, (t - desde) / (hasta - desde)))) ** 3
  const v = t < T.dos ? k24 : t < T.jalar ? k24 + (dos - k24) * avance(T.dos, T.dos + 800) : dos + (modelo - dos) * avance(T.jalar, T.fin)
  const texto = t < T.dos ? `Contar ${a0}: ${entero(k24)}` : t < T.jalar ? `Contar dos años: ${decimal(dos)}` : `${NOMBRE_MOVILIDAD}: ≈ ${decimal(modelo)}`
  const grupo = Array.from({ length: 20 }, (_, k) => ({ x: 52 + k * 6.4, y: y(normal) - 4 }))
  const ya = (desde: number) => +(t >= desde)
  return (
    <div className="arrastre-mov">
      <svg viewBox="0 0 340 190" role="img"
           aria-label={`Una esquina de ${loc(datos, i)} con ${k23} siniestros graves en ${a0 - 1} y ${k24} en ${a0}: contar dos años espera ${decimal(dos)}, ${NOMBRE_MOVILIDAD} estima ${decimal(modelo)} y en ${a1} hubo ${k25}`}>
        <line x1="40" x2="330" y1="160" y2="160" className="arrastre-mov__eje" />
        <text x="34" y="164" textAnchor="end">0</text>
        <text x="34" y={y(tope) + 4} textAnchor="end">{tope}</text>
        <text x="8" y="100" transform="rotate(-90 8 100)" textAnchor="middle">siniestros graves al año</text>
        {grupo.map((p, k) => <circle key={k} cx={p.x} cy={p.y} r="2.8" className="arrastre-mov__parecida" style={{ opacity: ya(T.anios) * 0.8 }} />)}
        {t >= T.jalar && grupo.slice(0, 5).map((p, k) => (
          <line key={k} x1={p.x} y1={p.y} x2="222" y2={y(v)} className="arrastre-mov__hilo" style={{ opacity: 0.9 - 0.5 * avance(T.fin, T.fin + 400) }} />
        ))}
        {[[a0 - 1, k23], [a0, k24]].map(([anio, k]) => (
          <g key={anio} style={{ opacity: ya(T.anios) }}>
            <circle cx="205" cy={y(k)} r="4" className="arrastre-mov__anio" />
            <text x="197" y={y(k) + 3.5} textAnchor="end">{anio}: {k}</text>
          </g>
        ))}
        <g style={{ opacity: ya(T.uno) }}>
          <circle cx="222" cy={y(v)} r="8" className="arrastre-mov__esquina" />
          <text x="235" y={y(v) + 4} className="arrastre-mov__fuerte">{texto}</text>
        </g>
        <g style={{ opacity: ya(T.real) }}>
          <circle cx="222" cy={y(k25)} r="6" className="arrastre-mov__real" />
          <text x="235" y={y(k25) + 4} className="arrastre-mov__bueno">{a1}: {k25}</text>
        </g>
        <text x="115" y="182" textAnchor="middle">esquinas parecidas</text>
      </svg>
    </div>
  )
}

export function Ysi({ datos, modo, ir }: PropsMov) {
  const g = guionDe(datos)
  const s = datos.sitios
  const i = g.ejemplo
  const [e0, e1] = datos.resumen.periodo_estimacion
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const par = parecidas(datos, i)
  const pesoParecidas = Math.round(100 * s.alpha[i])
  const [vuelta, setVuelta] = useState(0)
  return (
    <div className="panel">
      <Cabeza c="ysi" titulo={<>¿Y si cada esquina se midiera con <em>toda</em> su información?</>}>
        <p className="lead">{NOMBRE_MOVILIDAD} estima cuántos siniestros graves va a tener de verdad cada esquina:</p>
      </Cabeza>
      <ol className="pasos-mov">
        <li><span><b>Su historia:</b> sus siniestros de {e0} y {e1}, no solo los del último año.</span></li>
        <li><span><b>Sus esquinas parecidas:</b> del mismo tipo de vía (barrio o avenida) y con una cantidad de calle parecida.</span></li>
        <li><span><b>Las combina:</b> si los números de una esquina se salen mucho de lo normal, las parecidas la jalan hacia lo esperado.</span></li>
      </ol>
      <Arrastre key={vuelta} datos={datos} i={i} />
      {modo !== 'auto' && <button className="boton-texto" onClick={() => setVuelta((x) => x + 1)}>↻ Ver de nuevo</button>}
      <p className="nota">Ejemplo real: la esquina de barrio con más siniestros graves en {a0}, en {loc(datos, i)}. Tuvo <b>{s.k23[i]}</b> en {a0 - 1} y <b>{s.k24[i]}</b> en {a0}.
        Contar solo {a0} espera {entero(s.k24[i])} siniestros graves al año; contar los dos años, {decimal(s.bruto[i])}. En sus {entero(par.sitios)} esquinas parecidas lo normal es ≈ {decimal(par.porAnio, 2)} al año:
        casi todas sin siniestros graves. Su historia pesa {100 - pesoParecidas} % y las parecidas, {pesoParecidas} %, así que {NOMBRE_MOVILIDAD} estima <b>≈ {decimal(s.kappa[i])} al año</b>.
        En {a1} tuvo {s.k25[i]} siniestros graves.</p>
      <p className="nota-mov">Mirar más de un año cambia <b>qué esquinas escoges</b>. Separar el azar te dice <b>cuánto vas a evitar</b>.</p>
      <div className="dos-mov">
        <div className="dos-mov__contar">
          <b>Contar</b>
          <span><b>Escoge:</b> las de un año malo.</span>
          <span><b>Promete:</b> de más, porque un año malo cuenta todo como riesgo.</span>
        </div>
        <div className="dos-mov__proli">
          <b>{NOMBRE_MOVILIDAD}</b>
          <span><b>Escoge:</b> las que llevan años con riesgo.</span>
          <span><b>Promete:</b> lo que se cumple, porque separa el riesgo real del azar.</span>
        </div>
      </div>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Qué es cada cosa? ▾</summary>
        <ul className="pruebas-mov">
          <li><b>Siniestro grave:</b> con heridos o muertos (criterio de 30 días).</li>
          <li><b>Esquina:</b> una zona de {tamanoHex(datos)}. Calles de barrio y avenidas se separan con la red vial de OpenStreetMap.</li>
          <li><b>Contar:</b> escoger por los siniestros que ya pasaron, sin corregir el azar.</li>
          <li><b>Modelo:</b> Bayes empírico (Hauer, 1997): mezcla la historia de la esquina con la de sus parecidas.</li>
        </ul>
        <p className="nota">No se sabe con exactitud cómo escoge hoy cada entidad sus esquinas. Aquí se compara con contar siniestros, que es el método básico de la guía
          nacional del Ministerio de Transporte. La misma guía recomienda combinarlo con modelos estadísticos, como este.</p>
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
  const g = G.comparacion30, cambio = G.cambios30
  const s = datos.sitios
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const max = Math.max(...FORMAS.flatMap((f) => [g[f].espera, g[f].hubo]))
  const suma = (v: number[]) => tocadas.reduce((t, i) => t + v[i], 0)
  const quieto = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [listo, setListo] = useState(quieto)
  const terminar = useCallback(() => setListo(true), [])
  const cabeza = (
    <Cabeza c="antes" titulo={<>Antes: escoges contando. <em>Después: escoges con el modelo.</em></>}>
      <p className="lead">Con datos hasta {a0} se escogieron las <b>{entero(g.esquinas)} esquinas de barrio</b> de cada forma. Luego se miró <b>qué pasó en {a1}</b>, un año que el modelo no vio.</p>
    </Cabeza>
  )
  if (!listo) return (
    <div className="panel">
      {cabeza}
      <Piensa alTerminar={terminar} pasos={[
        <>Conectando 3 años de siniestros graves ({a0 - 1}, {a0} y {a1})…</>,
        <>Comparando cada esquina con miles de esquinas parecidas…</>,
        <>Calculando el riesgo real de cada esquina de barrio…</>,
      ]} />
    </div>
  )
  return (
    <motion.div className="panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      {cabeza}
      {tocadas.length > 0 && (
        <div className="tarjeta tarjeta--violeta">
          <span className="etiqueta">Tus {tocadas.length} esquinas</span>
          <p>Contando esperabas <b>{entero(suma(s.k24))} siniestros graves</b> en {a1}. El modelo esperaba <b>≈ {entero(suma(s.kappa))}</b>. Hubo <b>{entero(suma(s.k25))}</b>.</p>
        </div>
      )}
      <p className="nota-mov"><b>Cambian {entero(cambio.salen.n)} de las {entero(g.esquinas)} esquinas</b> frente a contar solo {a0}:</p>
      <div className="cifras-mov">
        <Cifra n={<>{entero(cambio.salen.k24)} → {entero(cambio.salen.k25)}</>} tono="contar">
          siniestros graves en {a0} y en {a1} en las {entero(cambio.salen.n)} que <b>salen</b>. En {a0 - 1} tuvieron {entero(cambio.salen.k23)}: fue un año malo.</Cifra>
        <Cifra n={<>{entero(cambio.entran.k24)} → {entero(cambio.entran.k25)}</>} tono="bueno">
          siniestros graves en {a0} y en {a1} en las {entero(cambio.entran.n)} que <b>entran</b>. En {a0 - 1} tuvieron {entero(cambio.entran.k23)}: llevan años con riesgo.</Cifra>
      </div>
      <div className="promesas promesas--tres">
        {FORMAS.map((f) => <EsperoHubo key={f} etiqueta={nombreForma(datos, f)} espera={g[f].espera} hubo={g[f].hubo} max={max} bien={f === 'modelo'} />)}
      </div>
      <Respuesta>El modelo cambia {entero(cambio.salen.n)} de las {entero(g.esquinas)} esquinas: deja las de un año malo y toma las que llevan años con riesgo.
        Y espera lo que se cumple; contando, se espera hasta {veces(g.contar1.espera, g.contar1.hubo)} veces lo que pasa.</Respuesta>
      {modo !== 'auto' && (
        <div className="segmentos" role="group" aria-label="Qué esquinas se ven en el mapa">
          <button className={`segmento ${lista === 'contar' ? 'segmento--activo' : ''}`} onClick={() => setLista('contar')} data-proli="lista-contar">Contando {a0}</button>
          <button className={`segmento ${lista === 'modelo' ? 'segmento--activo' : ''}`} onClick={() => setLista('modelo')} data-proli="lista-modelo">Con el modelo</button>
        </div>
      )}
      <details className="como-calculamos">
        <summary className="boton-texto">¿Son las mismas esquinas? ▾</summary>
        <ul className="pruebas-mov">
          <li><b>Contando solo {a0}</b>, el modelo coincide en {entero(g.contar1.comun)} de {entero(g.esquinas)}. Las del modelo tuvieron más siniestros graves en {a1}:
            {' '}{entero(g.modelo.hubo)} frente a {entero(g.contar1.hubo)}.</li>
          <li><b>Contando dos años</b>, coinciden {entero(g.contar2.comun)} de {entero(g.esquinas)}: mirar más de un año ya acerca la lista a la del modelo. La diferencia está en
            cuánto se espera: {entero(g.contar2.espera)} siniestros graves frente a ≈ {entero(g.modelo.espera)}.</li>
          <li>Muchas esquinas empatan con el mismo número de siniestros. Los empates se rompen por el año más reciente y luego por el código de la zona, como en el modelo.</li>
        </ul>
      </details>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('resultados')}>¿Y con el presupuesto? →</button></Pie>
    </motion.div>
  )
}

// ---------------------------------------------------------------- 4. Resultados
export function Resultados({ datos, modo, ir }: PropsMov) {
  const G = guionDe(datos)
  const p = G.comparacionPresupuesto, cambio = G.cambiosPresupuesto
  const r = reduccion(datos)
  const esc = datos.experiencia.pantalla_presupuesto_barrio
  const ev = datos.experiencia.evaluacion_obra
  const a0 = anioBase(datos), a1 = anioVal(datos)
  // Barrio o avenidas con el presupuesto medio (la fila del reparto con ese monto)
  const medio = esc.escenarios.medio.presupuesto_millones
  const reparto = datos.experiencia.presupuesto_reparto.filas.find((f) => f.presupuesto_millones === medio)
  const mas = Math.round((p.modelo.hubo - p.contar1.hubo) * r)
  const masPct = Math.round((100 * (p.modelo.hubo - p.contar1.hubo)) / Math.max(1, p.contar1.hubo))
  const fila = (f: Forma) => (
    <tr key={f}>
      <td>{nombreForma(datos, f)}</td>
      <td className={f === 'modelo' ? 'bien' : 'mal'}>{f === 'modelo' ? '≈ ' : ''}{entero(p[f].espera * r)}</td>
      <td>{f === 'modelo' ? <b>{entero(p[f].hubo * r)}</b> : entero(p[f].hubo * r)}</td>
    </tr>
  )
  return (
    <div className="panel">
      <Cabeza c="resultados" titulo={<>Con <em>{millones(esc.escenarios.bajo.presupuesto_millones)}</em>…</>}>
        <p className="lead">Alcanza para reductores de velocidad en <b>{entero(p.esquinas)} esquinas de barrio</b>. Un reductor baja ≈ {entero(esc.reduccion_supuesta_pct)} % los siniestros con heridos.</p>
      </Cabeza>

      <h2 className="subtitulo-mov">Dónde se invierte</h2>
      <div className="cifras-mov">
        <Cifra n={`${mas >= 0 ? '+' : '−'}${entero(Math.abs(mas))}`} tono="bueno">siniestros graves evitados al año con la misma plata, frente a contar solo {a0} ({pct(masPct)})</Cifra>
        <Cifra n={<>{entero(cambio.entran.n)} de {entero(p.esquinas)}</>} tono="acento">esquinas cambian: entran las que llevan años con riesgo</Cifra>
      </div>
      <ul className="nota-mov">
        <li><b>Las {entero(cambio.salen.n)} que escoge contar solo {a0}</b> y el modelo no: tuvieron {entero(cambio.salen.k23)} siniestros graves en {a0 - 1},
          {' '}{entero(cambio.salen.k24)} en {a0} y {entero(cambio.salen.k25)} en {a1}. Un año malo.</li>
        <li><b>Las {entero(cambio.entran.n)} que escoge el modelo</b> en su lugar: tuvieron {entero(cambio.entran.k23)} siniestros graves en {a0 - 1},
          {' '}{entero(cambio.entran.k24)} en {a0} y <b>{entero(cambio.entran.k25)} en {a1}</b>. Riesgo de varios años.</li>
      </ul>
      {reparto && (
        <div className="pregunta-mov">
          <b>¿Barrio o avenidas?</b>
          <span>Según {NOMBRE_MOVILIDAD}, con {millones(medio)}: si todo se invierte en reductores de velocidad en calles de barrio, se evitarían
            ≈ <b>{entero(reparto.todo_en_barrio)} siniestros graves al año</b>; si todo se invierte en semáforos con paso peatonal anticipado en avenidas,
            ≈ <b>{entero(reparto.todo_en_avenidas)} al año</b>. Saber cuántos siniestros evita cada peso en cada tipo de vía dice dónde ponerlo.</span>
        </div>
      )}

      <h2 className="subtitulo-mov">Cuánto se logra</h2>
      <div className="tabla-mov">
        <table>
          <thead><tr><th>Siniestros graves al año</th><th>Promete evitar</th><th>Se evitan ≈</th></tr></thead>
          <tbody>{FORMAS.map(fila)}</tbody>
        </table>
      </div>
      <div className="cifras-mov">
        <Cifra n={<>{entero(p.modelo.espera * r)} ≈ {entero(p.modelo.hubo * r)}</>} tono="acento">siniestros graves al año: lo que {NOMBRE_MOVILIDAD} promete evitar y lo que se evita. Una meta que se puede firmar y cumplir</Cifra>
        <Cifra n={<>{entero(p.contar1.espera * r)} → {entero(p.contar1.hubo * r)}</>} tono="contar">siniestros graves al año: lo que promete evitar contar solo {a0} y lo que de verdad se evita</Cifra>
      </div>
      <div className="pregunta-mov">
        <b>¿Y si se cuentan dos años?</b>
        <span>Se escogen casi las mismas esquinas ({entero(p.contar2.comun)} de {entero(p.esquinas)} en común), y con ellas se evitan incluso un poco más
          (≈ {entero(p.contar2.hubo * r)} siniestros graves al año frente a ≈ {entero(p.modelo.hubo * r)}). La diferencia está en la promesa: contando dos años
          se promete evitar {entero(p.contar2.espera * r)} al año; el modelo promete ≈ {entero(p.modelo.espera * r)}.</span>
      </div>

      <h2 className="subtitulo-mov">¿Funcionó la obra?</h2>
      <p className="nota-mov">Si en enero de {a1} se hubiera hecho una obra en las {entero(ev.esquinas)} esquinas con más siniestros de {a0}:</p>
      <div className="dos-mov">
        <div className="dos-mov__contar">
          <b>Antes y después</b>
          <span>Esas {entero(ev.esquinas)} esquinas pasaron de {entero(ev.antes_2024)} siniestros graves en {a0} a {entero(ev.despues_2025)} en {a1}:
            parece que la obra los bajó un <b>{pct(Math.abs(ev.efecto_antes_despues_pct), false)}</b>.</span>
        </div>
        <div className="dos-mov__proli">
          <b>Con {NOMBRE_MOVILIDAD}</b>
          <span>Aun sin obra, el modelo ya esperaba que bajaran a ≈ {entero(ev.esperado_sin_obra)} siniestros graves en {a1}, porque {a0} fue un año malo.
            Hubo {entero(ev.despues_2025)}: a la obra se le puede atribuir <b>a lo sumo ≈ {pct(Math.round(Math.abs(ev.efecto_con_metodo_pct)), false)} menos siniestros graves</b>.</span>
        </div>
      </div>
      <p className="nota">Si además se descuenta que en {a1} bajó toda la ciudad ({pct(ev.tendencia_ciudad_pct)}), casi nada. Es un ejemplo hipotético: no se sabe si allí hubo obras.</p>

      <Respuesta>Más siniestros evitados con la misma plata, metas que se cumplen y saber qué obra funciona.</Respuesta>
      <Pie modo={modo}>
        <button className="boton boton--ancho boton--violeta" onClick={() => ir('localidad')}>Mira tu localidad →</button>
        <button className="boton-texto" onClick={() => ir('presupuesto')} data-proli="cap-presupuesto">¿Cuánto se evita con cada presupuesto?</button>
      </Pie>
    </div>
  )
}

export function Localidad({ datos, modo, ir, localidad, setLocalidad }: PropsMov) {
  const G = guionDe(datos)
  const p = G.comparacionPresupuesto
  const esc = datos.experiencia.pantalla_presupuesto_barrio.escenarios.bajo
  const fila = localidad == null ? null : G.porLocalidad.find((f) => f.loc === localidad) ?? null
  const nombre = localidad == null ? '' : nombreLocalidad(datos.sitios.localidades[localidad])
  const max = fila ? Math.max(1, ...FORMAS.flatMap((f) => [fila.espera[f], fila.hubo[f]])) : 1
  return (
    <div className="panel">
      <Cabeza c="localidad" titulo={localidad == null ? <>Mira tu <em>localidad</em></>
        : <>{nombre}: <em>{fila && fila.esquinas.modelo ? `${entero(fila.esquinas.modelo)} ${fila.esquinas.modelo === 1 ? 'esquina' : 'esquinas'}` : 'ninguna esquina'}</em></>}>
        <p className="lead">Con {millones(esc.presupuesto_millones)} ({entero(p.esquinas)} esquinas de barrio en toda Bogotá), ¿cuántas le tocan a tu localidad y qué se puede esperar?</p>
      </Cabeza>
      {localidad == null ? (
        <>
          <div className="chips chips--localidades">
            {G.porLocalidad.map((f) => (
              <button key={f.loc} className="chip" disabled={modo === 'auto'} onClick={() => setLocalidad(f.loc)} data-proli={`localidad-${f.loc}`}>
                {nombreLocalidad(datos.sitios.localidades[f.loc])} <small>{entero(f.esquinas.modelo)}</small>
              </button>
            ))}
          </div>
          <p className="nota">El número es cuántas esquinas le tocan con {NOMBRE_MOVILIDAD}. También puedes tocar la localidad en el mapa.</p>
        </>
      ) : fila ? (
        <>
          <div className="cifras-mov">
            <Cifra n={entero(fila.esquinas.modelo)} tono="bueno">esquinas le tocan con {NOMBRE_MOVILIDAD}</Cifra>
            <Cifra n={entero(fila.hubo.modelo)}>siniestros graves tuvieron esas esquinas en {anioVal(datos)} (el modelo esperaba ≈ {entero(fila.espera.modelo)})</Cifra>
          </div>
          <div className="promesas">
            {FORMAS.filter((f) => fila.esquinas[f] > 0).map((f) => (
              <EsperoHubo key={f} etiqueta={<>{nombreForma(datos, f)} <small>· {entero(fila.esquinas[f])} {fila.esquinas[f] === 1 ? 'esquina' : 'esquinas'}</small></>}
                          espera={fila.espera[f]} hubo={fila.hubo[f]} max={max} bien={f === 'modelo'} />
            ))}
          </div>
          <p className="nota">Siniestros graves al año en las esquinas de {nombre} que entran con ese presupuesto, según cada forma de escoger.</p>
        </>
      ) : <p className="nota">Con ese presupuesto no entra ninguna esquina de {nombre}: hay otras con más riesgo.</p>}
      <Pie modo={modo}>
        <button className="boton boton--ancho boton--violeta" onClick={() => ir('presupuesto')}>¿Cuánto se evita con cada presupuesto? →</button>
        {localidad != null && <button className="boton-texto" onClick={() => setLocalidad(null)}>← Ver otra localidad</button>}
      </Pie>
    </div>
  )
}

/** La curva: siniestros evitados al año según el monto (modelo) y lo que se prometería contando dos años. */
function CurvaPresupuesto({ datos, puntos, monto }: { datos: DatosMovilidad; puntos: PuntoCurva[]; monto: number }) {
  const W = 320, H = 150, m = { izq: 6, der: 6, arr: 10, aba: 20 }
  const xMax = puntos[puntos.length - 1].presupuesto_millones
  const yMax = Math.max(...puntos.map((p) => p.a_ojo_promete))
  const x = (v: number) => m.izq + (W - m.izq - m.der) * (v / xMax)
  const y = (v: number) => H - m.aba - (H - m.arr - m.aba) * (v / yMax)
  const linea = (k: 'metodo_esperado' | 'a_ojo_promete') =>
    `M${x(0)},${y(0)} ` + puntos.map((p) => `L${x(p.presupuesto_millones).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ')
  const p = puntos.find((q) => q.presupuesto_millones === monto) ?? puntos[0]
  const contar = nombreForma(datos, 'contar2')
  const derecha = x(monto) > W * 0.75
  return (
    <figure className="curva">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`Con ${millones(p.presupuesto_millones)} se evitarían ≈ ${entero(p.metodo_esperado)} siniestros graves al año; ${contar.toLowerCase()} prometería evitar ${entero(p.a_ojo_promete)}.`}>
        <line x1={x(0)} x2={x(xMax)} y1={y(0)} y2={y(0)} className="curva__base" />
        <path d={linea('a_ojo_promete')} className="curva__ojo" />
        <path d={linea('metodo_esperado')} className="curva__metodo" />
        <line x1={x(monto)} x2={x(monto)} y1={m.arr} y2={y(0)} className="curva__guia" />
        <circle cx={x(monto)} cy={y(p.a_ojo_promete)} r="3.2" className="curva__punto curva__punto--ojo" />
        <circle cx={x(monto)} cy={y(p.metodo_esperado)} r="4.2" className="curva__punto" />
        <text x={x(monto) + (derecha ? -7 : 7)} y={y(p.a_ojo_promete) - 4} textAnchor={derecha ? 'end' : 'start'} className="curva__valor curva__valor--ojo">{entero(p.a_ojo_promete)}</text>
        <text x={x(monto) + (derecha ? -7 : 7)} y={y(p.metodo_esperado) + 13} textAnchor={derecha ? 'end' : 'start'} className="curva__valor">≈ {entero(p.metodo_esperado)}</text>
        <text x={x(0)} y={H - 5} className="curva__eje">$0</text>
        <text x={x(xMax)} y={H - 5} textAnchor="end" className="curva__eje">{millones(xMax)}</text>
      </svg>
      <figcaption className="curva__leyenda">
        <span><i className="curva__clave curva__clave--metodo" />{NOMBRE_MOVILIDAD}: lo que se evitaría</span>
        <span><i className="curva__clave curva__clave--ojo" />{contar.toLowerCase()}: lo que se prometería</span>
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
        <p className="lead">Elige cuánto invertir en reductores de velocidad (≈ {entero(p.costo_por_esquina_millones)} millones por esquina). {NOMBRE_MOVILIDAD} los pone en las
          esquinas de más riesgo real y te dice cuántos siniestros graves se evitarían.</p>
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
                 frase="siniestros graves menos al año"
                 nota={<>Más dinero alcanza más esquinas, pero cada peso rinde un poco menos: primero van las de más riesgo.</>} />
      <div className="promesas-duelo">
        <div className="promesa-fila promesa-fila--mal">
          <b>{nombreForma(datos, 'contar2')}</b>
          <span>Prometes evitar <b>{entero(e.a_ojo_promete)} siniestros graves al año</b>; según el modelo se evitarían <b>≈ {entero(e.a_ojo_esperado)}</b>.</span>
        </div>
        <div className="promesa-fila promesa-fila--bien">
          <b>{NOMBRE_MOVILIDAD}</b>
          <span>Prometes evitar <b>≈ {entero(e.metodo_esperado)} siniestros graves al año</b>; se evitarían <b>≈ {entero(e.metodo_esperado)}</b>.</span>
        </div>
      </div>
      <p className="lectura">Contando dos años se escogen casi las mismas obras, pero se promete de más. Con {NOMBRE_MOVILIDAD}, prometes lo que puedes cumplir.</p>
      <CurvaPresupuesto datos={datos} puntos={puntos} monto={e.presupuesto_millones} />
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
      <p className="nota">Siniestros graves menos al año con {millones(fila.presupuesto_millones)}. Un reductor cuesta ≈ {entero(r.costos_millones.local)} millones; un semáforo con paso peatonal anticipado,
        hasta ≈ {entero(r.costos_millones.arterial)} millones. Si en avenidas solo hay que reprogramar el semáforo (menos de ≈ {entero(fila.avenidas_compiten_si_cuestan_menos_de_millones)} millones), conviene sumarlas.</p>
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
        <div className="cajita-mov"><b>Riesgo real de cada esquina</b><span>Su historia y la de sus esquinas parecidas (Bayes empírico, Hauer 1997).</span></div>
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
        <p className="lead">Lo que hicimos aquí con las vías lo podemos hacer con tus datos: conectarlos, medir el riesgo real, decidir antes de invertir <b>y saber después si funcionó</b>.</p>
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
