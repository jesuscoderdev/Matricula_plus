/**
 * Los capítulos de Movilidad+ (panel de texto junto al mapa). Ninguna cifra se escribe a mano:
 * todas salen de los datos (experiencia.json, fuentes.json, resumen.json, sitios.geojson).
 *
 * Tono: un análisis que se suma a la priorización que ya hace la ciudad y la lleva a las calles
 * de barrio. "Con estos supuestos, se esperaría…"; nunca "esta obra salvará X vidas".
 */
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { BotonInicio, BotonTema, LogoEmpresa, MarcaDeAgua, NombreApp } from '../componentes/Marca'
import Proli, { ProliMarca } from '../componentes/Proli'
import QrCita from '../componentes/QrCita'
import Veredicto from '../componentes/Veredicto'
import { ESQUINAS_A_TOCAR, LEMA_MOVILIDAD, NOMBRE_MOVILIDAD, TITULO_MOVILIDAD, URL_CITA, urlCitaCon } from '../config'
import { useReto } from '../proli/ordenes'
import { esTotem, type Modo } from '../modo'
import { entero, millones, nombreLocalidad, pct, pctFraccion, type DatosMovilidad, type Escenario, type Nivel, type PuntoCurva } from './datos'

export type CapituloMov = 'decide' | 'anio' | 'giro' | 'solucion' | 'metodo' | 'presupuesto' | 'evaluar' | 'fuentes' | 'cierre'
export type VistaMov = 'portada' | CapituloMov
/**
 * Cinco secciones (lo que se ve en la navegación), de una o dos pantallas cada una: el visitante
 * elige con el método actual, ve qué pasó, conoce el método de Proliferante, ve los resultados y
 * cierra. Fuentes va al final, desde «Hablemos».
 */
export const SECCIONES_MOV: { nombre: string; vistas: CapituloMov[] }[] = [
  { nombre: 'Tú decides', vistas: ['decide'] },
  { nombre: '¿Qué pasó?', vistas: ['anio', 'giro'] },
  { nombre: 'El método', vistas: ['solucion', 'metodo'] },
  { nombre: 'Resultados', vistas: ['presupuesto', 'evaluar'] },
  { nombre: 'Hablemos', vistas: ['cierre', 'fuentes'] },
]
/** Cada pantalla, en orden (el nombre es el que oye Proli) */
export const CAPITULOS_MOV: { id: CapituloMov; nombre: string }[] = [
  { id: 'decide', nombre: 'Tú decides' },
  { id: 'anio', nombre: 'Pasó un año' },
  { id: 'giro', nombre: 'El giro' },
  { id: 'solucion', nombre: 'La solución' },
  { id: 'metodo', nombre: 'Antes y después' },
  { id: 'presupuesto', nombre: 'Presupuesto' },
  { id: 'evaluar', nombre: '¿Funcionó la obra?' },
  { id: 'cierre', nombre: 'Hablemos' },
  { id: 'fuentes', nombre: 'Fuentes' },
]
export const seccionDe = (c: CapituloMov) => SECCIONES_MOV.findIndex((x) => x.vistas.includes(c))
const kicker = (c: CapituloMov) => `${seccionDe(c) + 1} de ${SECCIONES_MOV.length} · ${SECCIONES_MOV[seccionDe(c)].nombre}`


export interface PropsMov {
  datos: DatosMovilidad
  modo: Modo
  ir: (v: VistaMov) => void
  tocadas: number[]
  setTocadas: (t: number[]) => void
  localidad: number | null
  setLocalidad: (l: number | null) => void
  anio: 'k24' | 'k25'
  setAnio: (a: 'k24' | 'k25') => void
  /** presupuesto en millones de pesos */
  monto: number
  setMonto: (m: number) => void
  zona: 'barrio' | 'avenidas'
  setZona: (z: 'barrio' | 'avenidas') => void
  alInicio?: () => void
  /** el logo de Proliferante lleva a la portada del stand */
  alPortada?: () => void
}

// --- Datos derivados (todo sale de los archivos) ---
const anioBase = (d: DatosMovilidad) => d.experiencia.pantalla_1_usted_decide.anio_mostrado
const anioVal = (d: DatosMovilidad) => d.resumen.anio_validacion
/** "115 m", leído de la unidad del modelo */
export const tamanoHex = (d: DatosMovilidad) => d.resumen.unidad.match(/[\d.,]+\s*m\b/)?.[0] ?? ''
/** Primera oración y el resto de un texto */
const partir = (t: string, sep = '. ') => { const i = t.indexOf(sep); return i < 0 ? [t, ''] : [t.slice(0, i + 1), t.slice(i + sep.length).trim()] }
const conConSigno = (n: number, d: number) => (n - d > 0 ? '+' : n - d < 0 ? '−' : '±') + entero(Math.abs(n - d))

/** Ancho de una barra: proporcional, dejando sitio para el número al lado */
const ancho = (fraccion: number, rem = 3.4) => `calc((100% - ${rem}rem) * ${Math.max(0, Math.min(1, fraccion))})`

const entrar = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }

// ---------------------------------------------------------------- portada
export function PortadaMov({ datos, modo, ir, alInicio, alPortada }: PropsMov) {
  const c = datos.experiencia.contexto_ciudad
  const totem = esTotem(modo)
  const [antes, despues] = TITULO_MOVILIDAD.includes('¿') ? [TITULO_MOVILIDAD.slice(0, TITULO_MOVILIDAD.indexOf('¿')), TITULO_MOVILIDAD.slice(TITULO_MOVILIDAD.indexOf('¿'))] : ['', TITULO_MOVILIDAD]
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
        <motion.h1 className="display display--xl portada-mov__titulo" {...entrar} transition={{ delay: 0.25 }}>
          {antes}<em>{despues}</em>
        </motion.h1>
        <motion.p className="lead" {...entrar} transition={{ delay: 0.35 }}>
          {LEMA_MOVILIDAD}
        </motion.p>
      </div>
      <div className="portada__pie">
        <motion.div className="portada__cifra" {...entrar} transition={{ delay: 0.5 }}>
          <div className="gran-cifra">
            <span className="gran-cifra__n">{entero(c.fallecidos_2025)}</span>
            <span className="gran-cifra__t">personas murieron en siniestros viales en Bogotá en {anioVal(datos)} y <b>{entero(c.lesionados_2025)}</b> resultaron lesionadas.
              <small className="portada-mov__fuente">{partir(c.fuente)[0]}</small></span>
          </div>
        </motion.div>
        {modo !== 'auto' && (
          <motion.div className="fila" {...entrar} transition={{ delay: 0.6 }}>
            <button className="boton boton--violeta boton--latir" onClick={() => ir('decide')}>Empezar →</button>
            {!totem && <button className="boton boton--claro" onClick={() => ir('presupuesto')}>Ver el presupuesto</button>}
          </motion.div>
        )}
        {totem && (
          <div className="fila fila--entre">
            <span className="toca">{modo === 'auto' ? 'Recorrido automático' : 'Toca para empezar'}</span>
            {/* En el tótem táctil saluda el Proli flotante; en el automático (sin flotante), este */}
            {modo === 'auto' && <Proli tamano={6} lado="derecha" globo={<>Hola, soy <b>Proli</b>. ¿Dónde harías tú una obra de seguridad vial?</>} />}
          </div>
        )}
      </div>
    </>
  )
}

function Cabeza({ c, titulo, children }: { c: CapituloMov; titulo: ReactNode; children?: ReactNode }) {
  return (
    <header className="panel__cabeza">
      <span className="kicker">{kicker(c)}</span>
      <h1 className="display">{titulo}</h1>
      {children}
    </header>
  )
}

// Cada pantalla responde una pregunta: el título la hace, `Respuesta` la contesta en una línea y
// da hasta tres razones («por esto»). Mismas palabras en todo el demo: «como se hace hoy» frente a
// «con el método»; «calculó / pasó» para el cálculo frente a lo ocurrido; «prometes evitar» solo en
// el presupuesto.
function Respuesta({ children, razones }: { children: ReactNode; razones?: ReactNode[] }) {
  return (
    <div className="respuesta">
      <p className="respuesta__dice">{children}</p>
      {razones && razones.length > 0 && (
        <ul className="respuesta__razones">{razones.map((r, i) => <li key={i}>{r}</li>)}</ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 1. Tú decides
export function Decide({ datos, modo, ir, tocadas, setTocadas, localidad }: PropsMov) {
  const p = datos.experiencia.pantalla_1_usted_decide
  const s = datos.sitios
  const listo = tocadas.length >= ESQUINAS_A_TOCAR
  const a1 = anioVal(datos)
  // Calles de barrio con al menos un siniestro grave en el año mostrado, y cuántas alcanza el primer monto
  const conGraves = s.k24.filter((k, i) => k > 0 && s.local[i] === 1).length
  const primero = datos.experiencia.presupuesto_curva.puntos.find((q) => q.presupuesto_millones === datos.experiencia.pantalla_presupuesto_barrio.escenarios.bajo.presupuesto_millones)
  return (
    <div className="panel">
      <Cabeza c="decide" titulo={<>¿Qué esquinas arreglarías <em>primero</em>?</>}>
        <p className="lead">En {p.anio_mostrado}, <b>{entero(conGraves)} esquinas de barrio</b> tuvieron al menos un siniestro grave.
          {primero && <> Con {millones(primero.presupuesto_millones)} alcanza para arreglar unas {entero(primero.esquinas)}.</>} Hay que escoger.</p>
      </Cabeza>
      <Respuesta>Escoge {ESQUINAS_A_TOCAR} esquinas con el método actual: las que tuvieron más siniestros graves en {p.anio_mostrado}.</Respuesta>
      <p className="nota">Toca tu localidad en el mapa y luego las esquinas. Entre más oscura, más siniestros graves.</p>
      <ol className="esquinas">
        {Array.from({ length: ESQUINAS_A_TOCAR }, (_, j) => {
          const i = tocadas[j]
          return (
            <motion.li key={i ?? `v${j}`} className={`esquina ${i == null ? 'esquina--vacia' : ''}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
              <span className="esquina__n">{j + 1}</span>
              {i == null ? <span className="esquina__texto">{localidad == null && j === tocadas.length ? 'Primero toca una localidad' : 'Toca una esquina'}</span> : (
                <span className="esquina__texto"><b>{nombreLocalidad(s.localidades[s.loc[i]])}</b>
                  <small>{entero(s.k24[i])} {s.k24[i] === 1 ? 'siniestro grave' : 'siniestros graves'} en {p.anio_mostrado}</small></span>
              )}
              {i != null && modo !== 'auto' && (
                <button className="esquina__quitar" onClick={() => setTocadas(tocadas.filter((x) => x !== i))} aria-label="Quitar esta esquina">×</button>
              )}
            </motion.li>
          )
        })}
      </ol>
      <div className="panel__pie">
        {modo !== 'auto' && (
          <button className={`boton boton--ancho ${listo ? 'boton--violeta boton--latir' : ''}`} disabled={!listo} onClick={() => ir('anio')}>
            {listo ? `Ver qué pasó en ${a1} →` : ESQUINAS_A_TOCAR - tocadas.length === 1 ? 'Falta 1 esquina' : `Faltan ${ESQUINAS_A_TOCAR - tocadas.length} esquinas`}
          </button>
        )}
        <p className="nota mov-sec">Cada esquina es una zona de {tamanoHex(datos)}. Al tocar, se elige la de más siniestros cerca del dedo.</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 2. Pasó un año
export function Anio({ datos, modo, ir, tocadas }: PropsMov) {
  const ref = datos.experiencia.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024
  const s = datos.sitios
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const max = Math.max(1, ...tocadas.flatMap((i) => [s.k24[i], s.k25[i]]))
  const suma = (k: number[]) => tocadas.reduce((t, i) => t + k[i], 0)
  return (
    <div className="panel">
      <Cabeza c="anio" titulo={<>¿Qué pasó en <em>{a1}</em>?</>} />
      {tocadas.length > 0 && (
        <>
          <Respuesta>En las esquinas que escogiste, los siniestros graves pasaron de <b>{entero(suma(s.k24))}</b> a <b>{entero(suma(s.k25))}</b>.</Respuesta>
          <div className="antes-despues">
            {tocadas.map((i, j) => (
              <div key={i} className="antes-despues__fila">
                <span className="esquina__n">{j + 1}</span>
                <div className="antes-despues__barras">
                  <span className="barra-mini"><i className="barra-mini__antes" style={{ width: ancho(s.k24[i] / max, 5) }} /><b>{a0}: {entero(s.k24[i])}</b></span>
                  <span className="barra-mini"><i className="barra-mini__despues" style={{ width: ancho(s.k25[i] / max, 5) }} /><b>{a1}: {entero(s.k25[i])}</b></span>
                </div>
                <span className={`antes-despues__delta ${s.k25[i] < s.k24[i] ? 'antes-despues__delta--baja' : ''}`}>{conConSigno(s.k25[i], s.k24[i])}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="tarjeta tarjeta--violeta">
        <span className="etiqueta">{tocadas.length ? 'Y no solo las tuyas: ' : ''}las {entero(ref.de_un_total_de)} peores de {a0}</span>
        <div className="gran-cifra gran-cifra--mov">
          <span className="gran-cifra__n">{entero(ref.graves_2024)}<span className="gran-cifra__flecha">→</span>{entero(ref.graves_2025)}</span>
          <span className="gran-cifra__t">siniestros graves. Bajaron <b>{entero(ref.esquinas_que_bajaron)} de {entero(ref.de_un_total_de)}</b>.</span>
        </div>
      </div>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('giro')}>¿Por qué bajaron? →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 3. El giro
export function Giro({ datos, modo, ir, tocadas }: PropsMov) {
  // El título dice lo que les pasó a sus esquinas (si subieron, no se les dice que bajaron).
  // El nombre técnico (regresión a la media) va en Fuentes.
  const s = datos.sitios
  const antes = tocadas.reduce((t, i) => t + s.k24[i], 0), despues = tocadas.reduce((t, i) => t + s.k25[i], 0)
  const [inicio, final] = !tocadas.length ? ['En casi todas las peores esquinas,', 'los siniestros graves bajaron al año siguiente.']
    : despues < antes ? ['Los siniestros graves bajaron en tus esquinas.', 'Y en casi todas las peores.']
      : ['En tus esquinas no bajaron los siniestros graves.', 'Pero en casi todas las peores sí.']
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('giro')}</span>
        <h1 className="display display--giro">{final ? <>{inicio} <em>{final}</em></> : inicio}</h1>
      </header>
      <Respuesta razones={[
        <>Un año muy malo es, en parte, azar: los siniestros graves son raros y su número salta de un año a otro.</>,
        <>Pasa como con la peor nota de un estudiante: en el siguiente examen casi siempre le va mejor.</>,
        <><b>El problema:</b> si escoges con el método actual, cualquier obra parece un éxito y prometes de más.</>,
      ]}>No hace falta una obra para que bajen: después de un año muy malo suele venir uno mejor.</Respuesta>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('solucion')}>¿Cómo se corrige? →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- La solución
export function Solucion({ datos, modo, ir }: PropsMov) {
  const n = datos.experiencia.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.de_un_total_de
  const [p0, p1] = datos.resumen.periodo_estimacion
  const a1 = anioVal(datos)
  return (
    <div className="panel">
      <Cabeza c="solucion" titulo={<>El método de <em>Proliferante</em></>} />
      <Respuesta>Calcula el riesgo real de cada esquina, sin el azar de un año.</Respuesta>
      {/* La diferencia entre los dos métodos, lado a lado */}
      <div className="dos-metodos">
        <div className="dos-metodos__col">
          <b>Método actual</b>
          <span>Mira solo el pasado de la esquina.</span>
          <span>Un año muy malo cuenta todo como riesgo.</span>
        </div>
        <div className="dos-metodos__col dos-metodos__col--proli">
          <b>Método de Proliferante</b>
          <span>Mira su pasado y el de miles de esquinas parecidas.</span>
          <span>Separa el riesgo real del azar de ese año.</span>
        </div>
      </div>
      <h2 className="subtitulo">Cómo lo probamos</h2>
      <ol className="pasos-metodo">
        <li><span><b>Dividimos Bogotá en celdas de {tamanoHex(datos)}</b><small>con los siniestros graves de {p0} a {a1} de la Secretaría de Movilidad.</small></span></li>
        <li><span><b>Cada método calculó el riesgo con {p0} y {p1}</b><small>y escogió sus {entero(n)} esquinas más peligrosas.</small></span></li>
        <li><span><b>Comparamos su cálculo con lo que hubo en {a1}</b><small>un año que ninguno de los dos había visto.</small></span></li>
      </ol>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('metodo')}>Ver el resultado de la prueba →</button>}
      </div>
    </div>
  )
}

/** Una forma de elegir: lo que calculó, lo que pasó y cuánto calculó de más. */
function Promesa({ tag, titulo, promete, ocurrio, max, bien }: { tag: string; titulo: string; promete: number; ocurrio: number; max: number; bien?: boolean }) {
  return (
    <div className={`promesa ${bien ? 'promesa--bien' : ''}`}>
      <div className="promesa__cabeza"><span className="promesa__tag">{tag}</span><b>{titulo}</b></div>
      <div className="promesa__fila">
        <span className="promesa__etiqueta">Calculó</span>
        <span className="promesa__pista"><i className="promesa__barra promesa__barra--promete" style={{ width: ancho(promete / max) }} /><b>{entero(promete)}</b></span>
      </div>
      <div className="promesa__fila">
        <span className="promesa__etiqueta">Hubo</span>
        <span className="promesa__pista"><i className="promesa__barra promesa__barra--ocurrio" style={{ width: ancho(ocurrio / max), animationDelay: '0.25s' }} /><b>{entero(ocurrio)}</b></span>
      </div>
      <span className={`promesa__sobre ${bien ? 'promesa__sobre--bien' : ''}`}>Calculó {entero(Math.max(0, promete - ocurrio))} de más ({pct(sobre(promete, ocurrio))})</span>
    </div>
  )
}
const sobre = (promete: number, ocurrio: number) => Math.round(((promete - ocurrio) / ocurrio) * 100)

// ---------------------------------------------------------------- Antes y después
export function Metodo({ datos, modo, ir, zona, setZona }: PropsMov) {
  const m = datos.experiencia.pantalla_4_el_metodo
  const c = zona === 'barrio' ? m.calles_de_barrio_30_sitios : m.avenidas_30_sitios
  const n = datos.experiencia.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.de_un_total_de
  const max = Math.max(c.regla_simple.promete, c.regla_simple.ocurrio, c.metodo_proliferante.promete, c.metodo_proliferante.ocurrio)
  const a1 = anioVal(datos)
  return (
    <div className="panel">
      <Cabeza c="metodo" titulo={<>¿Cuál <em>acierta</em>?</>} />
      <Respuesta>El método de Proliferante casi acierta: calculó {entero(c.metodo_proliferante.promete)} y hubo {entero(c.metodo_proliferante.ocurrio)}.</Respuesta>
      {modo !== 'auto' && (
        <div className="segmentos" role="group" aria-label="Tipo de vía">
          <button data-proli="zona-barrio" className={`segmento ${zona === 'barrio' ? 'segmento--activo' : ''}`} onClick={() => setZona('barrio')}>Calles de barrio</button>
          <button data-proli="zona-avenidas" className={`segmento ${zona === 'avenidas' ? 'segmento--activo' : ''}`} onClick={() => setZona('avenidas')}>Avenidas</button>
        </div>
      )}
      <div className="promesas">
        <Promesa tag="Antes" titulo="Método actual" promete={c.regla_simple.promete} ocurrio={c.regla_simple.ocurrio} max={max} />
        <Promesa tag="Después" titulo="Método de Proliferante" promete={c.metodo_proliferante.promete} ocurrio={c.metodo_proliferante.ocurrio} max={max} bien />
      </div>
      <p className="nota">Siniestros graves en {a1} en las {entero(n)} esquinas que escogió cada método (casi las mismas: {entero(c.esquinas_en_comun)} de {entero(n)}).
        Calcular de más es prometer de más: lo vemos en el presupuesto.</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('presupuesto')}>Llevarlo al presupuesto →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 5. Presupuesto
/** La curva: siniestros evitados al año según el monto (método de Proliferante) y lo que se prometería con el método actual. */
function CurvaPresupuesto({ puntos, monto }: { puntos: PuntoCurva[]; monto: number }) {
  const W = 320, H = 150, m = { izq: 6, der: 6, arr: 10, aba: 20 }
  const xMax = puntos[puntos.length - 1].presupuesto_millones
  const yMax = Math.max(...puntos.map((p) => p.a_ojo_promete))
  const x = (v: number) => m.izq + (W - m.izq - m.der) * (v / xMax)
  const y = (v: number) => H - m.aba - (H - m.arr - m.aba) * (v / yMax)
  const linea = (k: 'metodo_esperado' | 'a_ojo_promete') =>
    `M${x(0)},${y(0)} ` + puntos.map((p) => `L${x(p.presupuesto_millones).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ')
  const p = puntos.find((q) => q.presupuesto_millones === monto) ?? puntos[0]
  return (
    <figure className="curva">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={`Con ${millones(p.presupuesto_millones)} se evitarían ≈ ${entero(p.metodo_esperado)} siniestros graves al año; con el método actual se prometería evitar ${entero(p.a_ojo_promete)}.`}>
        <line x1={x(0)} x2={x(xMax)} y1={y(0)} y2={y(0)} className="curva__base" />
        <path d={linea('a_ojo_promete')} className="curva__ojo" />
        <path d={linea('metodo_esperado')} className="curva__metodo" />
        <line x1={x(monto)} x2={x(monto)} y1={m.arr} y2={y(0)} className="curva__guia" />
        <circle cx={x(monto)} cy={y(p.a_ojo_promete)} r="3.2" className="curva__punto curva__punto--ojo" />
        <circle cx={x(monto)} cy={y(p.metodo_esperado)} r="4.2" className="curva__punto" />
        {/* Las cifras junto a los puntos (a la izquierda si el punto está cerca del borde derecho) */}
        <text x={x(monto) + (x(monto) > W * 0.75 ? -7 : 7)} y={y(p.a_ojo_promete) - 4} textAnchor={x(monto) > W * 0.75 ? 'end' : 'start'} className="curva__valor curva__valor--ojo">{entero(p.a_ojo_promete)}</text>
        <text x={x(monto) + (x(monto) > W * 0.75 ? -7 : 7)} y={y(p.metodo_esperado) + 13} textAnchor={x(monto) > W * 0.75 ? 'end' : 'start'} className="curva__valor">≈ {entero(p.metodo_esperado)}</text>
        <text x={x(0)} y={H - 5} className="curva__eje">$0</text>
        <text x={x(xMax)} y={H - 5} textAnchor="end" className="curva__eje">{millones(xMax)}</text>
      </svg>
      <figcaption className="curva__leyenda">
        <span><i className="curva__clave curva__clave--metodo" />método de Proliferante: lo que se evitaría</span>
        <span><i className="curva__clave curva__clave--ojo" />método actual: lo que se prometería</span>
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
        <p className="lead">Elige cuánto invertir en reductores de velocidad (≈ {entero(p.costo_por_esquina_millones)} millones por esquina). El método de Proliferante
          los pone en las esquinas de más riesgo real y te dice cuántos siniestros graves se evitarían.</p>
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
          <b>Método actual</b>
          <span>Prometes evitar <b>{entero(e.a_ojo_promete)}</b>; se evitarían <b>≈ {entero(e.a_ojo_esperado)}</b>.</span>
        </div>
        <div className="promesa-fila promesa-fila--bien">
          <b>Método de Proliferante</b>
          <span>Prometes evitar <b>≈ {entero(e.metodo_esperado)}</b>; se evitarían <b>≈ {entero(e.metodo_esperado)}</b>.</span>
        </div>
      </div>
      <p className="lectura">Mismo dinero, casi las mismas obras. Con el método de Proliferante, prometes lo que puedes cumplir.</p>
      <CurvaPresupuesto puntos={puntos} monto={e.presupuesto_millones} />
      <details className="como-calculamos">
        <summary className="boton-texto">¿Y en avenidas? ▾</summary>
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
        <p className="nota">Siniestros graves menos al año. Un reductor cuesta ≈ {entero(r.costos_millones.local)} millones; un semáforo con paso peatonal anticipado,
          hasta ≈ {entero(r.costos_millones.arterial)} millones. Si en avenidas solo hay que reprogramar el semáforo (menos de ≈ {entero(fila.avenidas_compiten_si_cuestan_menos_de_millones)} millones), conviene sumarlas.</p>
      </details>
      <details className="como-calculamos">
        <summary className="boton-texto">Cómo calculamos esto ▾</summary>
        <p className="nota">Obra en barrio: {p.intervencion}, a ≈ {entero(p.costo_por_esquina_millones)} millones cada una; se supone que reduce un {entero(p.reduccion_supuesta_pct)} % los
          siniestros con heridos. En avenidas: {r.intervenciones.arterial.toLowerCase()}, −{entero(r.reducciones_pct.arterial)} %. La mejor combinación se calcula con
          un modelo de optimización (problema de la mochila) sobre el riesgo de cada esquina.</p>
        <div className="aviso-mov" role="note"><b>Ojo:</b> {datos.fuentes.advertencia}</div>
      </details>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('evaluar')}>¿Y si ya hiciste la obra? →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 6. ¿Funcionó la obra?
export function Evaluar({ datos, modo, ir }: PropsMov) {
  const ev = datos.experiencia.evaluacion_obra
  const pr = datos.experiencia.pruebas_regresion_a_la_media
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const max = Math.max(ev.antes_2024, ev.esperado_sin_obra, ev.despues_2025)
  const uno = pr.por_nivel_2024_2025[0]
  const ceros = pr.sin_graves_en_2024
  // De la baja total, cuánto se esperaba sin obra
  const bajo = ev.antes_2024 - ev.despues_2025, igual = Math.round(ev.antes_2024 - ev.esperado_sin_obra)
  const barra = (etiqueta: ReactNode, v: number, clase: string, aprox = false) => (
    <div className="promesa__fila">
      <span className="promesa__etiqueta">{etiqueta}</span>
      <span className="promesa__pista"><i className={`promesa__barra ${clase}`} style={{ width: ancho(v / max) }} /><b>{aprox ? '≈ ' : ''}{entero(v)}</b></span>
    </div>
  )
  return (
    <div className="panel">
      <Cabeza c="evaluar" titulo={<>¿Funcionó <em>la obra</em>?</>}>
        <p className="lead">Ejemplo: en enero de {a1} haces una obra en las {entero(ev.esquinas)} peores esquinas de barrio de {a0}.</p>
      </Cabeza>
      <Respuesta razones={[
        <><b>Método actual</b> (antes contra después): bajaron de {entero(ev.antes_2024)} a {entero(ev.despues_2025)}. Parece que la obra los bajó un {pct(Math.abs(ev.efecto_antes_despues_pct), false)}.</>,
        <><b>Método de Proliferante:</b> sin obra ya se esperaban ≈ {entero(ev.esperado_sin_obra)}. De los {entero(bajo)} siniestros menos, ≈ {entero(igual)} iban a pasar igual.</>,
        <>A la obra solo se le puede atribuir ≈ {pct(Math.round(Math.abs(ev.efecto_con_metodo_pct)), false)}: casi lo que bajó toda la ciudad ({pct(ev.tendencia_ciudad_pct)}).</>,
      ]}>Casi toda la baja iba a pasar igual, sin obra.</Respuesta>
      <div className="promesa promesa--sola">
        {barra(<>{a0}, antes de la obra</>, ev.antes_2024, 'promesa__barra--promete')}
        {barra(<>{a1}, sin obra se esperaba</>, ev.esperado_sin_obra, 'promesa__barra--metodo', true)}
        {barra(<>{a1}, lo que hubo</>, ev.despues_2025, 'promesa__barra--ocurrio')}
        <span className="promesa__sobre">siniestros graves en esas {entero(ev.esquinas)} esquinas</span>
      </div>
      <details className="como-calculamos">
        <summary className="boton-texto">¿Y si sí hubo obras? ▾</summary>
        <ul className="pruebas-mov">
          <li>{ev.nota}</li>
          <li><b>Pasa cada año.</b> Las {entero(pr.un_anio_antes.de)} peores esquinas de {pr.un_anio_antes.anio} también bajaron: de {entero(pr.un_anio_antes.graves_antes)} a {entero(pr.un_anio_antes.graves_despues)}.</li>
          <li><b>Pasa en miles de esquinas.</b> Las {entero(uno.hexagonos)} esquinas con un siniestro grave en {a0} tuvieron en promedio {String(uno.promedio_2025).replace('.', ',')} en {a1}.
            Nadie hace obras en tantas esquinas en un año.</li>
          <li><b>También pasa al revés.</b> De {entero(ceros.hexagonos)} esquinas sin siniestros graves en {a0}, {entero(ceros.con_alguno_en_2025)} tuvieron alguno en {a1}.</li>
          <li><b>El método calculó esta caída sin saber nada de obras.</b></li>
        </ul>
      </details>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('cierre')}>¿Lo hacemos con tus datos? →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 7. Fuentes
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
      <p className="nota">Todo va agregado por hexágono: no se muestran siniestros individuales ni datos de personas (Ley 1581 de 2012).</p>
      <div className="aviso-mov" role="note">{f.advertencia}</div>
      <p className="etiqueta">Modelo {datos.experiencia.version_modelo}</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('cierre')}>← Volver</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Hablemos
export function Cierre({ datos, modo, ir, alInicio }: PropsMov) {
  const [pregunta, resto] = partir(datos.experiencia.cierre.texto_sugerido, '? ')
  const i = pregunta.indexOf(' en tu ')
  const totem = esTotem(modo)
  const reto = useReto()
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('cierre')}</span>
        <h1 className="display">{i > 0 ? <>{pregunta.slice(0, i)} <em>{pregunta.slice(i + 1)}</em></> : pregunta}</h1>
        {resto && <p className="lead">{resto}</p>}
      </header>
      <div className="cierre">
        <Proli tamano={5.5} globo={<>Cuéntanos tu reto: lo resolvemos con <b>los datos de tu entidad</b>.</>} />
        <QrCita />
      </div>
      <div className="panel__pie">
        {!totem && URL_CITA && <button className="boton boton--violeta boton--ancho" onClick={() => window.open(urlCitaCon(reto), '_blank', 'noopener')}>Agenda una reunión para conocer tu reto</button>}
        {modo !== 'auto' && (
          <div className="fila">
            <button className="boton boton--claro" onClick={() => ir('portada')}>Ver de nuevo</button>
            <button className="boton-texto" onClick={() => ir('fuentes')}>De dónde salen los datos</button>
            {alInicio && <button className="boton-texto" onClick={alInicio}>Ver otros proyectos</button>}
          </div>
        )}
      </div>
    </div>
  )
}
