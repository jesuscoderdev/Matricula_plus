/**
 * Las pantallas de Matrícula+ en el formato vertical que pidió Paola (documento del 29 oct): una sola
 * columna, sin scroll, con titular, visual (el mapa u otro), conclusión y un botón. Cada pantalla
 * devuelve esas piezas (`Pantalla`, de componentes/Recorrido) y Matricula.tsx las acomoda.
 *
 * Recorrido: Portada → 1 El problema → 2 La solución → 3 La gran revelación → 4 La segunda
 * revelación → 5 Cómo lo hicimos → 6 Tu reto. Lo demás (criterios, tablas, metodología) se abre en
 * una hoja. Todo es una simulación con datos abiertos: «escenario de referencia» (no «hoy») y «con
 * Matrícula+ — simulación» (no «después»). Ninguna cifra se escribe a mano: salen de resultados.json.
 */
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import Proli, { ProliMarca } from '../componentes/Proli'
import QrCita from '../componentes/QrCita'
import { Boton, Etapas, entrar, type Pantalla } from '../componentes/Recorrido'
import { APP_NAME, EMPRESA, URL_CITA, urlCitaCon } from '../config'
import { pedirAProli } from '../proli/ordenes'
import { esTotem, type Modo } from '../modo'
import {
  NIVELES, decimal, deCada10, casiDeCada10, entero, localidadesOrdenadas, millonesDe, nivelesQueFaltan, pct,
  type CifraLocalidad, type DatosMatricula, type Nivel,
} from './datos'

export type CapituloMat = 'problema' | 'solucion' | 'antes' | 'resultados' | 'como' | 'reto'
export type VistaMat = 'portada' | CapituloMat
/** Cada paso, en orden (el nombre es el que oye Proli) */
export const CAPITULOS_MAT: { id: CapituloMat; nombre: string }[] = [
  { id: 'problema', nombre: 'El problema' },
  { id: 'solucion', nombre: 'La solución' },
  { id: 'antes', nombre: 'La gran revelación' },
  { id: 'resultados', nombre: 'La segunda revelación' },
  { id: 'como', nombre: 'Cómo lo hicimos' },
  { id: 'reto', nombre: 'Tu reto' },
]
export const pasoDe = (c: CapituloMat) => CAPITULOS_MAT.findIndex((x) => x.id === c) + 1
/** Detalles opcionales: se abren en una hoja encima de la pantalla */
export type HojaMat = 'escenario' | 'criterios' | 'datos' | 'metodologia'

export interface PropsMat {
  datos: DatosMatricula
  modo: Modo
  ir: (v: VistaMat) => void
  /** La gran revelación: qué escenario muestra el mapa */
  reparto: 'hoy' | 'despues'
  setReparto: (r: 'hoy' | 'despues') => void
  /** La segunda revelación: la localidad que se explora en el mapa (opcional) */
  localidad: string | null
  verQr: boolean
  setVerQr: (v: boolean) => void
  abrirHoja: (h: HojaMat) => void
  /** el reto que el visitante ya le contó a Proli (va en el enlace para agendar) */
  reto: string
  alInicio?: () => void
}

// --- Etiquetas (las mismas en las pantallas y en el mapa) ---
export const ESCENARIO_REFERENCIA = 'Escenario de referencia'
export const CON_MATRICULA = `Con ${APP_NAME} — simulación`
const km = (d: DatosMatricula) => entero(d.r.radio_km)
const menos = (d: DatosMatricula) => pct(d.r.grupos.bogota.lejos_antes - d.r.grupos.bogota.lejos_despues, d.r.grupos.bogota.lejos_antes)
const minus = (n: Nivel) => n.toLowerCase()
/** "Bosa, Rafael Uribe Uribe y Antonio Nariño" */
const lista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)

// ---------------------------------------------------------------- portada
export function portada({ modo, ir }: PropsMat): Pantalla {
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo pp__titulo--xl" {...entrar(0)}>
          ¿Y si más niños pudieran estudiar <em>cerca de casa</em> sin construir nuevos colegios?
        </motion.h1>
        <motion.p className="pp__bajada" {...entrar(1)}>Exploramos esta posibilidad con datos públicos de Bogotá.</motion.p>
      </>
    ),
    accion: modo !== 'auto' && <Boton onClick={() => ir('problema')} proli="cap-problema">Descubrir →</Boton>,
    secundarias: esTotem(modo) && <span className="toca">{modo === 'auto' ? 'Recorrido automático' : `Toca para empezar · ${APP_NAME}`}</span>,
  }
}

// ---------------------------------------------------------------- 1. El problema
export function problema({ datos, modo, ir, abrirHoja }: PropsMat): Pantalla {
  const b = datos.r.grupos.bogota
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo pp__titulo--m" {...entrar(0)}>Tener un cupo no siempre significa estudiar <em>cerca de casa</em>.</motion.h1>
        <motion.div className="pp__protagonista" {...entrar(1)}>
          <b>{entero(b.lejos_antes)}</b><span>estudiantes</span>
        </motion.div>
        <motion.p className="pp__bajada" {...entrar(2)}>Quedan a más de {km(datos)} km de casa en nuestro escenario de referencia.</motion.p>
      </>
    ),
    conclusion: <span className="pp__etiqueta pp__etiqueta--centro">Escenario de simulación con datos abiertos, no cifras oficiales de matrícula</span>,
    accion: modo !== 'auto' && <Boton onClick={() => ir('solucion')} proli="cap-solucion">¿Y si cambiamos la decisión? →</Boton>,
    secundarias: modo !== 'auto' && <button className="boton-texto" onClick={() => abrirHoja('escenario')}>¿Cómo se definió el escenario de referencia?</button>,
  }
}

// ---------------------------------------------------------------- 2. La solución
/** Cómo los datos se convierten en una decisión: un estudiante, sus colegios, sus prioridades y una asignación */
function Asignacion() {
  const paso = (k: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.3 + k * 0.9, duration: 0.45 } })
  const colegios: { nombre: string; dice: string; clase: string }[] = [
    { nombre: 'Colegio A', dice: 'lejos de casa', clase: 'asigna__colegio--no' },
    { nombre: 'Colegio B', dice: 'cerca, sin cupo de su nivel', clase: 'asigna__colegio--no' },
    { nombre: 'Colegio C', dice: 'cerca, con cupo de su nivel', clase: 'asigna__colegio--si' },
  ]
  return (
    <div className="asigna" aria-label="Un estudiante, los colegios con cupo de su nivel, sus prioridades y una asignación posible">
      <span className="asigna__etiqueta">Ejemplo ilustrativo</span>
      <motion.div className="asigna__estudiante" {...paso(0)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><circle cx="12" cy="14" r="2" /><path d="M9 20c0-2 1.3-3 3-3s3 1 3 3" />
        </svg>
        <b>Un estudiante y su casa</b>
      </motion.div>
      <motion.span className="asigna__flecha" aria-hidden {...paso(0.5)}>↓</motion.span>
      <motion.div className="asigna__colegios" {...paso(1)}>
        {colegios.map((c, k) => (
          <motion.div key={c.nombre} className={`asigna__colegio ${c.clase}`} {...paso(1 + k * 0.2)}>
            <b>{c.nombre}</b><span>{c.dice}</span>
          </motion.div>
        ))}
      </motion.div>
      <motion.div className="asigna__prioridades" {...paso(2)}>
        <span>Prioridades:</span>
        {['estrato', 'edad', 'hermano en el colegio'].map((x) => <i key={x}>{x}</i>)}
      </motion.div>
      <motion.div className="asigna__decision" {...paso(3)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        Asignación posible: <b>Colegio C</b>
      </motion.div>
    </div>
  )
}

export function solucion({ modo, ir, abrirHoja }: PropsMat): Pantalla {
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo" {...entrar(0)}>Los mismos cupos. <em>Más información para decidir.</em></motion.h1>
        <motion.p className="pp__bajada" {...entrar(1)}>Conectamos datos sobre colegios, disponibilidad, cercanía y necesidades de los estudiantes para simular otra asignación.</motion.p>
      </>
    ),
    visual: <Asignacion />,
    accion: modo !== 'auto' && <Boton onClick={() => ir('antes')} proli="cap-antes">Ver qué cambió →</Boton>,
    secundarias: modo !== 'auto' && <button className="boton-texto" onClick={() => abrirHoja('criterios')} data-proli="cap-criterios">Explorar criterios del modelo</button>,
  }
}

// ---------------------------------------------------------------- 3. La gran revelación
export function antes({ datos, modo, ir, reparto, setReparto }: PropsMat): Pantalla {
  const b = datos.r.grupos.bogota
  const visto = reparto === 'despues'
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo" {...entrar(0)}>Una decisión diferente. <em>Un resultado diferente.</em></motion.h1>
        <motion.span className="pp__etiqueta" {...entrar(1)}>Resultado de simulación</motion.span>
      </>
    ),
    sobreMapa: modo !== 'auto' && (
      <div className="segmentos pp__segmentos" role="group" aria-label="Escenario en el mapa">
        <button data-proli="reparto-hoy" className={`segmento ${!visto ? 'segmento--activo' : ''}`} onClick={() => setReparto('hoy')}>{ESCENARIO_REFERENCIA}</button>
        <button data-proli="reparto-despues" className={`segmento ${visto ? 'segmento--activo' : ''}`} onClick={() => setReparto('despues')}>{visto ? CON_MATRICULA : `Ver ${APP_NAME}`}</button>
      </div>
    ),
    conclusion: (
      <>
        <div className="revela">
          <div className="revela__uno"><span>{ESCENARIO_REFERENCIA}</span><b>{entero(b.lejos_antes)}</b></div>
          <span className={`revela__flecha ${visto ? '' : 'pp__oculto'}`} aria-hidden>→</span>
          <div className={`revela__uno revela__uno--mat ${visto ? '' : 'pp__oculto'}`}><span>{CON_MATRICULA}</span><b>{entero(b.lejos_despues)}</b></div>
        </div>
        {visto && (
          <>
            <motion.p className="revela__pct" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.9, duration: 0.45 }}>
              <b>{menos(datos)}</b> menos estudiantes lejos de casa.
            </motion.p>
            <motion.p className="pp__remate pp__remate--centro" {...entrar(10)}>Los mismos colegios. Los mismos cupos.</motion.p>
            <motion.p className="revela__proli" {...entrar(12)}>
              <ProliMarca tamano={1.8} /><span>«¿Viste? No agregamos cupos. Probamos otra forma de asignarlos».</span>
            </motion.p>
          </>
        )}
      </>
    ),
    accion: modo !== 'auto' && (visto
      ? <Boton onClick={() => ir('resultados')} proli="cap-resultados">Descubrir qué más encontramos →</Boton>
      : <Boton onClick={() => setReparto('despues')}>Ver {APP_NAME}</Boton>),
  }
}

// ---------------------------------------------------------------- 4. La segunda revelación
export function resultados({ datos, modo, ir, abrirHoja, localidad }: PropsMat): Pantalla {
  const g = datos.r.grupos, h = datos.r.hermanos
  const tarjetas = [
    { cifra: <>{entero(g.vulnerables_menores_10.lejos_antes)} → {entero(g.vulnerables_menores_10.lejos_despues)}</>, texto: 'Menores de 10 años de estratos 1 y 2 lejos de casa.' },
    { cifra: <>{entero(g.vulnerables_grandes.lejos_antes)} → {entero(g.vulnerables_grandes.lejos_despues)}</>, texto: 'Adolescentes de 14 a 16 años de estratos 1 y 2 lejos de casa.' },
    { cifra: <>{entero(h.juntos_despues - h.juntos_antes)} más</>, texto: 'Estudiantes que podrían compartir colegio con sus hermanos.' },
  ]
  const c = localidad ? datos.r.por_localidad[localidad] : null
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo pp__titulo--m" {...entrar(0)}>No solo podemos asignar mejor. <em>También descubrir dónde hace falta invertir.</em></motion.h1>
        <div className="tres">
          {tarjetas.map((t, k) => (
            <motion.div key={t.texto} className="tres__uno" {...entrar(1 + k)}><b>{t.cifra}</b><span>{t.texto}</span></motion.div>
          ))}
        </div>
      </>
    ),
    sobreMapa: c && localidad && <DetalleLocalidad nombre={localidad} c={c} />,
    conclusion: <motion.p className="pp__remate" {...entrar(5)}>Repartir mejor no crea nuevos cupos. Ahora podemos identificar dónde siguen haciendo falta.</motion.p>,
    accion: modo !== 'auto' && <Boton onClick={() => ir('como')} proli="cap-como">Descubrir cómo lo hicimos →</Boton>,
    secundarias: modo !== 'auto' && <button className="boton-texto" onClick={() => abrirHoja('datos')} data-proli="cap-datos">Explorar datos por localidad y nivel</button>,
  }
}

/** La localidad tocada en el mapa: su antes y después, y qué nivel le falta (exploración opcional) */
function DetalleLocalidad({ nombre, c }: { nombre: string; c: CifraLocalidad }) {
  const faltan = nivelesQueFaltan(c).sort((a, b) => c.lejos_despues_por_nivel[b] - c.lejos_despues_por_nivel[a])
  return (
    <div className="pp__detalle-loc">
      <b>{nombre}</b>
      <span>{entero(c.lejos_antes)} → {entero(c.lejos_despues)} estudiantes lejos</span>
      {faltan.length > 0 && <span>Faltan cupos sobre todo de {lista(faltan.slice(0, 2).map(minus))}</span>}
    </div>
  )
}

// ---------------------------------------------------------------- 5. Cómo lo hicimos
export function como({ datos, modo, ir, abrirHoja }: PropsMat): Pantalla {
  const f = datos.r.fuentes.datos
  const ejemplos = ['Oferta de cupos', 'Manzanas', 'Población'].map((x) => f.find((d) => d.dato.startsWith(x))?.dato).filter(Boolean)
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo" {...entrar(0)}>Los datos estaban ahí. <em>Había que ponerlos a trabajar.</em></motion.h1>
        <motion.p className="pp__bajada" {...entrar(1)}>Conectamos distintas fuentes públicas, incorporamos criterios, construimos un modelo matemático y comparamos alternativas.</motion.p>
      </>
    ),
    visual: (
      <Etapas etapas={[
        { icono: 'datos', titulo: 'Datos', detalle: ejemplos.join(' · ') },
        { icono: 'modelo', titulo: 'Modelo', detalle: 'Cercanía, estrato, edad y hermanos, con los cupos de cada nivel' },
        { icono: 'decision', titulo: 'Decisión', detalle: `${ESCENARIO_REFERENCIA} frente a ${APP_NAME}` },
      ]} />
    ),
    conclusion: <p className="pp__remate">Esto es {EMPRESA}: convertimos datos en inteligencia que actúa.</p>,
    accion: modo !== 'auto' && <Boton onClick={() => ir('reto')} proli="cap-reto">¿Y en tu entidad? →</Boton>,
    secundarias: modo !== 'auto' && <button className="boton-texto" onClick={() => abrirHoja('metodologia')} data-proli="cap-metodologia">Consultar metodología</button>,
  }
}

// ---------------------------------------------------------------- 6. Tu reto
export function reto({ modo, ir, verQr, setVerQr, reto: suReto, alInicio }: PropsMat): Pantalla {
  const totem = esTotem(modo)
  const agendar = () => (totem || !URL_CITA ? setVerQr(!verQr) : window.open(urlCitaCon(suReto), '_blank', 'noopener'))
  return {
    titular: (
      <>
        <motion.h1 className="display pp__titulo pp__titulo--m" {...entrar(0)}>Ahora imagina lo que podríamos lograr con <em>los datos de tu entidad</em>.</motion.h1>
        <motion.p className="pp__pregunta" {...entrar(1)}>¿Qué resultado te gustaría mejorar?</motion.p>
      </>
    ),
    visual: (
      <div className="pp__reto">
        {verQr ? <QrCita /> : <Proli tamano={9} globo={<>Cuéntame tu reto. Quiero entender qué está pasando y qué información tienen disponible.</>} />}
      </div>
    ),
    accion: modo !== 'auto' && <Boton onClick={() => pedirAProli('Tengo un reto en mi entidad')}>Contarle mi reto a Proli →</Boton>,
    secundarias: modo !== 'auto' && (
      <>
        <button className="boton boton--claro boton--ancho pp__boton-2" onClick={agendar} data-proli="cap-reto">{verQr ? 'Volver a Proli' : 'Agendar conversación →'}</button>
        <div className="fila pp__fila">
          <button className="boton-texto" onClick={() => ir('portada')}>Ver de nuevo</button>
          {alInicio && <button className="boton-texto" onClick={alInicio}>Ver otros proyectos</button>}
        </div>
      </>
    ),
  }
}

export const PANTALLAS: Record<VistaMat, (p: PropsMat) => Pantalla> = { portada, problema, solucion, antes, resultados, como, reto }

// ---------------------------------------------------------------- hojas (detalles opcionales)
const Detalle = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <>
    <h2 className="display display--m">{titulo}</h2>
    {children}
  </>
)

/** ¿Cómo se definió el escenario de referencia? (el procedimiento de asignación que se simula) */
export function HojaEscenario({ datos }: { datos: DatosMatricula }) {
  const r = datos.r, s = r.simulacion
  return (
    <Detalle titulo="El escenario de referencia">
      <p className="pp__texto">Es una simulación del reparto por orden de llegada, no la asignación oficial de la Secretaría de Educación. Sirve para comparar dos formas de asignar los mismos cupos a los mismos estudiantes.</p>
      <ul className="pruebas-mov">
        <li><b>Quiénes:</b> {entero(s.nuevos_oficial)} estudiantes nuevos pidieron cupo en un colegio oficial (dato oficial). Se recrearon en grupos de {entero(r.ninos_por_grupo_simulado)}: cada punto del mapa es un grupo.</li>
        <li><b>Cómo se reparte:</b> cada familia pide sus 3 colegios más cercanos de su nivel, con algo de azar, y se atiende por orden de llegada. Quien no entra queda en el colegio más cercano con cupo libre.</li>
        <li><b>Lejos:</b> a más de {km(datos)} km de su colegio, en línea recta.</li>
        <li><b>Los cupos:</b> los cupos para estudiantes nuevos de cada nivel en cada sede, de la Secretaría de Educación.</li>
      </ul>
      <p className="nota">{r.fuentes.privacidad}</p>
    </Detalle>
  )
}

/** Explorar criterios del modelo: quién tiene prioridad, cuántos son y por qué */
export function HojaCriterios({ datos }: { datos: DatosMatricula }) {
  const r = datos.r, g = r.grupos, s = r.simulacion, d = r.desercion
  const total = g.bogota.ninos
  const [e0, e1] = s.edades_por_nivel.Preescolar
  const grupos = [
    { titulo: 'Familias de estrato 1 y 2', quien: <>Las que viven en una manzana de estrato 1 o 2; las de estrato 1 van primero.</>,
      cuantos: <>{deCada10(g.vulnerables.ninos, total)} ({entero(g.vulnerables.ninos)}); {entero(g.estrato_1.ninos)} de estrato 1.</>, fuente: 'Estratificación por manzana · Secretaría Distrital de Planeación' },
    { titulo: 'Los más pequeños', quien: <>Menores de 10 años: preescolar ({e0} a {e1} años) y primaria hasta los 9.</>,
      cuantos: <>{casiDeCada10(g.menores_10.ninos, total)} ({entero(g.menores_10.ninos)})</>, fuente: 'Nivel que se pide en su zona (Secretaría de Educación) y edad típica del nivel (DANE)' },
    { titulo: 'Los más grandes', quien: <>Adolescentes de 14 a 16 años; en la simulación, noveno, décimo y once.</>,
      cuantos: <>{entero(Math.round((100 * g.grandes.ninos) / total))} de cada 100 ({entero(g.grandes.ninos)})</>, fuente: 'Edad típica del nivel (DANE)' },
    { titulo: 'Con hermano', quien: <>Con un hermano en un colegio cercano (uno de sus {s.vecinos_hermano} más cercanos). Vale solo en ese colegio.</>,
      cuantos: <>{entero(Math.round((100 * g.con_hermano.ninos) / total))} de cada 100 ({entero(g.con_hermano.ninos)})</>, fuente: 'Supuesto: la Secretaría no publica cuántos estudiantes tienen hermanos en un colegio' },
  ]
  return (
    <Detalle titulo="Criterios del modelo">
      <p className="pp__texto">Cada estudiante busca un colegio de su nivel cerca de casa. Cuando un colegio no alcanza para todos, entra primero quien más lo necesita.
        Cada condición suma puntos: estrato 1 suma {entero(s.puntos.estrato_1)} y estrato 2 suma {entero(s.puntos.estrato_2)}; ser menor de 10 o tener de 14 a 16 años
        suma {entero(s.puntos.edad)}; quedar en el colegio del hermano también suma.</p>
      <ul className="grupos-prio">
        {grupos.map((x) => <li key={x.titulo}><b>{x.titulo}</b><span>{x.quien}</span><span className="grupos-prio__n">{x.cuantos}</span><small>{x.fuente}</small></li>)}
      </ul>
      <div className="aviso-mov" role="note"><b>Regla de oro:</b> ninguna localidad termina con más estudiantes lejos que en el escenario de referencia.</div>
      <h3 className="subtitulo">¿Por qué los más grandes?</h3>
      <ul className="pruebas-mov">
        <li>En Bogotá, el {decimal(d.noveno_no_pasa_a_decimo_pct)} % de los estudiantes de noveno no pasa a décimo, y solo el {decimal(d.media_se_gradua_pct)} % de los que llegan a la media se gradúa. <small>{d.fuente_grado}.</small></li>
        <li>La causa de deserción más reportada es el cambio de residencia ({decimal(d.cambio_residencia_pct)} %). <small>{d.fuente_causas}.</small></li>
      </ul>
      <div className="aviso-mov" role="note">{d.advertencia}</div>
      <h3 className="subtitulo">¿Por qué estrato?</h3>
      <p className="nota">Es el dato público que existe para cada manzana de Bogotá. La Secretaría ya prioriza, en la primera fase de matrícula, a {lista(r.priorizados_sed)}.
        Esos datos son por estudiante y no son públicos; con ellos, el modelo los incluiría tal cual.</p>
    </Detalle>
  )
}

/** Explorar datos: por localidad y nivel, quiénes siguen lejos con Matrícula+, y por qué */
export function HojaDatos({ datos }: { datos: DatosMatricula }) {
  const r = datos.r, t = r.por_que_siguen_lejos.todos, k = r.lejos_km
  const locs = localidadesOrdenadas(r).filter((l) => r.por_localidad[l].ninos > 0)
    .sort((a, b) => r.por_localidad[b].lejos_despues - r.por_localidad[a].lejos_despues)
  const tot = (n: Nivel) => r.por_nivel[n].lejos_despues
  return (
    <Detalle titulo="Datos por localidad y nivel">
      <p className="pp__texto">Estudiantes que siguen a más de {km(datos)} km con {APP_NAME} (simulación), por nivel. Ahí es donde un jardín, un colegio nuevo o más cupos de un nivel harían la diferencia.</p>
      <div className="tabla-mat__caja">
        <table className="tabla-mat">
          <thead><tr><th>Localidad</th><th>Ref.</th><th>{APP_NAME}</th>{NIVELES.map((n) => <th key={n}>{n}</th>)}</tr></thead>
          <tbody>
            {locs.map((l) => {
              const c = r.por_localidad[l], top = nivelesQueFaltan(c).sort((a, b) => c.lejos_despues_por_nivel[b] - c.lejos_despues_por_nivel[a])[0]
              return <tr key={l}><th>{l}</th><td>{entero(c.lejos_antes)}</td><td className="tabla-mat__fuerte">{entero(c.lejos_despues)}</td>
                {NIVELES.map((n) => <td key={n} className={n === top ? 'tabla-mat__fuerte' : ''}>{entero(c.lejos_despues_por_nivel[n])}</td>)}</tr>
            })}
          </tbody>
          <tfoot><tr><th>Bogotá</th><td>{entero(r.grupos.bogota.lejos_antes)}</td><td className="tabla-mat__fuerte">{entero(r.grupos.bogota.lejos_despues)}</td>
            {NIVELES.map((n) => <td key={n} className="tabla-mat__fuerte">{entero(tot(n))}</td>)}</tr></tfoot>
        </table>
      </div>
      <p className="nota">Ref. = escenario de referencia. También puedes tocar una localidad en el mapa.</p>
      <h3 className="subtitulo">¿Por qué siguen lejos?</h3>
      <ul className="pruebas-mov">
        <li>De los {entero(t.lejos)} que siguen lejos, {entero(t.sin_cupo_de_su_nivel_a_2km)} no tienen ningún cupo de su nivel a menos de {km(datos)} km. Los otros {entero(t.con_cupo_cerca_ocupado)} tienen
          cupos cerca, pero ocupados por estudiantes con igual o más prioridad.</li>
        <li>Quedan, en promedio, a {decimal(k.promedio_despues)} km, frente a {decimal(k.promedio_antes)} km en el escenario de referencia. La distancia máxima baja de {decimal(k.max_antes)} a {decimal(k.max_despues)} km.</li>
        <li>{entero(r.flujos.cerca_a_lejos)} estudiantes que estaban cerca pasan a estar lejos para que uno con más prioridad quede cerca
          ({r.flujos.cerca_a_lejos_estrato['1'] === 0 ? 'ninguno de estrato 1' : `${entero(r.flujos.cerca_a_lejos_estrato['1'])} de estrato 1`} y {entero(r.flujos.cerca_a_lejos_estrato['2'])} de estrato 2).</li>
      </ul>
    </Detalle>
  )
}

/** Consultar metodología: fuentes, supuestos, períodos y limitaciones */
export function HojaMetodologia({ datos, modo }: { datos: DatosMatricula; modo: Modo }) {
  const r = datos.r, s = r.simulacion, f = r.fuentes
  const totem = esTotem(modo)
  const cifras: [string, string][] = [
    [entero(s.fuentes_publicas), 'fuentes públicas'],
    [entero(s.sedes_con_cupos_de_nuevos), 'sedes con cupos por nivel'],
    [entero(s.manzanas_residenciales), 'manzanas residenciales con su estrato'],
    [entero(s.ninos), `estudiantes recreados en ${entero(s.upz)} UPZ y ${entero(s.localidades)} localidades`],
    [millonesDe(s.distancias_calculadas), 'de distancias calculadas'],
    [entero(s.combinaciones_nino_colegio), `combinaciones estudiante–colegio, resueltas en ${entero(s.segundos)} segundos`],
  ]
  return (
    <Detalle titulo="Metodología">
      <ul className="cifras-mat">{cifras.map(([n, t]) => <li key={t}><b>{n}</b><span>{t}</span></li>)}</ul>
      <dl className="metodo-mov">
        <dt>Los estudiantes</dt>
        <dd>Bogotá no publica datos personales. Cada estudiante recreado vive en una manzana real de su zona, con su estrato real, y con el nivel y la edad que se piden en su
          localidad. Edad típica por nivel: {NIVELES.map((n) => `${minus(n)} ${s.edades_por_nivel[n][0]}–${s.edades_por_nivel[n][1]}`).join(', ')}. Hermano: {entero(100 * s.pct_hermano)} de
          cada 100, en uno de sus {s.vecinos_hermano} colegios más cercanos (supuesto).</dd>
        <dt>Las dos formas de asignar</dt>
        <dd>{ESCENARIO_REFERENCIA}: orden de llegada (cada familia pide sus 3 colegios más cercanos de su nivel). {APP_NAME}: un reparto óptimo (programación lineal) que acerca a
          todos y castiga más dejar lejos a quien tiene más puntos, respetando los cupos de cada nivel y la regla de oro.</dd>
        <dt>Fuentes</dt>
        <dd>
          <ul className="fuentes-mov">
            {f.datos.map((x) => (
              <li key={x.dato}><b>{x.dato}</b><span>{x.fuente} · {x.corte}</span>
                {!totem && <a href={x.url} target="_blank" rel="noopener noreferrer">{x.url.replace(/^https?:\/\//, '').split('/')[0]}</a>}</li>
            ))}
          </ul>
        </dd>
        <dt>Cómo se verificó</dt>
        <dd><ul className="pruebas-mov">{f.verificacion.map((x) => <li key={x}>{x}</li>)}</ul></dd>
        <dt>Supuestos y limitaciones</dt>
        <dd>
          <ul className="pruebas-mov">
            <li>Es una simulación: no muestra resultados oficiales ni una asignación que Bogotá haya hecho.</li>
            <li>Las distancias son en línea recta; las cifras salen en múltiplos de {entero(r.ninos_por_grupo_simulado)}.</li>
            <li>Los traslados no están simulados; el estrato es un indicador por zona, no por familia.</li>
            <li>{f.privacidad}</li>
          </ul>
        </dd>
      </dl>
      <p className="etiqueta">Modelo {r.version}</p>
    </Detalle>
  )
}
