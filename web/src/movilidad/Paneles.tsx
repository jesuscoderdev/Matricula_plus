/**
 * Las pantallas de Presupuesto+, en el formato vertical que pidió Paola (29 oct): una sola columna,
 * sin scroll, con un titular, un visual (el mapa u otro), una conclusión y un solo botón principal.
 * Cada pantalla devuelve esas piezas (`Pantalla`) y Movilidad.tsx las acomoda: en vertical, una debajo
 * de otra; en horizontal, el texto a la izquierda y el visual a la derecha.
 *
 * Recorrido: Portada → 1 Problema → 2 Solución → 3 Antes y después → 4 Resultados → 5 Cómo lo hicimos
 * → 6 Tu reto. Los detalles (metodología, dos años) se abren aparte, en una hoja.
 *
 * Ninguna cifra se escribe a mano: salen de los datos (experiencia.json, fuentes.json, resumen.json,
 * sitios.geojson), casi todas a través de guion.ts. El mensaje: con el mismo presupuesto, analizar más
 * información cambia 46 decisiones de inversión. No se presentan siniestros evitados como resultado:
 * dependen de un supuesto de efectividad y solo van en la metodología, como escenario hipotético.
 */
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import Proli from '../componentes/Proli'
import QrCita from '../componentes/QrCita'
import { EMPRESA, NOMBRE_MOVILIDAD, URL_CITA, urlCitaCon } from '../config'
import { pedirAProli } from '../proli/ordenes'
import { esTotem, type Modo } from '../modo'
import { entero, millones, pctFraccion, type DatosMovilidad } from './datos'
import { guionDe } from './guion'

export type CapituloMov = 'problema' | 'solucion' | 'antes' | 'resultados' | 'como' | 'reto'
export type VistaMov = 'portada' | CapituloMov
/** Cada paso, en orden (el nombre es el que oye Proli y el que se ve junto a «Paso N de 6») */
export const CAPITULOS_MOV: { id: CapituloMov; nombre: string }[] = [
  { id: 'problema', nombre: 'El problema' },
  { id: 'solucion', nombre: 'La solución' },
  { id: 'antes', nombre: 'Antes y después' },
  { id: 'resultados', nombre: 'Resultados' },
  { id: 'como', nombre: 'Cómo lo hicimos' },
  { id: 'reto', nombre: 'Tu reto' },
]
export const pasoDe = (c: CapituloMov) => CAPITULOS_MOV.findIndex((x) => x.id === c) + 1
/** Detalles opcionales: se abren en una hoja encima de la pantalla */
export type Hoja = 'metodologia' | 'dosAnios'

export interface PropsMov {
  datos: DatosMovilidad
  modo: Modo
  ir: (v: VistaMov) => void
  /** Antes y después: qué selección se ve (la basada en 2024 o la de Presupuesto+) */
  lista: 'contar' | 'modelo'
  setLista: (l: 'contar' | 'modelo') => void
  /** Tu reto: el QR para agendar, en el tótem */
  verQr: boolean
  setVerQr: (v: boolean) => void
  abrirHoja: (h: Hoja) => void
  /** el reto que el visitante ya le contó a Proli (va en el enlace para agendar) */
  reto: string
  alInicio?: () => void
}

/** Las piezas de una pantalla. Sin `visual`, en su lugar va el mapa. */
export interface Pantalla {
  titular: ReactNode
  visual?: ReactNode
  /** encima del mapa (p. ej. el selector de Antes y después) */
  sobreMapa?: ReactNode
  conclusion?: ReactNode
  accion?: ReactNode
  /** botones de texto, discretos, debajo del principal */
  secundarias?: ReactNode
}

// --- Datos derivados (todo sale de los archivos) ---
export const anioBase = (d: DatosMovilidad) => d.experiencia.pantalla_1_usted_decide.anio_mostrado
export const anioVal = (d: DatosMovilidad) => d.resumen.anio_validacion
/** "115 m", leído de la unidad del modelo */
export const tamanoHex = (d: DatosMovilidad) => d.resumen.unidad.match(/[\d.,]+\s*m\b/)?.[0] ?? ''
const escenario = (d: DatosMovilidad) => d.experiencia.pantalla_presupuesto_barrio.escenarios.bajo
const costo = (d: DatosMovilidad) => d.experiencia.pantalla_presupuesto_barrio.costo_por_esquina_millones
export const etiquetasMapa = (d: DatosMovilidad) => ({
  fondo: `Zonas de ${tamanoHex(d)} con siniestros graves — ${anioBase(d)}`,
  seleccion: `Selección basada en ${anioBase(d)}`,
  ambas: 'En las dos selecciones',
  salen: `Solo selección ${anioBase(d)}`,
  entran: `Solo ${NOMBRE_MOVILIDAD}`,
})

const entrar = (k: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.1 + 0.12 * k, duration: 0.35 } })
const Boton = ({ children, onClick, proli }: { children: ReactNode; onClick: () => void; proli?: string }) => (
  <button className="boton boton--violeta boton--ancho pp__boton" onClick={onClick} data-proli={proli}>{children}</button>
)

// ---------------------------------------------------------------- portada
export function portada({ modo, ir }: PropsMov): Pantalla {
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo pp__titulo--xl" {...entrar(0)}>
          Mismo presupuesto. Más información. <em>Decisiones diferentes.</em>
        </motion.h1>
        <motion.p className="pp__bajada" {...entrar(1)}>¿Dónde invertirías primero para mejorar la seguridad vial de Bogotá?</motion.p>
      </>
    ),
    conclusion: (
      <motion.div className="pp__proli" {...entrar(2)}>
        <Proli tamano={4.2} globo={<>Te voy a mostrar lo que cambia cuando miramos más allá de los datos del último año.</>} />
      </motion.div>
    ),
    accion: modo !== 'auto' && <Boton onClick={() => ir('problema')} proli="cap-problema">Descubrir →</Boton>,
    secundarias: esTotem(modo) && <span className="toca">{modo === 'auto' ? 'Recorrido automático' : `Toca para empezar · ${NOMBRE_MOVILIDAD}`}</span>,
  }
}

// ---------------------------------------------------------------- 1. El problema
export function problema({ datos, modo, ir }: PropsMov): Pantalla {
  const g = guionDe(datos)
  const esc = escenario(datos)
  return {
    titular: (
      <>
        <h1 className="pp__cifras">
          <motion.span {...entrar(0)}><b>{entero(g.conGraves)}</b> lugares para intervenir.</motion.span>
          <motion.span {...entrar(1)}>Recursos para <b className="pp__morado">{entero(esc.esquinas)}</b>.</motion.span>
        </h1>
        <motion.span className="pp__etiqueta" {...entrar(2)}>Escenario ilustrativo; costo supuesto de {millones(costo(datos))} por intervención</motion.span>
      </>
    ),
    conclusion: (
      <>
        <p className="pp__texto">En nuestro escenario de Bogotá, un presupuesto de {millones(esc.presupuesto_millones)} permite intervenir aproximadamente {entero(esc.esquinas)} zonas de barrio.</p>
        <p className="pp__remate">La pregunta no es solo cuánto invertir. Es dónde hacerlo primero.</p>
      </>
    ),
    accion: modo !== 'auto' && <Boton onClick={() => ir('solucion')} proli="cap-solucion">Descubrir cómo se eligen →</Boton>,
  }
}

// ---------------------------------------------------------------- 2. La solución
/** Dos grupos de barras: los siniestros graves de cada año en las 46 que salen y en las 46 que entran */
function DosPeriodos({ datos }: { datos: DatosMovilidad }) {
  const c = guionDe(datos).cambiosPresupuesto
  const a0 = anioBase(datos)
  const max = Math.max(c.salen.k23, c.salen.k24, c.entran.k23, c.entran.k24, 1)
  const grupos = [
    { clave: 'salen', titulo: <><b>{entero(c.salen.n)} zonas</b> seleccionadas únicamente por {a0}</>, v: [c.salen.k23, c.salen.k24] },
    { clave: 'entran', titulo: <><b>{entero(c.entran.n)} zonas</b> incorporadas por {NOMBRE_MOVILIDAD}</>, v: [c.entran.k23, c.entran.k24] },
  ]
  return (
    <div className="periodos">
      <div className="periodos__grupos">
        {grupos.map((gr, k) => (
          <figure key={gr.clave} className={`periodos__grupo periodos__grupo--${gr.clave}`}>
            <div className="periodos__barras">
              {gr.v.map((v, j) => (
                <div key={j} className="periodos__col">
                  <motion.b className="periodos__valor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + 0.5 * j + 0.15 * k }}>{entero(v)}</motion.b>
                  <motion.i className={`periodos__barra periodos__barra--${j}`} style={{ height: `calc((100% - 2.2em) * ${v / max})` }}
                            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.3 + 0.5 * j + 0.15 * k, duration: 0.6, ease: 'easeOut' }} />
                </div>
              ))}
            </div>
            <div className="periodos__anios">{gr.v.map((_, j) => <span key={j}>{a0 - 1 + j}</span>)}</div>
            <figcaption>{gr.titulo}</figcaption>
          </figure>
        ))}
      </div>
      <p className="periodos__unidad">Siniestros graves por año</p>
      <p className="periodos__nota">Estos números corresponden a los grupos que difieren entre selecciones, no a las {entero(escenario(datos).esquinas)} zonas completas.</p>
    </div>
  )
}

export function solucion({ datos, modo, ir }: PropsMov): Pantalla {
  const [e0, e1] = datos.resumen.periodo_estimacion
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo pp__titulo--m" {...entrar(0)}>
          ¿Y si las esquinas más peligrosas no fueran simplemente las que tuvieron más accidentes <em>el último año</em>?
        </motion.h1>
        <motion.p className="pp__bajada" {...entrar(1)}>Mirar un solo período puede ocultar patrones importantes.</motion.p>
      </>
    ),
    visual: <DosPeriodos datos={datos} />,
    conclusion: (
      <>
        <p className="pp__remate">Una sola cifra no cuenta toda la historia.</p>
        <p className="pp__texto">{NOMBRE_MOVILIDAD} analiza los registros de {e0} y {e1} y compara lugares con comportamientos similares para estimar su riesgo.</p>
      </>
    ),
    accion: modo !== 'auto' && <Boton onClick={() => ir('antes')} proli="cap-antes">Ver qué cambia →</Boton>,
  }
}

// ---------------------------------------------------------------- 3. Antes y después
export function antes({ datos, modo, ir, lista, setLista }: PropsMov): Pantalla {
  const g = guionDe(datos)
  const n = g.comparacionPresupuesto.esquinas
  const visto = lista === 'modelo'
  const a0 = anioBase(datos)
  return {
    titular: (
      <motion.h1 className="display pp__titulo" {...entrar(0)}>
        Con el mismo presupuesto, cambian <em>{entero(g.entranPresupuesto.length)}</em> decisiones de inversión.
      </motion.h1>
    ),
    sobreMapa: (
      <>
        {modo !== 'auto' && (
          <div className="segmentos pp__segmentos" role="group" aria-label="Qué selección se ve en el mapa">
            <button className={`segmento ${!visto ? 'segmento--activo' : ''}`} onClick={() => setLista('contar')} data-proli="lista-contar">Selección {a0}</button>
            <button className={`segmento ${visto ? 'segmento--activo' : ''}`} onClick={() => setLista('modelo')} data-proli="lista-modelo">Ver {NOMBRE_MOVILIDAD}</button>
          </div>
        )}
      </>
    ),
    conclusion: (
      <>
      {visto && (
        <motion.div key="msg" className="pp__mensaje" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, duration: 0.4 }}>
          {entero(g.entranPresupuesto.length)} decisiones diferentes
        </motion.div>
      )}
      <div className="pp__conteo">
        <div><b>{entero(n)}</b><span>intervenciones posibles con ambos métodos</span></div>
        <div className={visto ? '' : 'pp__oculto'}><b>{entero(g.comunesPresupuesto.length)}</b><span>lugares coinciden</span></div>
        <div className={`pp__conteo--salen ${visto ? '' : 'pp__oculto'}`}><b>{entero(g.salenPresupuesto.length)}</b><span>salen de la selección</span></div>
        <div className={`pp__conteo--entran ${visto ? '' : 'pp__oculto'}`}><b>{entero(g.entranPresupuesto.length)}</b><span>lugares diferentes entran con {NOMBRE_MOVILIDAD}</span></div>
      </div>
      </>
    ),
    accion: modo !== 'auto' && (visto
      ? <Boton onClick={() => ir('resultados')} proli="cap-resultados">¿Qué revelan los resultados? →</Boton>
      : <Boton onClick={() => setLista('modelo')}>Ver {NOMBRE_MOVILIDAD}</Boton>),
  }
}

// ---------------------------------------------------------------- 4. Resultados
export function resultados({ datos, modo, ir, abrirHoja }: PropsMov): Pantalla {
  const p = guionDe(datos).comparacionPresupuesto
  const [e0, e1] = datos.resumen.periodo_estimacion
  const a0 = anioBase(datos), a1 = anioVal(datos)
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo pp__titulo--m" {...entrar(0)}>¿Qué pasó después en los lugares seleccionados?</motion.h1>
        <motion.p className="pp__bajada" {...entrar(1)}>Usamos los datos de {e0} y {e1} para definir las selecciones y observamos qué ocurrió en {a1}.</motion.p>
      </>
    ),
    sobreMapa: <span className="pp__etiqueta pp__etiqueta--mapa">Análisis retrospectivo</span>,
    conclusion: (
      <>
        <div className="pp__dos">
          <div className="pp__dos-uno">
            <span>Selección basada en {a0}</span>
            <b>{entero(p.contar1.hubo)}</b>
            <small>siniestros graves registrados en {a1}</small>
          </div>
          <div className="pp__dos-uno pp__dos-uno--destacado">
            <span>Selección con {NOMBRE_MOVILIDAD}</span>
            <b>{entero(p.modelo.hubo)}</b>
            <small>siniestros graves registrados en {a1}</small>
          </div>
        </div>
        <p className="pp__remate">Identificamos lugares con mayor siniestralidad posterior.</p>
        <p className="pp__texto"><b>¿Qué significa?</b> En esta comparación retrospectiva, {NOMBRE_MOVILIDAD} identificó un conjunto de lugares donde posteriormente se
          registraron más siniestros graves. Eso es relevante para priorizar el análisis del riesgo.</p>
      </>
    ),
    accion: modo !== 'auto' && <Boton onClick={() => ir('como')} proli="cap-como">Descubrir cómo lo hicimos →</Boton>,
    secundarias: modo !== 'auto' && <button className="boton-texto" onClick={() => abrirHoja('dosAnios')}>¿Y si se miran dos años?</button>,
  }
}

// ---------------------------------------------------------------- 5. Cómo lo hicimos
const ICONOS: Record<string, ReactNode> = {
  datos: <><ellipse cx="12" cy="5.5" rx="7" ry="2.6" /><path d="M5 5.5v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-6M5 11.5v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-6" /></>,
  riesgo: <><path d="M4 19V5M4 19h16" /><path d="M7 15l4-4 3 3 5-6" /><circle cx="19" cy="8" r="1.3" /></>,
  decision: <><path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><path d="M9.3 10.6l2 2 3.5-3.6" /></>,
}
function Etapas() {
  const etapas = [['datos', 'Datos conectados'], ['riesgo', 'Riesgo estimado'], ['decision', 'Decisiones mejor informadas']]
  return (
    <div className="etapas" aria-label="Datos conectados, luego riesgo estimado, luego decisiones mejor informadas">
      {etapas.map(([icono, titulo], k) => (
        <motion.div key={icono} className="etapas__paso" {...entrar(k * 2)}>
          {k > 0 && <span className="etapas__flecha" aria-hidden>↓</span>}
          <div className="etapas__modulo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONOS[icono]}</svg>
            <b>{titulo}</b>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export function como({ modo, ir, abrirHoja }: PropsMov): Pantalla {
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo" {...entrar(0)}>Los datos estaban ahí. <em>Había que ponerlos a trabajar.</em></motion.h1>
        <motion.p className="pp__bajada" {...entrar(1)}>Conectamos información histórica, características de las vías y patrones de lugares similares.</motion.p>
      </>
    ),
    visual: <Etapas />,
    conclusion: <p className="pp__texto">Construimos un modelo matemático que permite estimar el riesgo y apoyar la priorización del presupuesto.</p>,
    accion: modo !== 'auto' && <Boton onClick={() => ir('reto')} proli="cap-reto">¿Y en tu entidad? →</Boton>,
    secundarias: modo !== 'auto' && <button className="boton-texto" onClick={() => abrirHoja('metodologia')} data-proli="cap-metodologia">Consultar metodología</button>,
  }
}

// ---------------------------------------------------------------- 6. Tu reto
export function reto({ modo, ir, verQr, setVerQr, reto: suReto, alInicio }: PropsMov): Pantalla {
  const totem = esTotem(modo)
  const agendar = () => (totem || !URL_CITA ? setVerQr(!verQr) : window.open(urlCitaCon(suReto), '_blank', 'noopener'))
  return {
    titular: (
      <motion.h1 className="display pp__titulo pp__titulo--m" {...entrar(0)}>
        ¿Qué decisiones de tu entidad podrían mejorar si pusieras <em>todos tus datos a trabajar</em>?
      </motion.h1>
    ),
    visual: (
      <div className="pp__reto">
        {verQr ? <QrCita /> : (
          <Proli tamano={9} globo={<>Ya viste lo que encontramos con datos públicos. Imagina qué podríamos descubrir con <b>la información de tu entidad</b>.</>} />
        )}
      </div>
    ),
    conclusion: <p className="pp__marca"><b>{EMPRESA}</b> — Convertimos datos en inteligencia que actúa.</p>,
    accion: modo !== 'auto' && <Boton onClick={() => pedirAProli('Tengo un reto en mi entidad')}>Contarle mi reto a Proli →</Boton>,
    secundarias: modo !== 'auto' && (
      <>
        <button className="boton boton--claro boton--ancho pp__boton-2" onClick={agendar} data-proli="cap-reto">{verQr ? 'Volver a Proli' : 'Agendar una conversación →'}</button>
        <div className="fila pp__fila">
          <button className="boton-texto" onClick={() => ir('portada')}>Ver de nuevo</button>
          {alInicio && <button className="boton-texto" onClick={alInicio}>Ver otros proyectos</button>}
        </div>
      </>
    ),
  }
}

export const PANTALLAS: Record<VistaMov, (p: PropsMov) => Pantalla> = { portada, problema, solucion, antes, resultados, como, reto }

// ---------------------------------------------------------------- hojas (detalles opcionales)
export function HojaDosAnios({ datos }: { datos: DatosMovilidad }) {
  const p = guionDe(datos).comparacionPresupuesto
  const a0 = anioBase(datos), a1 = anioVal(datos)
  return (
    <>
      <h2 className="display display--m">¿Y si se miran dos años?</h2>
      <ul className="pruebas-mov">
        <li>Mirando {a0 - 1} y {a0} se escogen casi las mismas zonas que con {NOMBRE_MOVILIDAD} ({entero(p.contar2.comun)} de {entero(p.esquinas)}), y en {a1} tuvieron
          {' '}{entero(p.contar2.hubo)} siniestros graves. Mirar más de un año ya es sumar información.</li>
        <li>La diferencia está en cuánto se espera. Mirando los dos años, se esperaría que en {a1} se repitiera su promedio:
          {' '}{entero(p.contar2.espera)} siniestros graves en esas zonas, y hubo {entero(p.contar2.hubo)}. {NOMBRE_MOVILIDAD}, que suma los lugares
          parecidos, esperaba ≈ {entero(p.modelo.espera)} y hubo {entero(p.modelo.hubo)}.</li>
        <li>Muchas zonas empatan con el mismo número de siniestros. Los empates se rompen por el año más reciente y luego por el código de la zona, como en el modelo.</li>
      </ul>
    </>
  )
}

export function HojaMetodologia({ datos, modo }: { datos: DatosMovilidad; modo: Modo }) {
  const r = datos.resumen
  const f = datos.fuentes
  const [e0, e1] = r.periodo_estimacion
  const a1 = anioVal(datos)
  const esc = escenario(datos)
  const pb = datos.experiencia.pantalla_presupuesto_barrio
  const p = guionDe(datos).comparacionPresupuesto
  const red = pb.reduccion_supuesta_pct / 100
  const totem = esTotem(modo)
  // Solo las fuentes que usa el recorrido: siniestros, red vial y lo de los reductores (costo y efectividad)
  const usadas = f.fuentes.filter((x) => !/semaf|peatonal/i.test(x.dato))
  return (
    <>
      <h2 className="display display--m">Metodología</h2>
      <dl className="metodo-mov">
        <dt>Períodos y fuentes</dt>
        <dd>Las selecciones se calcularon con {e0} y {e1}. {a1} se usó solo para comparar después: no entró en el cálculo del riesgo ni en la selección.
          <ul className="fuentes-mov">
            {usadas.map((x) => (
              <li key={x.dato}><b>{x.dato}</b><span>{x.fuente} · {x.anio}</span>
                {!totem && <a href={x.url} target="_blank" rel="noopener noreferrer">{x.url.replace(/^https?:\/\//, '').split('/')[0]}</a>}</li>
            ))}
          </ul>
        </dd>
        <dt>Zonas geográficas</dt>
        <dd>Bogotá se dividió en zonas de {tamanoHex(datos)}: {entero(r.universo.por_zona.local)} de barrio y {entero(r.universo.por_zona.arterial)} de avenida. {f.cruces}</dd>
        <dt>Bayes empírico</dt>
        <dd>El riesgo de cada zona mezcla su propia historia con la de las zonas parecidas (Hauer, 1997). Si un año se sale de lo normal, las parecidas lo equilibran.</dd>
        <dt>Variables de comparación</dt>
        <dd>Las zonas parecidas son del mismo tipo de vía y con una cantidad de calle similar.</dd>
        <dt>Restricción presupuestal</dt>
        <dd>Las dos selecciones usan el mismo presupuesto ({millones(esc.presupuesto_millones)}), el mismo costo por intervención ({millones(pb.costo_por_esquina_millones)}) y el mismo
          número de zonas ({entero(esc.esquinas)}), todas en calles de barrio.</dd>
        <dt>Validación retrospectiva</dt>
        <dd>{f.metodo_validacion}</dd>
        <dt>Supuestos y limitaciones</dt>
        <dd>
          <ul className="pruebas-mov">
            <li>El presupuesto y el costo son de referencia para el ejercicio, no una partida oficial.</li>
            <li>No se tienen en cuenta obras hechas en {e1} o {a1} que pudieran cambiar los siniestros de {a1}.</li>
            <li>En {a1} los siniestros graves cambiaron en toda la ciudad ({pctFraccion(r.validacion_2025.local.tendencia_2025_vs_promedio)} en calles de barrio frente al promedio de {e0} y {e1}).</li>
            <li><b>Escenario hipotético:</b> si cada intervención redujera un {entero(pb.reduccion_supuesta_pct)} % los siniestros con heridos (CMF Clearinghouse, ID 132), con los
              siniestros de {a1} se habrían evitado ≈ {entero(p.modelo.hubo * red)} al año en la selección de {NOMBRE_MOVILIDAD} y ≈ {entero(p.contar1.hubo * red)} en la basada
              en {anioBase(datos)}. Depende de ese supuesto: no es un resultado comprobado.</li>
            <li>{f.advertencia}</li>
            <li>No se muestran siniestros individuales ni datos de personas (Ley 1581 de 2012).</li>
          </ul>
        </dd>
      </dl>
      <p className="etiqueta">Modelo {datos.experiencia.version_modelo}</p>
    </>
  )
}
