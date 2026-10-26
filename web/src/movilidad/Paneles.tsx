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

export type CapituloMov = 'decide' | 'anio' | 'giro' | 'metodo' | 'presupuesto' | 'evaluar' | 'fuentes' | 'cierre'
export type VistaMov = 'portada' | CapituloMov
export const CAPITULOS_MOV: { id: CapituloMov; nombre: string }[] = [
  { id: 'decide', nombre: 'Tú decides' },
  { id: 'anio', nombre: 'Pasó un año' },
  { id: 'giro', nombre: 'El giro' },
  { id: 'metodo', nombre: 'El método' },
  { id: 'presupuesto', nombre: 'Presupuesto' },
  { id: 'evaluar', nombre: '¿Funcionó la obra?' },
  { id: 'fuentes', nombre: 'Fuentes' },
  { id: 'cierre', nombre: 'Hablemos' },
]
export const numeroMov = (c: CapituloMov) => String(CAPITULOS_MOV.findIndex((x) => x.id === c) + 1).padStart(2, '0')
const kicker = (c: CapituloMov) => `${numeroMov(c)} · ${CAPITULOS_MOV.find((x) => x.id === c)!.nombre}`

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
          <b>{LEMA_MOVILIDAD}</b> Un análisis que se suma a la priorización que ya hace la ciudad y la lleva a las calles de barrio.
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

// ---------------------------------------------------------------- 1. Tú decides
export function Decide({ datos, modo, ir, tocadas, setTocadas, localidad, setLocalidad }: PropsMov) {
  const p = datos.experiencia.pantalla_1_usted_decide
  const s = datos.sitios
  // Calles de barrio con al menos un siniestro grave en el año mostrado (sale del archivo)
  const conGraves = s.k24.filter((k, i) => k > 0 && s.local[i] === 1).length
  const listo = tocadas.length >= ESQUINAS_A_TOCAR
  const a1 = anioVal(datos)
  return (
    <div className="panel">
      <Cabeza c="decide" titulo={p.titulo_sugerido}>
        <p className="lead"><b>{p.instruccion}</b> El mapa muestra los siniestros graves de {p.anio_mostrado} en calles de barrio:
          {' '}<b>{entero(conGraves)}</b> hexágonos de {tamanoHex(datos)} con al menos uno.</p>
      </Cabeza>
      {modo !== 'auto' && (
        <div className="grupo">
          <div className="grupo__titulo"><b>Primero, elige una localidad</b><span>así las esquinas se ven más grandes</span></div>
          <div className="chips chips--localidades">
            <button className={`chip ${localidad == null ? 'chip--activo' : ''}`} onClick={() => setLocalidad(null)}>Toda Bogotá</button>
            {s.localidades.map((l, i) => (
              <button key={l} className={`chip ${localidad === i ? 'chip--activo' : ''}`} onClick={() => setLocalidad(i)}>{nombreLocalidad(l)}</button>
            ))}
          </div>
        </div>
      )}
      <ol className="esquinas">
        {Array.from({ length: ESQUINAS_A_TOCAR }, (_, j) => {
          const i = tocadas[j]
          return (
            <motion.li key={i ?? `v${j}`} className={`esquina ${i == null ? 'esquina--vacia' : ''}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
              <span className="esquina__n">{j + 1}</span>
              {i == null ? <span className="esquina__texto">Toca el mapa</span> : (
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
        {listo && <p className="nota">Elegiste mirando los siniestros de {p.anio_mostrado}. Ya sabemos qué pasó en {a1} en esas mismas esquinas.</p>}
        {modo !== 'auto' && (
          <button className={`boton boton--ancho ${listo ? 'boton--violeta boton--latir' : ''}`} disabled={!listo} onClick={() => ir('anio')}>
            {listo ? `Ver qué pasó en ${a1} →` : ESQUINAS_A_TOCAR - tocadas.length === 1 ? 'Falta 1 esquina' : `Faltan ${ESQUINAS_A_TOCAR - tocadas.length} esquinas`}
          </button>
        )}
        <p className="nota mov-sec">Al tocar, se elige la calle de barrio con más siniestros cerca del dedo. Puedes acercar el mapa.</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 2. Pasó un año
export function Anio({ datos, modo, ir, tocadas, anio, setAnio }: PropsMov) {
  const p = datos.experiencia.pantalla_2_pasa_un_anio
  const ref = p.referencia_30_peores_esquinas_de_barrio_2024
  const s = datos.sitios
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const max = Math.max(1, ...tocadas.flatMap((i) => [s.k24[i], s.k25[i]]))
  const suma = (k: number[]) => tocadas.reduce((t, i) => t + k[i], 0)
  return (
    <div className="panel">
      <Cabeza c="anio" titulo={<>Así les fue a tus esquinas en <em>{a1}</em></>}>
        <p className="lead">Datos reales de la Secretaría de Movilidad, un año después de cuando elegiste.</p>
      </Cabeza>
      {tocadas.length > 0 ? (
        <div className="antes-despues">
          {tocadas.map((i, j) => (
            <div key={i} className="antes-despues__fila">
              <span className="esquina__n">{j + 1}</span>
              <div className="antes-despues__barras">
                <span className="etiqueta">{nombreLocalidad(s.localidades[s.loc[i]])}</span>
                <span className="barra-mini"><i className="barra-mini__antes" style={{ width: ancho(s.k24[i] / max, 5) }} /><b>{a0}: {entero(s.k24[i])}</b></span>
                <span className="barra-mini"><i className="barra-mini__despues" style={{ width: ancho(s.k25[i] / max, 5) }} /><b>{a1}: {entero(s.k25[i])}</b></span>
              </div>
              <span className={`antes-despues__delta ${s.k25[i] < s.k24[i] ? 'antes-despues__delta--baja' : ''}`}>{conConSigno(s.k25[i], s.k24[i])}</span>
            </div>
          ))}
          <p className="nota">Tus esquinas pasaron de <b>{entero(suma(s.k24))}</b> siniestros graves en {a0} a <b>{entero(suma(s.k25))}</b> en {a1}.</p>
        </div>
      ) : (
        <p className="nota">No elegiste esquinas: mira lo que pasó en la ciudad.</p>
      )}
      <div className="tarjeta tarjeta--violeta">
        <span className="etiqueta">Y no fue solo en las tuyas: las {entero(ref.de_un_total_de)} peores esquinas de barrio de {a0}</span>
        <div className="gran-cifra gran-cifra--mov">
          <span className="gran-cifra__n">{entero(ref.graves_2024)}<span className="gran-cifra__flecha">→</span>{entero(ref.graves_2025)}</span>
          <span className="gran-cifra__t">siniestros graves en {a0} y en {a1}. Bajaron <b>{entero(ref.esquinas_que_bajaron)} de {entero(ref.de_un_total_de)}</b>. ¿Por qué bajaron casi todas?</span>
        </div>
        <small className="nota mov-sec">{ref.advertencia}</small>
      </div>
      <div className="panel__pie">
        {modo !== 'auto' && (
          <div className="segmentos" role="group" aria-label="Año en el mapa">
            <button data-proli="anio-2024" className={`segmento ${anio === 'k24' ? 'segmento--activo' : ''}`} onClick={() => setAnio('k24')}>Mapa {a0}</button>
            <button data-proli="anio-2025" className={`segmento ${anio === 'k25' ? 'segmento--activo' : ''}`} onClick={() => setAnio('k25')}>Mapa {a1}</button>
          </div>
        )}
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('giro')}>Descubre por qué →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 3. El giro
export function Giro({ datos, modo, ir }: PropsMov) {
  // Tres momentos cortos: la revelación, la explicación (con una comparación cotidiana) y lo que
  // está en juego. El nombre técnico del efecto (regresión a la media) va solo en Fuentes.
  const [inicio, final] = partir(datos.experiencia.pantalla_3_el_giro.texto_sugerido)
  const ref = datos.experiencia.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('giro')}</span>
        <h1 className="display display--giro">{final ? <>{inicio} <em>{final}</em></> : inicio}</h1>
      </header>
      <p className="lectura">De las {entero(ref.de_un_total_de)} peores esquinas de {anioBase(datos)}, bajaron <b>{entero(ref.esquinas_que_bajaron)}</b>:
        de <b>{entero(ref.graves_2024)}</b> a <b>{entero(ref.graves_2025)}</b> siniestros graves.</p>
      <p className="nota">Es como un estudiante que saca su peor nota en un examen: en el siguiente casi siempre le va mejor, aunque no
        haya estudiado más. Con las esquinas pasa igual: un año muy malo suele ser en parte mala suerte, y al año siguiente vuelve a lo normal, con obra o sin ella.</p>
      <p className="nota"><b>Lo que está en juego:</b> si eliges esquinas solo por el año pasado, cualquier obra parecerá un éxito y prometerás resultados
        que no se van a cumplir. Para saber si una obra funciona, hay que compararla con lo que habría pasado sin ella.</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('metodo')}>Ver cómo lo resolvemos →</button>}
      </div>
    </div>
  )
}

/** Barras "esperaba / pasó": dos colores distintos y texto en cada barra; abajo, cuánto prometió de más. */
function Promesa({ titulo, sub, promete, ocurrio, max, anio, bien }: { titulo: string; sub: string; promete: number; ocurrio: number; max: number; anio: number; bien?: boolean }) {
  return (
    <div className="promesa">
      <div className="promesa__cabeza"><b>{titulo}</b><small>{sub}</small></div>
      <div className="promesa__fila">
        <span className="promesa__etiqueta">Esperaba para {anio}</span>
        <span className="promesa__pista"><i className="promesa__barra promesa__barra--promete" style={{ width: ancho(promete / max) }} /><b>{entero(promete)}</b></span>
      </div>
      <div className="promesa__fila">
        <span className="promesa__etiqueta">Pasó en {anio}</span>
        <span className="promesa__pista"><i className="promesa__barra promesa__barra--ocurrio" style={{ width: ancho(ocurrio / max), animationDelay: '0.25s' }} /><b>{entero(ocurrio)}</b></span>
      </div>
      <span className={`promesa__sobre ${bien ? 'promesa__sobre--bien' : ''}`}>Prometió {entero(Math.max(0, promete - ocurrio))} siniestros de más</span>
    </div>
  )
}

// ---------------------------------------------------------------- 4. El método
export function Metodo({ datos, modo, ir, zona, setZona }: PropsMov) {
  const m = datos.experiencia.pantalla_4_el_metodo
  const c = zona === 'barrio' ? m.calles_de_barrio_30_sitios : m.avenidas_30_sitios
  const n = datos.experiencia.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.de_un_total_de
  const max = Math.max(c.regla_simple.promete, c.regla_simple.ocurrio, c.metodo_proliferante.promete, c.metodo_proliferante.ocurrio)
  const [p0, p1] = datos.resumen.periodo_estimacion
  const a1 = anioVal(datos)
  return (
    <div className="panel">
      <Cabeza c="metodo" titulo={m.titulo_sugerido}>
        <p className="lead">{m.explicacion}</p>
      </Cabeza>
      <ol className="pasos-metodo mov-sec">
        <li><span><b>Dividimos Bogotá en celdas de {tamanoHex(datos)}</b><small>y ubicamos en cada una los siniestros graves de {p0} a {a1} reportados por la Secretaría de Movilidad.</small></span></li>
        <li><span><b>Calculamos el riesgo de cada esquina de dos formas</b><small>con {p0} y {p1}: mirando solo su pasado, como se hace normalmente, y con nuestro método, que la compara con esquinas parecidas para descontar la mala suerte de un año.</small></span></li>
        <li><span><b>Cada forma eligió sus {entero(n)} esquinas más peligrosas</b><small>y calculó cuántos siniestros graves habría en ellas en {a1}.</small></span></li>
        <li><span><b>Comparamos esa promesa con lo que de verdad pasó en {a1}</b><small>un año que ninguno de los dos cálculos había visto.</small></span></li>
      </ol>
      {modo !== 'auto' && (
        <div className="segmentos" role="group" aria-label="Tipo de vía">
          <button data-proli="zona-barrio" className={`segmento ${zona === 'barrio' ? 'segmento--activo' : ''}`} onClick={() => setZona('barrio')}>Calles de barrio</button>
          <button data-proli="zona-avenidas" className={`segmento ${zona === 'avenidas' ? 'segmento--activo' : ''}`} onClick={() => setZona('avenidas')}>Avenidas</button>
        </div>
      )}
      <div className="promesas">
        <Promesa titulo="Mirando solo el pasado" sub={`lo ocurrido en ${p0}–${p1}, como se hace normalmente`} promete={c.regla_simple.promete} ocurrio={c.regla_simple.ocurrio} max={max} anio={a1} />
        <Promesa titulo="Con el método de Proliferante" sub="descuenta la mala suerte de un año" promete={c.metodo_proliferante.promete} ocurrio={c.metodo_proliferante.ocurrio} max={max} anio={a1} bien />
      </div>
      <p className="leyenda-promesa mov-sec"><i className="promesa__barra--promete" /> lo que esperaba cada forma · <i className="promesa__barra--ocurrio" /> lo que pasó de verdad</p>
      <p className="lectura">{m.mensaje_clave} Coinciden en <b>{entero(c.esquinas_en_comun)} de {entero(n)}</b> esquinas.</p>
      <p className="nota mov-sec">Cómo funciona, en simple: es como evaluar a un jugador de fútbol. No lo juzgas por un solo partido muy bueno o muy malo,
        sino por ese partido junto con lo que suelen rendir jugadores parecidos. Así se separa el riesgo real de una esquina de la mala suerte de un año.</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('presupuesto')}>Llevarlo al presupuesto →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 5. Presupuesto
/** La curva: siniestros evitados al año según el monto, con el método y lo que prometería una lista a ojo. */
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
           aria-label={`Con ${millones(p.presupuesto_millones)} se esperaría evitar ≈ ${entero(p.metodo_esperado)} siniestros graves al año; a ojo se prometerían ${entero(p.a_ojo_promete)}.`}>
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
        <span><i className="curva__clave curva__clave--metodo" />con el método: lo que se esperaría evitar</span>
        <span><i className="curva__clave curva__clave--ojo" />a ojo: lo que se prometería</span>
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
  const paso = atajos[0][1].presupuesto_millones
  const sigue = puntos.find((q) => q.presupuesto_millones === e.presupuesto_millones + paso)
  const primero = puntos.find((q) => q.presupuesto_millones === paso)
  const r = datos.experiencia.presupuesto_reparto
  const fila = r.filas.reduce((a, b) => (Math.abs(b.presupuesto_millones - monto) < Math.abs(a.presupuesto_millones - monto) ? b : a))
  const maxR = Math.max(fila.todo_en_barrio, fila.todo_en_avenidas, fila.mejor_combinacion.esperado)
  const mejor = fila.mejor_combinacion
  return (
    <div className="panel">
      <Cabeza c="presupuesto" titulo={<>¿Qué logras con <em>{millones(e.presupuesto_millones)}</em>?</>}>
        <p className="lead mov-sec">Reductores de velocidad en las calles de barrio con más riesgo real. Mueve el monto:</p>
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
      <Veredicto etiqueta={<>Con {millones(e.presupuesto_millones)} en reductores de velocidad</>}
                 cifra={`≈ ${entero(e.metodo_esperado)}`}
                 frase="siniestros graves menos al año en calles de barrio"
                 nota={<>En <b>{entero(e.esquinas)} esquinas de barrio</b>, las de más riesgo real que alcanzan con este monto.
                   {sigue && primero && <> Con {millones(paso)} más se sumarían ≈ {entero(sigue.metodo_esperado - e.metodo_esperado)}; los primeros {millones(paso)} evitan ≈ {entero(primero.metodo_esperado)}.
                     Cada peso rinde menos, porque primero van las esquinas de más riesgo.</>}</>} />
      <CurvaPresupuesto puntos={puntos} monto={e.presupuesto_millones} />

      <h2 className="subtitulo">Lo que prometes y lo que logras</h2>
      <div className="promesas-duelo">
        <div className="promesa-fila promesa-fila--mal">
          <b>Eligiendo solo con el año pasado</b>
          <span>Prometes <b>{entero(e.a_ojo_promete)}</b>; se esperaría lograr <b>≈ {entero(e.a_ojo_esperado)}</b>.</span>
          <em>Prometes {entero(e.a_ojo_promete - e.a_ojo_esperado)} siniestros evitados que no van a ocurrir.</em>
        </div>
        <div className="promesa-fila promesa-fila--bien">
          <b>Con el método de Proliferante</b>
          <span>Prometes <b>≈ {entero(e.metodo_esperado)}</b>; se esperaría lograr <b>≈ {entero(e.metodo_esperado)}</b>.</span>
          <em>Prometes lo que vas a cumplir.</em>
        </div>
      </div>
      <p className="lectura">Mismo presupuesto, casi las mismas obras. La diferencia es una promesa que tu entidad puede defender ante el concejo,
        los órganos de control y la ciudadanía.</p>

      <h2 className="subtitulo">¿Barrio o avenidas?</h2>
      <p className="nota">Con {millones(fila.presupuesto_millones)}, el método busca la mejor combinación entre reductores en calles de barrio
        (≈ {entero(r.costos_millones.local)} millones cada uno) y semáforos con paso peatonal anticipado en avenidas (hasta ≈ {entero(r.costos_millones.arterial)} millones cada uno):</p>
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
      <p className="nota">Siniestros graves menos al año. Con estos costos, el mismo dinero rinde mucho más en las calles de barrio.
        Pero el costo de las avenidas es un tope: si el paso peatonal anticipado cuesta menos de ≈ {entero(fila.avenidas_compiten_si_cuestan_menos_de_millones)} millones por
        intersección (por ejemplo, si solo hay que reprogramar el semáforo), conviene sumar avenidas. Con el costo real, el modelo vuelve a decidir.</p>
      <details className="como-calculamos">
        <summary className="boton-texto">Cómo calculamos esto ▾</summary>
        <p className="nota">Obra en barrio: {p.intervencion}, a ≈ {entero(p.costo_por_esquina_millones)} millones cada una; se supone que reduce un {entero(p.reduccion_supuesta_pct)} % los
          siniestros con heridos. En avenidas: {r.intervenciones.arterial.toLowerCase()}, −{entero(r.reducciones_pct.arterial)} %. La mejor combinación se calcula con
          un modelo de optimización (problema de la mochila) sobre el riesgo real de cada sitio.</p>
        <div className="aviso-mov" role="note"><b>Ojo:</b> {datos.fuentes.advertencia}</div>
      </details>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('evaluar')}>¿Y cómo sabes si la obra funcionó? →</button>}
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
  const barra = (etiqueta: ReactNode, v: number, clase: string, aprox = false) => (
    <div className="promesa__fila">
      <span className="promesa__etiqueta">{etiqueta}</span>
      <span className="promesa__pista"><i className={`promesa__barra ${clase}`} style={{ width: ancho(v / max) }} /><b>{aprox ? '≈ ' : ''}{entero(v)}</b></span>
    </div>
  )
  return (
    <div className="panel">
      <Cabeza c="evaluar" titulo={<>¿Funcionó <em>la obra</em>?</>}>
        <p className="lead">Supón que en enero de {a1} tu entidad hizo una obra en las {entero(ev.esquinas)} peores esquinas de barrio de {a0}. Un año después,
          ¿cuánto mérito tiene la obra?</p>
      </Cabeza>
      <div className="promesa promesa--sola">
        {barra(<>Antes ({a0})</>, ev.antes_2024, 'promesa__barra--promete')}
        {barra(<>Sin obra se esperaba ({a1})</>, ev.esperado_sin_obra, 'promesa__barra--metodo', true)}
        {barra(<>Pasó ({a1})</>, ev.despues_2025, 'promesa__barra--ocurrio')}
        <span className="promesa__sobre">siniestros graves en esas {entero(ev.esquinas)} esquinas</span>
      </div>
      <div className="promesas-duelo">
        <div className="promesa-fila promesa-fila--mal">
          <b>Mirando antes y después</b>
          <span>De {entero(ev.antes_2024)} a {entero(ev.despues_2025)} siniestros graves.</span>
          <em>«La obra los redujo un {pct(Math.abs(ev.efecto_antes_despues_pct), false)}».</em>
        </div>
        <div className="promesa-fila promesa-fila--bien">
          <b>Con el método de Proliferante</b>
          <span>Sin obra ya se esperaban ≈ {entero(ev.esperado_sin_obra)}; pasaron {entero(ev.despues_2025)}.</span>
          <em>La obra solo puede reclamar ≈ {pct(Math.round(Math.abs(ev.efecto_con_metodo_pct)), false)}, del tamaño de la caída de toda la ciudad en {a1} ({pct(ev.tendencia_ciudad_pct)}).</em>
        </div>
      </div>
      <p className="lectura">Antes de celebrar o de prometer, compara con lo que habría pasado sin la obra. Así se sabe si una obra de verdad funcionó.</p>

      <h2 className="subtitulo">¿Y si sí hubo obras?</h2>
      <ul className="pruebas-mov">
        <li><b>Pasa cada año.</b> Las {entero(pr.un_anio_antes.de)} peores esquinas de {pr.un_anio_antes.anio} también bajaron al año siguiente:
          de {entero(pr.un_anio_antes.graves_antes)} a {entero(pr.un_anio_antes.graves_despues)} ({entero(pr.un_anio_antes.bajaron)} de {entero(pr.un_anio_antes.de)}).</li>
        <li><b>Pasa en miles de esquinas.</b> Las {entero(uno.hexagonos)} esquinas con un siniestro grave en {a0} tuvieron en promedio {String(uno.promedio_2025).replace('.', ',')} en {a1}.
          Nadie interviene {entero(uno.hexagonos)} esquinas en un año.</li>
        <li><b>También pasa al revés.</b> De {entero(ceros.hexagonos)} esquinas sin siniestros graves en {a0}, {entero(ceros.con_alguno_en_2025)} tuvieron alguno en {a1}.
          Una obra no hace que una esquina empeore.</li>
        <li><b>El método lo predijo sin saber nada de obras.</b> Aunque se hubiera hecho alguna, esta caída ya se esperaba.</li>
      </ul>
      <p className="nota mov-sec">{ev.nota}</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('fuentes')}>De dónde salen los datos →</button>}
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
        El método es el de <b>Bayes empírico</b> (Hauer, 1997), reconocido en seguridad vial. En {anioVal(datos)}, los siniestros graves en calles de barrio
        cambiaron {pctFraccion(datos.resumen.validacion_2025.local.tendencia_2025_vs_promedio)} frente al promedio {datos.resumen.periodo_estimacion.join('–')} en toda la ciudad,
        algo que ningún cálculo podía anticipar: eso explica lo poco que el método prometió de más.</p>
      <p className="nota">Todo va agregado por hexágono: no se muestran siniestros individuales ni datos de personas (Ley 1581 de 2012).</p>
      <div className="aviso-mov" role="note">{f.advertencia}</div>
      <p className="etiqueta">Modelo {datos.experiencia.version_modelo}</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('cierre')}>Continuar →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 8. Cierre
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
            {alInicio && <button className="boton-texto" onClick={alInicio}>Ver otros proyectos</button>}
          </div>
        )}
      </div>
    </div>
  )
}
