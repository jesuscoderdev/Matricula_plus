/**
 * Las pantallas de Matrícula+ (panel de texto junto al mapa), según el guion v2 (revisión del 27 de
 * octubre): Problema → Solución → Antes y después → Resultados → Cómo se hizo → Tu reto. Textos en tú.
 * Ninguna cifra se escribe a mano: todas salen de resultados.json (engine/reparto_v2.py).
 *
 * Una sola medida en todo el demo: un niño está «lejos» si su colegio queda a más de 2 km de su casa.
 */
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { BotonInicio, BotonTema, LogoEmpresa, MarcaDeAgua, NombreApp } from '../componentes/Marca'
import Proli, { ProliMarca } from '../componentes/Proli'
import QrCita from '../componentes/QrCita'
import { APP_NAME, LEMA_MATRICULA, URL_CITA, urlCitaCon } from '../config'
import { pedirAProli, useReto } from '../proli/ordenes'
import { esTotem, type Modo } from '../modo'
import {
  NIVELES, casiDeCada10, deCada10, decimal, entero, localidadesOrdenadas, millonesDe, nivelesQueFaltan, pct, redondo, unoDeCada,
  type Cifra, type DatosMatricula, type Nivel, type Resultados,
} from './datos'

export type CapituloMat = 'problema' | 'solucion' | 'prioridad' | 'antes' | 'localidad' | 'resultados' | 'faltan' | 'como' | 'fuentes' | 'reto'
export type VistaMat = 'portada' | CapituloMat
/** Seis secciones (lo que se ve en la navegación), de una o dos pantallas cada una */
export const SECCIONES_MAT: { nombre: string; vistas: CapituloMat[] }[] = [
  { nombre: 'El problema', vistas: ['problema'] },
  { nombre: 'La solución', vistas: ['solucion', 'prioridad'] },
  { nombre: 'Antes y después', vistas: ['antes', 'localidad'] },
  { nombre: 'Resultados', vistas: ['resultados', 'faltan'] },
  { nombre: 'Cómo se hizo', vistas: ['como', 'fuentes'] },
  { nombre: 'Tu reto', vistas: ['reto'] },
]
/** Cada pantalla, en orden (el nombre es el que oye Proli) */
export const CAPITULOS_MAT: { id: CapituloMat; nombre: string }[] = [
  { id: 'problema', nombre: 'El problema' },
  { id: 'solucion', nombre: 'La solución' },
  { id: 'prioridad', nombre: '¿Quién es quién?' },
  { id: 'antes', nombre: 'Antes y después' },
  { id: 'localidad', nombre: 'Mira tu localidad' },
  { id: 'resultados', nombre: 'Resultados' },
  { id: 'faltan', nombre: '¿Dónde faltan cupos?' },
  { id: 'como', nombre: 'Cómo se hizo' },
  { id: 'fuentes', nombre: 'Fuentes' },
  { id: 'reto', nombre: 'Tu reto' },
]
export const seccionDe = (c: CapituloMat) => SECCIONES_MAT.findIndex((x) => x.vistas.includes(c))
const kicker = (c: CapituloMat) => `${seccionDe(c) + 1} de ${SECCIONES_MAT.length} · ${SECCIONES_MAT[seccionDe(c)].nombre}`

export interface PropsMat {
  datos: DatosMatricula
  modo: Modo
  ir: (v: VistaMat) => void
  localidad: string | null
  setLocalidad: (l: string | null) => void
  /** Antes y después: qué reparto muestra el mapa */
  reparto: 'hoy' | 'despues'
  setReparto: (r: 'hoy' | 'despues') => void
  /** ¿Dónde faltan cupos?: el nivel que colorea el mapa (null = todos) */
  nivel: Nivel | null
  setNivel: (n: Nivel | null) => void
  alInicio?: () => void
  /** el logo de Proliferante lleva a la portada del stand */
  alPortada?: () => void
}

// --- Datos derivados (todo sale de resultados.json) ---
const km = (r: Resultados) => entero(r.radio_km)
// A paso de niño (unos 4,8 km/h), para decir «lejos» en minutos
const KM_POR_HORA_CAMINANDO = 4.8
const minutos = (r: Resultados) => entero(Math.round(((r.radio_km / KM_POR_HORA_CAMINANDO) * 60) / 5) * 5)
const menos = (c: Cifra) => pct(c.lejos_antes - c.lejos_despues, c.lejos_antes)
/** "Bosa, Rafael Uribe Uribe y Antonio Nariño" */
const lista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)
const minus = (n: Nivel) => n.toLowerCase()
/** Localidades que tenían niños lejos y con Matrícula+ no tienen ninguno */
const sinLejos = (r: Resultados) => localidadesOrdenadas(r).filter((l) => r.por_localidad[l].lejos_antes > 0 && r.por_localidad[l].lejos_despues === 0)
const empeoran = (r: Resultados) => localidadesOrdenadas(r).filter((l) => r.por_localidad[l].lejos_despues > r.por_localidad[l].lejos_antes)

const entrar = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }
/** Ancho de una barra: proporcional, dejando sitio para el número al lado */
const ancho = (fraccion: number, rem = 3.4) => `calc((100% - ${rem}rem) * ${Math.max(0, Math.min(1, fraccion))})`

function Cabeza({ c, titulo, children }: { c: CapituloMat; titulo: ReactNode; children?: ReactNode }) {
  return (
    <header className="panel__cabeza">
      <span className="kicker">{kicker(c)}</span>
      <h1 className="display">{titulo}</h1>
      {children}
    </header>
  )
}

// Cada pantalla responde una pregunta: el título la hace y `Respuesta` la contesta en una línea,
// con hasta tres razones
function Respuesta({ children, razones }: { children: ReactNode; razones?: ReactNode[] }) {
  return (
    <div className="respuesta">
      <p className="respuesta__dice">{children}</p>
      {razones && razones.length > 0 && <ul className="respuesta__razones">{razones.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    </div>
  )
}

function Pie({ modo, children }: { modo: Modo; children: ReactNode }) {
  return <div className="panel__pie">{modo !== 'auto' && children}</div>
}

/** Hoy frente a Matrícula+ en barras (rayada = hoy; sólida = Matrícula+) */
function Barras({ filas, max }: { filas: { etiqueta: ReactNode; antes: number; despues: number }[]; max?: number }) {
  const tope = max ?? Math.max(1, ...filas.map((f) => f.antes))
  return (
    <div className="promesa promesa--sola">
      {filas.map((f, i) => (
        <div key={i} className="mat-barras__fila">
          <span className="promesa__etiqueta">{f.etiqueta}</span>
          <span className="promesa__pista"><i className="promesa__barra promesa__barra--promete" style={{ width: ancho(f.antes / tope) }} /><b>{entero(f.antes)}</b></span>
          <span className="promesa__pista"><i className="promesa__barra mat-barra--despues" style={{ width: ancho(f.despues / tope) }} /><b>{entero(f.despues)}</b></span>
        </div>
      ))}
      <p className="leyenda-promesa"><i className="promesa__barra--promete" /> hoy (orden de llegada) <i className="mat-barra--despues" /> con {APP_NAME}</p>
    </div>
  )
}

// ---------------------------------------------------------------- portada
export function PortadaMat({ datos, modo, ir, alInicio, alPortada }: PropsMat) {
  const b = datos.r.grupos.bogota
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
            <span className="marca-bloque"><ProliMarca /><NombreApp nombre={APP_NAME} /></span>
          </div>
          <span className="etiqueta">GovTech · 3–4 nov 2026</span>
          <BotonTema />
        </motion.div>
        <motion.span className="kicker" {...entrar} transition={{ delay: 0.15 }}>Cupos escolares · Bogotá</motion.span>
        <motion.h1 className="display display--xl portada-mov__titulo" {...entrar} transition={{ delay: 0.25 }}>
          En Bogotá, {entero(b.lejos_antes)} niños estudian lejos de casa. <em>Con {APP_NAME}, {entero(b.lejos_despues)}.</em>
        </motion.h1>
        <motion.p className="lead" {...entrar} transition={{ delay: 0.35 }}>{LEMA_MATRICULA}</motion.p>
      </div>
      <div className="portada__pie">
        {modo !== 'auto' && (
          <motion.div className="fila" {...entrar} transition={{ delay: 0.5 }}>
            <button className="boton boton--violeta boton--latir" onClick={() => ir('problema')}>Ver cómo →</button>
            {!totem && <button className="boton boton--claro" onClick={() => ir('localidad')}>Mira tu localidad</button>}
          </motion.div>
        )}
        {totem && (
          <div className="fila fila--entre">
            <span className="toca">{modo === 'auto' ? 'Recorrido automático' : 'Toca para empezar'}</span>
            {modo === 'auto' && <Proli tamano={6} lado="derecha" globo={<>Hola, soy <b>Proli</b>. ¿Cuántos niños estudian lejos de casa?</>} />}
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 1. El problema
export function Problema({ datos, modo, ir }: PropsMat) {
  const r = datos.r
  const b = r.grupos.bogota, vm = r.grupos.vulnerables_menores_10
  return (
    <div className="panel">
      <Cabeza c="problema" titulo={<>Hay cupos, pero se reparten <em>por orden de llegada</em></>}>
        <p className="lead">Cada año, {redondo(b.ninos)} niños piden cupo nuevo en un colegio público de Bogotá.
          {' '}{casiDeCada10(r.grupos.menores_10.ninos, b.ninos).replace(/^./, (x) => x.toUpperCase())} tienen <b>menos de 10 años</b>.</p>
      </Cabeza>
      <p>Cuando inscribes a tu hijo, escribes tres colegios y <b>quien se inscribe primero, elige primero</b>.
        Si te conectas tarde, o ese día no puedes, te quedas con lo que sobre, aunque sea lejos. Y nadie tiene en cuenta si tu
        hijo tiene 4 años, si vives en estrato 1 o si su hermano estudia en el colegio de la esquina.</p>
      <Respuesta>Resultado: <b>{unoDeCada(b.lejos_antes, b.ninos)}</b> niños termina a más de {km(r)} km de casa ({entero(b.lejos_antes)}).</Respuesta>
      <div className="circulos" role="img" aria-label={`${entero(b.ninos)} niños piden cupo; ${entero(b.lejos_antes)} quedan lejos; ${entero(vm.lejos_antes)} de ellos son pequeños de estrato 1 o 2`}>
        <div className="circulos__anillo circulos__anillo--1"><span><b>{entero(b.ninos)}</b> niños nuevos piden cupo</span>
          <div className="circulos__anillo circulos__anillo--2"><span><b>{entero(b.lejos_antes)}</b> quedan lejos ({pct(b.lejos_antes, b.ninos)})</span>
            <div className="circulos__anillo circulos__anillo--3"><span><b>{entero(vm.lejos_antes)}</b> pequeños de estrato 1 o 2</span></div>
          </div>
        </div>
      </div>
      <p className="nota">De esos {entero(b.lejos_antes)}, <b>{entero(vm.lejos_antes)}</b> son a la vez <b>pequeños</b> (menores de 10) y de <b>estrato 1 o 2</b>:
        el {pct(vm.lejos_antes, b.lejos_antes)} de los niños lejos. <b>Lejos</b> = a más de {km(r)} km de su colegio, unos {minutos(r)} minutos caminando.</p>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('solucion')}>¿Y si se repartiera distinto? →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 2. La solución
export function Solucion({ modo, ir }: PropsMat) {
  return (
    <div className="panel">
      <Cabeza c="solucion" titulo={<>¿Y si el cupo no se diera por orden de llegada, sino <em>cruzando datos</em> para darle prioridad a quien más lo necesita?</>} />
      <p className="lead">Tú solo inscribes a tu hijo. El sistema le busca un colegio <b>de su nivel</b> (preescolar, primaria, secundaria o media)
        cerca de tu casa. Cuando un colegio no alcanza para todos, <b>entra primero quien más lo necesita</b>:</p>
      <ol className="prioridades">
        <li><span className="prioridades__n">1</span><span><b>Familias de estrato 1 y 2</b>, y primero las de estrato 1</span></li>
        <li><span className="prioridades__n">2</span><span><b>Los más pequeños</b>, que no pueden ir solos, y <b>los más grandes</b>, que son los que más dejan el colegio</span></li>
        <li><span className="prioridades__n">3</span><span><b>Los que tienen un hermano</b> estudiando en ese colegio</span></li>
      </ol>
      <p>Si tu hijo cumple varias (tiene 4 años, vives en estrato 1 y su hermano estudia ahí), va de primero.</p>
      <div className="aviso-mov" role="note"><b>Regla de oro:</b> ninguna localidad termina con más niños lejos que hoy.</div>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('prioridad')}>¿Quién es quién? →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 2b. ¿Quién es quién?
export function Prioridad({ datos, modo, ir }: PropsMat) {
  const r = datos.r, g = r.grupos, s = r.simulacion, d = r.desercion
  const total = g.bogota.ninos
  const [e0, e1] = s.edades_por_nivel.Preescolar
  const grupos = [
    { titulo: 'Familias vulnerables', quien: <>Las que viven en una manzana de <b>estrato 1 o 2</b>. Las de estrato 1 van primero.</>,
      cuantos: <>{deCada10(g.vulnerables.ninos, total)} ({entero(g.vulnerables.ninos)}). De ellos, {entero(g.estrato_1.ninos)} son de estrato 1.</>,
      fuente: 'Estratificación por manzana · Secretaría Distrital de Planeación' },
    { titulo: 'Los más pequeños', quien: <><b>Menores de 10 años</b>: preescolar ({e0} a {e1} años) y primaria hasta los 9.</>,
      cuantos: <>{casiDeCada10(g.menores_10.ninos, total)} ({entero(g.menores_10.ninos)})</>,
      fuente: 'Nivel que se pide en su zona (Secretaría de Educación) y edad típica del nivel (DANE)' },
    { titulo: 'Los más grandes', quien: <>Adolescentes de <b>14 a 16 años</b>; en la simulación, noveno, décimo y once.</>,
      cuantos: <>{entero(Math.round((100 * g.grandes.ninos) / total))} de cada 100 ({entero(g.grandes.ninos)})</>,
      fuente: 'Edad típica del nivel (DANE)' },
    { titulo: 'Con hermano', quien: <>Niños con un hermano que ya estudia en un colegio cercano (uno de sus {s.vecinos_hermano} más cercanos). La prioridad vale solo en ese colegio.</>,
      cuantos: <>{entero(Math.round((100 * g.con_hermano.ninos) / total))} de cada 100 ({entero(g.con_hermano.ninos)})</>,
      fuente: 'Supuesto: la Secretaría no publica cuántos niños tienen hermanos en un colegio' },
  ]
  return (
    <div className="panel">
      <Cabeza c="prioridad" titulo={<>¿Quién es <em>quién</em>?</>} />
      <ul className="grupos-prio">
        {grupos.map((x) => (
          <li key={x.titulo}>
            <b>{x.titulo}</b>
            <span>{x.quien}</span>
            <span className="grupos-prio__n">{x.cuantos}</span>
            <small>{x.fuente}</small>
          </li>
        ))}
      </ul>
      <Respuesta razones={[
        <>estrato 1 suma {entero(s.puntos.estrato_1)} y estrato 2 suma {entero(s.puntos.estrato_2)};</>,
        <>ser menor de 10 o tener de 14 a 16 años suma {entero(s.puntos.edad)};</>,
        <>quedar en el colegio del hermano también suma.</>,
      ]}>Cada condición suma puntos. Con más puntos, más cerca queda el niño.</Respuesta>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Por qué darle prioridad a los más grandes? ▾</summary>
        <ul className="pruebas-mov">
          <li><b>La deserción crece con el grado.</b> En Bogotá, el {decimal(d.noveno_no_pasa_a_decimo_pct)} % de los estudiantes de noveno no pasa a décimo,
            y solo el {decimal(d.media_se_gradua_pct)} % de los que llegan a la media se gradúa. <small>{d.fuente_grado}.</small></li>
          <li><b>La primera causa es el cambio de residencia.</b> Unos {entero(d.alerta_critica_estudiantes)} estudiantes oficiales ({entero(d.alerta_critica_pct)} %) tienen alerta crítica
            de deserción, y la causa más reportada es el cambio de residencia ({decimal(d.cambio_residencia_pct)} %). <small>{d.fuente_causas}.</small></li>
          <li><b>Por eso, cerca.</b> Si un adolescente se cambia de casa y le asignan un colegio lejos, aumenta el riesgo de que lo deje.</li>
        </ul>
        <div className="aviso-mov" role="note">{d.advertencia}</div>
      </details>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Por qué estrato? ▾</summary>
        <p className="nota">Es el dato público que existe para cada manzana de Bogotá. La Secretaría ya prioriza, en la primera fase de matrícula,
          a {lista(r.priorizados_sed)}. Esos datos son por niño y no son públicos; con ellos, el modelo los incluiría tal cual.</p>
      </details>
      <p className="nota">La Secretaría no publica la edad, el grado ni la situación de cada niño, y está bien que así sea. Se usa lo que sí es público:
        cuántos niños piden cupo en cada nivel en cada colegio, cuántos cupos hay por nivel y el estrato de cada manzana. La edad de cada niño es la
        edad típica de su nivel. Con los datos reales de inscripción, se usaría el grado exacto y la situación real de cada familia.</p>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('antes')}>Ver el antes y el después →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 3. Antes y después
export function Antes({ datos, modo, ir }: PropsMat) {
  const r = datos.r, g = r.grupos, h = r.hermanos, f = r.flujos
  const fila = (etiqueta: ReactNode, c: Cifra) => ({ etiqueta, antes: c.lejos_antes, despues: c.lejos_despues })
  return (
    <div className="panel">
      <Cabeza c="antes" titulo={<>Antes: {entero(g.bogota.lejos_antes)} niños lejos. <em>Después: {entero(g.bogota.lejos_despues)}.</em></>}>
        <p className="lead"><b>{menos(g.bogota)} menos niños lejos de casa</b>, con los mismos colegios.</p>
      </Cabeza>
      <Barras filas={[
        fila('Todos', g.bogota),
        fila('Estrato 1 y 2', g.vulnerables),
        fila('Estrato 1', g.estrato_1),
        fila('Menores de 10', g.menores_10),
        fila('De 14 a 16 años', g.grandes),
      ]} />
      <ul className="datos-mat">
        <li><span>Hermanos en el mismo colegio (de {entero(h.total)})</span><b>{entero(h.juntos_antes)} → {entero(h.juntos_despues)}</b></li>
        <li><span>Distancia promedio a su colegio</span><b>{decimal(g.bogota.km_antes ?? 0)} → {decimal(g.bogota.km_despues ?? 0)} km</b></li>
      </ul>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Son los mismos niños? ▾</summary>
        <ul className="pruebas-mov">
          <li><b>{entero(f.lejos_a_cerca)}</b> de los niños que hoy están lejos pasan a estar cerca.</li>
          <li><b>{entero(f.siguen_lejos)}</b> siguen lejos: donde viven no alcanzan los cupos de su nivel.</li>
          <li><b>{entero(f.cerca_a_lejos)}</b> que hoy están cerca pasan a estar lejos, para que un niño con más prioridad quede cerca.
            {f.cerca_a_lejos_estrato['1'] === 0 ? ' Ninguno es de estrato 1' : ` ${entero(f.cerca_a_lejos_estrato['1'])} son de estrato 1`} y {entero(f.cerca_a_lejos_estrato['2'])} son de estrato 2.
            Quedan, en promedio, a {decimal(f.cerca_a_lejos_km_promedio)} km.</li>
          <li>La cuenta: {entero(g.bogota.lejos_antes)} − {entero(f.lejos_a_cerca)} + {entero(f.cerca_a_lejos)} = {entero(g.bogota.lejos_despues)}.
            Hoy también hay niños lejos, pero lo decide quién llegó primero; con {APP_NAME}, lo decide la prioridad.</li>
        </ul>
      </details>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Por qué siguen separados {entero(h.separados)} hermanos? ▾</summary>
        <ul className="pruebas-mov">
          <li><b>{entero(h.colegio_del_hermano_sin_su_nivel)}</b> no pueden quedar con su hermano porque el colegio del hermano no ofrece su nivel
            (por ejemplo, el hermano está en bachillerato y el niño entra a preescolar).</li>
          <li><b>{entero(h.colegio_del_hermano_lleno)}</b> encuentran el colegio del hermano lleno con niños de más prioridad.</li>
          <li>De todos ellos, solo {entero(h.separados_y_lejos)} quedan lejos de casa.</li>
        </ul>
      </details>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('localidad')}>Mira tu localidad →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 3b. Mira tu localidad
export function Localidad({ datos, modo, ir, localidad, setLocalidad }: PropsMat) {
  const r = datos.r
  const c = localidad ? r.por_localidad[localidad] : null
  const orden = localidadesOrdenadas(r)
  const peores = empeoran(r)
  const faltan = c ? nivelesQueFaltan(c) : []
  return (
    <div className="panel">
      <Cabeza c="localidad" titulo={c ? <>{localidad}: <em>{entero(c.lejos_antes)} → {entero(c.lejos_despues)}</em> niños lejos</> : <>Mira tu <em>localidad</em></>}>
        {!c && <p className="lead">Tócala en el mapa o elígela aquí. Ves su antes, su después y qué nivel le falta.</p>}
      </Cabeza>
      {c ? (
        <>
          <Respuesta>
            {c.lejos_despues === 0 ? <>Con {APP_NAME}, <b>ningún niño</b> de {localidad} queda lejos.</>
              : c.lejos_despues === c.lejos_antes ? <>Queda igual: casi todos son de {lista(faltan.slice(0, 2).map(minus))}, y no hay cupos suficientes de ese nivel a menos de {km(r)} km. Repartir mejor no crea cupos.</>
                : <>Siguen lejos {entero(c.lejos_despues)}, sobre todo de {lista(faltan.slice(0, 2).map(minus))}: faltan cupos de ese nivel cerca de donde viven.</>}
          </Respuesta>
          <ul className="datos-mat">
            <li><span>Niños que piden cupo</span><b>{entero(c.ninos)}</b></li>
            <li><span>Cupos en sus colegios</span><b>{entero(c.cupos)}</b></li>
          </ul>
          <Barras filas={NIVELES.map((k) => ({ etiqueta: k, antes: c.lejos_antes_por_nivel[k], despues: c.lejos_despues_por_nivel[k] }))} />
          {c.cupos > c.ninos && c.lejos_despues > 0 && (
            <p className="nota">En total sobran cupos, pero no del nivel que hace falta cerca de donde viven esos niños.</p>
          )}
          {modo !== 'auto' && <button className="boton-texto" onClick={() => setLocalidad(null)}>← Ver otra localidad</button>}
        </>
      ) : (
        <div className="chips chips--localidades">
          {orden.map((l) => (
            <button key={l} className="chip" disabled={modo === 'auto'} onClick={() => setLocalidad(l)}>
              {l} <small>{entero(r.por_localidad[l].lejos_antes)} → {entero(r.por_localidad[l].lejos_despues)}</small>
            </button>
          ))}
        </div>
      )}
      {!peores.length && <p className="nota">Ninguna localidad termina con más niños lejos que hoy.</p>}
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('resultados')}>Ver los resultados →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 4. Resultados
export function Resultados({ datos, modo, ir }: PropsMat) {
  const r = datos.r, g = r.grupos, h = r.hermanos, x = r.por_que_siguen_lejos, k = r.lejos_km
  const vh = x.vulnerables_con_hermano_menores_10
  const ceros = sinLejos(r)
  const vm = x.vulnerables_menores_10, vg = x.vulnerables_grandes, t = x.todos
  return (
    <div className="panel">
      <Cabeza c="resultados" titulo={<>Con <em>{APP_NAME}</em>…</>} />
      <ul className="logros">
        {vh.lejos === vh.sin_cupo_de_su_nivel_a_2km && (
          <li>Ningún niño menor de 10 años de estrato 1 o 2 con hermano queda lejos si hay un cupo de su nivel cerca.</li>
        )}
        <li><b>De {entero(g.vulnerables_menores_10.lejos_antes)} a {entero(g.vulnerables_menores_10.lejos_despues)}</b> niños menores de 10 años de estrato 1 y 2 lejos de casa.</li>
        <li><b>De {entero(g.vulnerables_grandes.lejos_antes)} a {entero(g.vulnerables_grandes.lejos_despues)}</b> adolescentes de 14 a 16 años de estrato 1 y 2 lejos, los que más riesgo tienen de dejar el colegio.</li>
        <li><b>{entero(h.juntos_despues - h.juntos_antes)} hermanos más</b> estudian juntos.</li>
        {ceros.length > 0 && <li>En <b>{lista(ceros)}</b>, ningún niño queda lejos.</li>}
      </ul>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Y los demás? ▾</summary>
        <ul className="pruebas-mov">
          <li><b>¿Y los {entero(vm.lejos)} niños pequeños de estrato 1 y 2 que siguen lejos?</b> {entero(vm.sin_cupo_de_su_nivel_a_2km)} no tienen ningún cupo de su nivel
            a menos de {km(r)} km. {vm.con_cupo_cerca_ocupado > 0 && <>Los otros {entero(vm.con_cupo_cerca_ocupado)} viven cerca de colegios de su nivel, pero esos cupos los
            ocupan otros niños con igual o más prioridad{vm.km_promedio_ocupado != null && <>; quedan, en promedio, a {decimal(vm.km_promedio_ocupado)} km</>}.</>}</li>
          {vh.lejos > 0 && vg.lejos > 0 && vh.lejos === vh.sin_cupo_de_su_nivel_a_2km && vg.lejos === vg.sin_cupo_de_su_nivel_a_2km && (
            <li><b>¿Y los {entero(vh.lejos)} pequeños con hermano y los {entero(vg.lejos)} adolescentes de estrato 1 y 2?</b> Todos viven donde no hay ningún cupo
              de su nivel a menos de {km(r)} km. Ningún reparto puede acercarlos.</li>
          )}
          <li><b>¿Y los {entero(t.lejos)} que siguen lejos?</b> {entero(t.sin_cupo_de_su_nivel_a_2km)} no tienen ningún cupo de su nivel a {km(r)} km.
            Los otros {entero(t.con_cupo_cerca_ocupado)} tienen cupos cerca, pero ocupados por niños con igual o más prioridad.
            {t.con_cupo_libre_cerca === 0 && ' Ninguno tiene un cupo libre cerca.'}</li>
          <li><b>¿Los que siguen lejos quedan más lejos?</b> No. Quedan en promedio a {decimal(k.promedio_despues)} km, frente a {decimal(k.promedio_antes)} km hoy.
            La distancia máxima baja de {decimal(k.max_antes)} a {decimal(k.max_despues)} km.</li>
        </ul>
      </details>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('faltan')}>¿Dónde faltan cupos? →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 4b. ¿Dónde y en qué nivel faltan cupos?
export function Faltan({ datos, modo, ir, nivel, setNivel }: PropsMat) {
  const r = datos.r
  const locs = localidadesOrdenadas(r).filter((l) => r.por_localidad[l].lejos_despues > 0)
    .sort((a, b) => r.por_localidad[b].lejos_despues - r.por_localidad[a].lejos_despues)
  const tot = (k: Nivel) => r.por_nivel[k].lejos_despues
  // El nivel que más falta en la ciudad y dónde; y dónde faltan sobre todo de bachillerato
  const masFalta = [...NIVELES].sort((a, b) => tot(b) - tot(a))[0]
  const dondeMas = [...locs].sort((a, b) => r.por_localidad[b].lejos_despues_por_nivel[masFalta] - r.por_localidad[a].lejos_despues_por_nivel[masFalta]).slice(0, 3)
  const bach = (l: string) => r.por_localidad[l].lejos_despues_por_nivel.Secundaria + r.por_localidad[l].lejos_despues_por_nivel.Media
  const bachillerato = locs.filter((l) => 2 * bach(l) > r.por_localidad[l].lejos_despues && bach(l) >= 100).sort((a, b) => bach(b) - bach(a))
  return (
    <div className="panel">
      <Cabeza c="faltan" titulo={<>¿Dónde y en qué nivel <em>faltan cupos</em>?</>}>
        <p className="lead">Repartir mejor no crea cupos. El mapa muestra dónde siguen niños lejos con {APP_NAME}: ahí hace falta abrir cupos, y de qué nivel.</p>
      </Cabeza>
      <Respuesta>
        Sobre todo faltan cupos de <b>{minus(masFalta)}</b>, en {lista(dondeMas)}.
        {bachillerato.length > 0 && <> En {lista(bachillerato)} faltan cupos de <b>secundaria y media</b>.</>}
      </Respuesta>
      {modo !== 'auto' && (
        <div className="segmentos" role="group" aria-label="Nivel en el mapa">
          <button className={`segmento ${nivel == null ? 'segmento--activo' : ''}`} onClick={() => setNivel(null)} data-proli="nivel-todos">Todos</button>
          {NIVELES.map((k) => (
            <button key={k} className={`segmento ${nivel === k ? 'segmento--activo' : ''}`} onClick={() => setNivel(k)} data-proli={`nivel-${minus(k)}`}>{k}</button>
          ))}
        </div>
      )}
      <div className="tabla-mat__caja">
        <table className="tabla-mat">
          <thead><tr><th>Localidad</th>{NIVELES.map((k) => <th key={k} className={k === nivel ? 'tabla-mat__elegida' : ''}>{k}</th>)}</tr></thead>
          <tbody>
            {locs.map((l) => {
              const c = r.por_localidad[l], top = nivelesQueFaltan(c)[0]
              return <tr key={l}><th>{l}</th>{NIVELES.map((k) => <td key={k} className={`${k === top ? 'tabla-mat__fuerte' : ''} ${k === nivel ? 'tabla-mat__elegida' : ''}`}>{entero(c.lejos_despues_por_nivel[k])}</td>)}</tr>
            })}
          </tbody>
          <tfoot><tr><th>Bogotá</th>{NIVELES.map((k) => <td key={k} className="tabla-mat__fuerte">{entero(tot(k))}</td>)}</tr></tfoot>
        </table>
      </div>
      <p className="nota">Niños que siguen a más de {km(r)} km con {APP_NAME}, por nivel. Ahí es donde un jardín, un colegio nuevo o más cupos de un nivel hacen la diferencia.</p>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('como')}>¿Cómo se hizo? →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 5. Cómo se hizo
export function Como({ datos, modo, ir }: PropsMat) {
  const r = datos.r, s = r.simulacion
  const cajitas = [
    { t: `Se juntaron ${entero(s.fuentes_publicas)} fuentes públicas`, d: 'Cupos y solicitudes por nivel en cada colegio, ubicación de los colegios, manzanas donde vive la gente y población por edad.' },
    { t: 'Se recrearon los niños', d: 'Bogotá no publica datos personales, y está bien así. Cada niño vive en una manzana real de su zona, con su estrato real, y con el nivel y la edad que se piden en su localidad.' },
    { t: 'Se probaron las dos reglas con los mismos niños', d: `Primero la de hoy (orden de llegada), luego la de ${APP_NAME}.` },
    { t: 'Se pusieron las reglas, enfocadas en la raíz del problema', d: 'Cercanía, estrato, edad y hermanos.' },
    { t: 'El modelo puede seguir aprendiendo', d: 'Con datos reales, IA y modelos predictivos podría anticipar dónde y para qué grados hará falta un colegio.' },
  ]
  const cifras: [string, string][] = [
    [entero(s.fuentes_publicas), 'fuentes públicas'],
    [entero(s.sedes_con_cupos_de_nuevos), 'sedes con cupos por nivel'],
    [entero(s.colegios_con_solicitudes_por_nivel), 'colegios con solicitudes por nivel'],
    [entero(s.manzanas_residenciales), 'manzanas residenciales con su estrato'],
    [entero(s.ninos), `niños recreados en ${entero(s.upz)} UPZ y ${entero(s.localidades)} localidades`],
    [millonesDe(s.distancias_calculadas), 'de distancias calculadas'],
    [entero(s.combinaciones_nino_colegio), `combinaciones niño–colegio, resueltas en ${entero(s.segundos)} segundos`],
  ]
  return (
    <div className="panel">
      <Cabeza c="como" titulo={<>¿Cómo se <em>hizo</em>?</>} />
      <ol className="pasos-metodo">
        {cajitas.map((c) => <li key={c.t}><span><b>{c.t}</b><small>{c.d}</small></span></li>)}
      </ol>
      <ul className="cifras-mat">
        {cifras.map(([n, t]) => <li key={t}><b>{n}</b><span>{t}</span></li>)}
      </ul>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Cómo se recrearon los niños? ▾</summary>
        <ul className="pruebas-mov">
          <li><b>Cuántos:</b> {entero(s.nuevos_oficial)} niños nuevos pidieron cupo (dato oficial), en grupos de {entero(r.ninos_por_grupo_simulado)}.</li>
          <li><b>Dónde viven:</b> la localidad, según las solicitudes de sus colegios; la UPZ, según su población de 5 a 17 años; la manzana residencial, sorteada según sus predios. El estrato es el de la manzana.</li>
          <li><b>Nivel:</b> el que se pide en su localidad, ajustado a los cupos de nuevos de cada nivel en Bogotá.</li>
          <li><b>Edad:</b> la típica del nivel ({NIVELES.map((k) => `${minus(k)} ${s.edades_por_nivel[k][0]}–${s.edades_por_nivel[k][1]}`).join(', ')}).</li>
          <li><b>Hermano:</b> {entero(100 * s.pct_hermano)} de cada 100, en uno de sus {s.vecinos_hermano} colegios más cercanos (supuesto).</li>
          <li><b>Hoy:</b> cada familia pide sus 3 colegios más cercanos de su nivel, con algo de azar, y se atiende en orden de llegada. Quien no entra queda en el colegio más cercano con cupo libre.</li>
          <li><b>Con {APP_NAME}:</b> un reparto óptimo (programación lineal) que acerca a todos y castiga más dejar lejos a quien tiene más puntos, respetando los cupos de cada nivel y la regla de oro.</li>
        </ul>
        <p className="nota">Límites: las distancias son en línea recta; las cifras salen en múltiplos de {entero(r.ninos_por_grupo_simulado)}; los traslados no están simulados; el estrato es un indicador por zona, no por familia.</p>
      </details>
      <Pie modo={modo}>
        <button className="boton boton--ancho boton--violeta" onClick={() => ir('reto')}>¿Tienes un reto así? →</button>
        <button className="boton-texto" onClick={() => ir('fuentes')}>De dónde salen los datos</button>
      </Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 5b. Fuentes
export function Fuentes({ datos, modo, ir }: PropsMat) {
  const f = datos.r.fuentes
  const totem = esTotem(modo)
  return (
    <div className="panel">
      <Cabeza c="fuentes" titulo={<>De dónde salen <em>los datos</em></>}>
        <p className="lead">Todo sale de datos abiertos de Bogotá y de estudios públicos. Ninguna fuente trae datos personales.</p>
      </Cabeza>
      <ul className="fuentes-mov">
        {f.datos.map((x) => (
          <li key={x.dato}>
            <b>{x.dato}</b>
            <span>{x.fuente} · {x.corte}</span>
            {!totem && <a href={x.url} target="_blank" rel="noopener noreferrer">{x.url.replace(/^https?:\/\//, '').split('/')[0]}</a>}
          </li>
        ))}
      </ul>
      <h2 className="subtitulo">Cómo se verificaron</h2>
      <ul className="pruebas-mov">{f.verificacion.map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="nota">{f.privacidad}</p>
      <p className="etiqueta">Modelo {datos.r.version}</p>
      <Pie modo={modo}><button className="boton boton--ancho boton--violeta" onClick={() => ir('reto')}>¿Tienes un reto así? →</button></Pie>
    </div>
  )
}

// ---------------------------------------------------------------- 6. Tu reto
export function Reto({ modo, ir, alInicio }: PropsMat) {
  const totem = esTotem(modo)
  const reto = useReto()
  return (
    <div className="panel">
      <Cabeza c="reto" titulo={<>¿Tienes un reto así <em>en tu entidad</em>?</>}>
        <p className="lead">Lo que hicimos aquí con colegios lo podemos hacer con tus datos: conectarlos, probar reglas, medir antes de decidir
          {' '}<b>y dejar un sistema funcionando para ti</b>.</p>
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
