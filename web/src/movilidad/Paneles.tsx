/**
 * Las pantallas de Presupuesto+, en el formato vertical que pidió Paola (29 oct): una sola columna,
 * sin scroll, con un titular, un visual (el mapa u otro), una conclusión y un solo botón principal.
 * Cada pantalla devuelve esas piezas (`Pantalla`) y Movilidad.tsx las acomoda: en vertical, una debajo
 * de otra; en horizontal, el texto a la izquierda y el visual a la derecha.
 *
 * Recorrido: Portada → 1 Problema → 2 Solución → 3 Antes y después → 4 Resultados → 5 Cómo lo hicimos
 * → 6 Tu reto. La metodología se abre aparte, en una hoja.
 *
 * Ninguna cifra se escribe a mano: salen de los datos (experiencia.json, fuentes.json, resumen.json,
 * sitios.geojson), casi todas a través de guion.ts. El mensaje: con el mismo presupuesto, analizar más
 * información cambia 46 decisiones de inversión. No se presentan siniestros evitados como resultado:
 * dependen de un supuesto de efectividad y solo van en la metodología, como escenario hipotético.
 */
import { motion } from 'framer-motion'
import Proli from '../componentes/Proli'
import { Boton, CifraGrande, entrar, masDe, type Pantalla } from '../componentes/Recorrido'
import ProliActividad from '../componentes/ProliActividad'
import AnimacionSistema from './AnimacionSistema'
import QrCita from '../componentes/QrCita'
import { EMPRESA, NOMBRE_MOVILIDAD } from '../config'
import { irAProli } from '../proli/ordenes'
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
export type Hoja = 'metodologia'

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
  const esc = escenario(datos)
  return {
    actividad: 'monedas',
    titular: (
      <motion.h1 className="display pp__titulo" {...entrar(0)}>
        Con un presupuesto limitado, la pregunta no es solo cuánto invertir. <em>Es dónde hacerlo primero.</em>
      </motion.h1>
    ),
    conclusion: (
      <span className="pp__etiqueta pp__etiqueta--centro">
        Escenario ilustrativo: {millones(esc.presupuesto_millones)}, con un costo supuesto de {millones(costo(datos))} por intervención
      </span>
    ),
    accion: modo !== 'auto' && <Boton onClick={() => ir('solucion')} proli="cap-solucion">Descubrir cómo se eligen →</Boton>,
  }
}

// ---------------------------------------------------------------- 2. La solución
/** Una pregunta y su respuesta, grandes; al lado, una escena: la lupa recorre los años anteriores y aparece la esquina que se escapaba */
export function solucion({ modo, ir }: PropsMov): Pantalla {
  return {
    titular: (
      <motion.h1 className="display pp__pregunta" {...entrar(0)}>
        ¿Y si las esquinas más peligrosas no fueran simplemente las que tuvieron más accidentes <em>el último año</em>?
      </motion.h1>
    ),
    visual: <div className="pp__ilustracion"><ProliActividad tipo="historia" /></div>,
    conclusion: (
      <motion.p className="pp__respuesta" {...entrar(2)}>
        <b>{NOMBRE_MOVILIDAD}</b> analiza los registros históricos y compara lugares con comportamientos similares para estimar su riesgo.
      </motion.p>
    ),
    accion: modo !== 'auto' && <Boton onClick={() => ir('antes')} proli="cap-antes">Ver qué cambia →</Boton>,
  }
}

// ---------------------------------------------------------------- 3. Antes y después
/**
 * Las dos selecciones, una barra cada una y del mismo tamaño (mismo presupuesto, mismos lugares): la
 * parte gris es la misma en las dos (los lugares que coinciden) y la de color es lo que cambia: los que
 * solo escoge «mirando solo un año» (salen) y los que solo escoge Presupuesto+ (entran).
 */
function ComparaSelecciones({ datos, visto }: { datos: DatosMovilidad; visto: boolean }) {
  const g = guionDe(datos)
  const a0 = anioBase(datos)
  const comun = g.comunesPresupuesto.length, salen = g.salenPresupuesto.length, entran = g.entranPresupuesto.length
  const Seg = ({ n, clase, cifra }: { n: number; clase: string; cifra: boolean }) => (
    <i className={`compara__seg compara__seg--${clase}`} style={{ flexGrow: n }}>{cifra && <b>{entero(n)}</b>}</i>
  )
  return (
    <div className="compara">
      <div className="compara__fila">
        <span className="compara__nombre">Mirando solo {a0}</span>
        <div className="compara__barra">
          {visto ? <><Seg n={comun} clase="comun" cifra /><Seg n={salen} clase="salen" cifra /></> : <Seg n={comun + salen} clase="salen" cifra={false} />}
        </div>
      </div>
      {visto && (
        <motion.div className="compara__fila" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <span className="compara__nombre">Con {NOMBRE_MOVILIDAD}</span>
          <div className="compara__barra">
            <Seg n={comun} clase="comun" cifra />
            <Seg n={entran} clase="entran" cifra />
          </div>
        </motion.div>
      )}
      {visto ? (
        <motion.ul className="compara__clave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.4 }}>
          <li><i className="compara__muestra compara__muestra--comun" /><span><b>{entero(comun)}</b> lugares los escogen las dos formas</span></li>
          <li><i className="compara__muestra compara__muestra--salen" /><span><b>{entero(salen)}</b> solo los escoge mirando solo {a0}: <b>salen</b></span></li>
          <li><i className="compara__muestra compara__muestra--entran" /><span><b>{entero(entran)}</b> solo los escoge {NOMBRE_MOVILIDAD}: <b>entran</b></span></li>
        </motion.ul>
      ) : (
        <p className="compara__pista">Estos son los lugares que se escogen mirando solo {a0}. Toca «Ver {NOMBRE_MOVILIDAD}» para comparar.</p>
      )}
    </div>
  )
}

export function antes({ datos, modo, ir, lista, setLista }: PropsMov): Pantalla {
  const g = guionDe(datos)
  const visto = lista === 'modelo'
  const a0 = anioBase(datos)
  return {
    actividad: 'intercambio',
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
      <ComparaSelecciones datos={datos} visto={visto} />
      </>
    ),
    accion: modo !== 'auto' && (visto
      ? <Boton onClick={() => ir('resultados')} proli="cap-resultados">¿Qué revelan los resultados? →</Boton>
      : <Boton onClick={() => setLista('modelo')}>Ver {NOMBRE_MOVILIDAD}</Boton>),
  }
}

// ---------------------------------------------------------------- 4. Resultados
export function resultados({ datos, modo, ir }: PropsMov): Pantalla {
  const p = guionDe(datos).comparacionPresupuesto
  const [e0, e1] = datos.resumen.periodo_estimacion
  const a0 = anioBase(datos), a1 = anioVal(datos)
  return {
    actividad: 'grafica',
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
        <p className="pp__remate">Con nuestro método, el mismo presupuesto llega a más lugares de mayor siniestralidad.</p>
        <p className="pp__texto"><b>¿Qué significa?</b> Con los mismos {millones(escenario(datos).presupuesto_millones)}, los lugares que escogió {NOMBRE_MOVILIDAD} registraron
          después más siniestros graves que los escogidos mirando solo {a0}. Ahí es donde conviene priorizar la inversión.</p>
      </>
    ),
    accion: modo !== 'auto' && <Boton onClick={() => ir('como')} proli="cap-como">Descubrir cómo lo hicimos →</Boton>,
  }
}

// ---------------------------------------------------------------- 5. Cómo lo hicimos
export function como({ datos, modo, ir, abrirHoja }: PropsMov): Pantalla {
  return {
    actividad: 'calculos',
    titular: (
      <>
        <motion.h1 className="display pp__titulo" {...entrar(0)}>Los datos estaban ahí. <em>Había que ponerlos a trabajar.</em></motion.h1>
        <CifraGrande total={datos.fuentes.calculos_realizados.total} paso={100} de="de cálculos"
                     detalle={<>con más de {masDe(datos.fuentes.registros_analizados.total, 50_000)} registros: cada tramo de vía y cada siniestro en su lugar, el riesgo de cada zona y cada combinación posible del presupuesto</>} />
        <motion.p className="pp__texto" {...entrar(2)}>Y puede seguir aprendiendo con nuevos datos y algoritmos: <b>así se vuelve un sistema inteligente</b>.</motion.p>
        <motion.p className="pp__remate" {...entrar(3)}>Esto es {EMPRESA}: convertimos datos en inteligencia que actúa.</motion.p>
      </>
    ),
    visual: <AnimacionSistema datos={datos} auto={modo === 'auto'} />,
    accion: modo !== 'auto' && <Boton onClick={() => ir('reto')} proli="cap-reto">¿Y en tu entidad? →</Boton>,
    secundarias: modo !== 'auto' && <button className="boton-texto" onClick={() => abrirHoja('metodologia')} data-proli="cap-metodologia">Consultar metodología</button>,
  }
}

// ---------------------------------------------------------------- 6. Tu reto
export function reto({ modo, ir, verQr, alInicio }: PropsMov): Pantalla {
  return {
    actividad: 'idea',
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
    accion: modo !== 'auto' && <Boton onClick={() => irAProli()}>Contarle mi reto a Proli →</Boton>,
    secundarias: modo !== 'auto' && (
      <>
        <button className="boton boton--claro boton--ancho pp__boton-2" onClick={() => irAProli({ agenda: true })} data-proli="cap-reto">Agendar 20 minutos →</button>
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
