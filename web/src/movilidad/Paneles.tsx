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
import { ESQUINAS_A_TOCAR, LEMA_MOVILIDAD, NOMBRE_MOVILIDAD, TITULO_MOVILIDAD, URL_CITA } from '../config'
import { esTotem, type Modo } from '../modo'
import { entero, millones, nombreLocalidad, pct, pctFraccion, type DatosMovilidad, type Nivel } from './datos'

export type CapituloMov = 'decide' | 'anio' | 'giro' | 'metodo' | 'presupuesto' | 'fuentes' | 'cierre'
export type VistaMov = 'portada' | CapituloMov
export const CAPITULOS_MOV: { id: CapituloMov; nombre: string }[] = [
  { id: 'decide', nombre: 'Usted decide' },
  { id: 'anio', nombre: 'Pasó un año' },
  { id: 'giro', nombre: 'El giro' },
  { id: 'metodo', nombre: 'El método' },
  { id: 'presupuesto', nombre: 'Presupuesto' },
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
  nivel: Nivel
  setNivel: (n: Nivel) => void
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
            <span className="toca">{modo === 'auto' ? 'Recorrido automático' : 'Toque para empezar'}</span>
            <Proli tamano={6} lado="derecha" globo={<>Hola, soy <b>Proli</b>. ¿Dónde haría usted una obra de seguridad vial?</>} />
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

// ---------------------------------------------------------------- 1. Usted decide
export function Decide({ datos, modo, ir, tocadas, setTocadas, localidad, setLocalidad }: PropsMov) {
  const p = datos.experiencia.pantalla_1_usted_decide
  const s = datos.sitios
  // Calles de barrio con al menos un siniestro grave en el año mostrado (sale del archivo)
  const conGraves = s.k24.filter((k, i) => k > 0 && s.local[i] === 1).length
  const listo = tocadas.length >= ESQUINAS_A_TOCAR
  return (
    <div className="panel">
      <Cabeza c="decide" titulo={p.titulo_sugerido}>
        <p className="lead"><b>{p.instruccion}</b> El mapa muestra los siniestros graves de {p.anio_mostrado} en calles de barrio:
          {' '}<b>{entero(conGraves)}</b> hexágonos de {tamanoHex(datos)} con al menos uno.</p>
      </Cabeza>
      {modo !== 'auto' && (
        <label className="selector mov-sec">
          <span className="etiqueta">Acercar a una localidad (opcional)</span>
          <select value={localidad ?? ''} onChange={(e) => setLocalidad(e.target.value === '' ? null : +e.target.value)}>
            <option value="">Toda Bogotá</option>
            {s.localidades.map((l, i) => <option key={l} value={i}>{nombreLocalidad(l)}</option>)}
          </select>
        </label>
      )}
      <ol className="esquinas">
        {Array.from({ length: ESQUINAS_A_TOCAR }, (_, j) => {
          const i = tocadas[j]
          return (
            <motion.li key={i ?? `v${j}`} className={`esquina ${i == null ? 'esquina--vacia' : ''}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
              <span className="esquina__n">{j + 1}</span>
              {i == null ? <span className="esquina__texto">Toque el mapa</span> : (
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
            {listo ? 'Pasó un año →' : ESQUINAS_A_TOCAR - tocadas.length === 1 ? 'Falta 1 esquina' : `Faltan ${ESQUINAS_A_TOCAR - tocadas.length} esquinas`}
          </button>
        )}
        <p className="nota mov-sec">Al tocar, se elige la calle de barrio con más siniestros cerca del dedo. Se puede acercar el mapa.</p>
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
      <Cabeza c="anio" titulo={p.titulo_sugerido}>
        <p className="lead">Así le fue en {a1} a cada esquina que usted eligió.</p>
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
          <p className="nota mov-sec">Sus esquinas: <b>{entero(suma(s.k24))}</b> en {a0} → <b>{entero(suma(s.k25))}</b> en {a1}.</p>
        </div>
      ) : (
        <p className="nota">No eligió esquinas: vea la referencia de la ciudad.</p>
      )}
      <div className="tarjeta tarjeta--violeta">
        <span className="etiqueta">Las {entero(ref.de_un_total_de)} peores esquinas de barrio de {a0}</span>
        <div className="gran-cifra gran-cifra--mov">
          <span className="gran-cifra__n">{entero(ref.graves_2024)}<span className="gran-cifra__flecha">→</span>{entero(ref.graves_2025)}</span>
          <span className="gran-cifra__t">siniestros graves en {a0} y en {a1}. Bajaron <b>{entero(ref.esquinas_que_bajaron)} de {entero(ref.de_un_total_de)}</b>.</span>
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
        {modo !== 'auto' && <button className="boton boton--ancho" onClick={() => ir('giro')}>¿Qué significa? →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 3. El giro
export function Giro({ datos, modo, ir }: PropsMov) {
  // Solo la primera frase: la segunda del JSON («Bajaron solas…») afirma algo que los datos no
  // dicen (el análisis no considera obras hechas en esos sitios); la lectura de abajo lo dice bien
  const [primera] = partir(datos.experiencia.pantalla_3_el_giro.texto_sugerido)
  const [inicio, final] = partir(primera, ', ')
  const ref = datos.experiencia.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('giro')}</span>
        <h1 className="display display--giro">{final ? <>{inicio} <em>{final}</em></> : primera}</h1>
      </header>
      <p className="lectura">Las {entero(ref.de_un_total_de)} peores esquinas de {anioBase(datos)} pasaron de <b>{entero(ref.graves_2024)}</b> a <b>{entero(ref.graves_2025)}</b> siniestros graves.
        Un año malo suele venir seguido de uno más tranquilo, con obra o sin ella.</p>
      <p className="nota">Por eso, para saber si una obra funcionó, se compara con lo que se esperaba que pasara sin ella. Eso es lo que hace el método.</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('metodo')}>Ver el método →</button>}
      </div>
    </div>
  )
}

/** Barras "se prometía / ocurrió": dos colores distintos y texto en cada barra. */
function Promesa({ titulo, sub, promete, ocurrio, max, sobre }: { titulo: string; sub: string; promete: number; ocurrio: number; max: number; sobre: number }) {
  return (
    <div className="promesa">
      <div className="promesa__cabeza"><b>{titulo}</b><small>{sub}</small></div>
      <div className="promesa__fila">
        <span className="promesa__etiqueta">Se prometía</span>
        <span className="promesa__pista"><i className="promesa__barra promesa__barra--promete" style={{ width: ancho(promete / max) }} /><b>{entero(promete)}</b></span>
      </div>
      <div className="promesa__fila">
        <span className="promesa__etiqueta">Ocurrió</span>
        <span className="promesa__pista"><i className="promesa__barra promesa__barra--ocurrio" style={{ width: ancho(ocurrio / max), animationDelay: '0.25s' }} /><b>{entero(ocurrio)}</b></span>
      </div>
      <span className="promesa__sobre">{pct(sobre)} de diferencia</span>
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
  return (
    <div className="panel">
      <Cabeza c="metodo" titulo={m.titulo_sugerido}>
        <p className="lead">{m.explicacion}</p>
      </Cabeza>
      {modo !== 'auto' && (
        <div className="segmentos" role="group" aria-label="Tipo de vía">
          <button data-proli="zona-barrio" className={`segmento ${zona === 'barrio' ? 'segmento--activo' : ''}`} onClick={() => setZona('barrio')}>Calles de barrio</button>
          <button data-proli="zona-avenidas" className={`segmento ${zona === 'avenidas' ? 'segmento--activo' : ''}`} onClick={() => setZona('avenidas')}>Avenidas</button>
        </div>
      )}
      <div className="promesas">
        <Promesa titulo="Práctica intuitiva" sub={`promedio de lo ocurrido en ${p0}–${p1}`} promete={c.regla_simple.promete} ocurrio={c.regla_simple.ocurrio} max={max} sobre={c.regla_simple.sobrestimacion_pct} />
        <Promesa titulo="Con el método" sub="riesgo corregido (Bayes empírico, Hauer)" promete={c.metodo_proliferante.promete} ocurrio={c.metodo_proliferante.ocurrio} max={max} sobre={c.metodo_proliferante.sobrestimacion_pct} />
      </div>
      <p className="lectura">{m.mensaje_clave} Las dos listas coinciden en <b>{entero(c.esquinas_en_comun)} de {entero(n)}</b> esquinas.</p>
      <p className="nota mov-sec">La diferencia que queda es del orden de la caída de siniestros graves {zona === 'barrio' ? 'en calles de barrio' : 'en avenidas'} en {anioVal(datos)} frente al promedio {p0}–{p1} (<b>{pctFraccion(datos.resumen.validacion_2025[zona === 'barrio' ? 'local' : 'arterial'].tendencia_2025_vs_promedio)}</b>), que ninguna lista podía anticipar.
        Es el mismo tipo de análisis que ya usa la ciudad (hexágonos de {tamanoHex(datos)}, método de Hauer), llevado a las calles de barrio, y se actualiza cada vez que llegan datos nuevos.</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('presupuesto')}>Llevarlo al presupuesto →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 5. Presupuesto
export function Presupuesto({ datos, modo, ir, nivel, setNivel }: PropsMov) {
  const p = datos.experiencia.pantalla_presupuesto_barrio
  const e = p.escenarios[nivel]
  const niveles = Object.keys(p.escenarios) as Nivel[]
  const max = Math.max(e.se_esperaria_evitar_por_anio, e.la_practica_intuitiva_prometeria)
  return (
    <div className="panel">
      <Cabeza c="presupuesto" titulo={<>Con <em>{millones(e.presupuesto_millones)}</em></>}>
        <p className="lead mov-sec">Reductores de velocidad en las calles de barrio de mayor riesgo corregido. Elija el presupuesto:</p>
      </Cabeza>
      <div className="segmentos" role="group" aria-label="Presupuesto">
        {niveles.map((n) => (
          <button key={n} data-proli={`presupuesto-${n}`} className={`segmento ${n === nivel ? 'segmento--activo' : ''}`} disabled={modo === 'auto'} onClick={() => setNivel(n)}>
            ${entero(p.escenarios[n].presupuesto_millones)}<small>millones</small>
          </button>
        ))}
      </div>
      <Veredicto etiqueta={<>Con {millones(e.presupuesto_millones)} en reductores de velocidad</>}
                 cifra={`≈ ${entero(e.se_esperaria_evitar_por_anio)}`}
                 frase="siniestros graves menos al año en calles de barrio"
                 nota={<>Alcanza para <b>{entero(e.esquinas)} esquinas de barrio</b>, las de mayor riesgo, a ≈ {entero(p.costo_por_esquina_millones)} millones
                   cada una. Es una estimación: supone que cada obra reduce un {entero(p.reduccion_supuesta_pct)}% los siniestros con heridos.</>} />
      <h2 className="subtitulo">¿Por qué no prometer más?</h2>
      <div className="promesa promesa--sola">
        <div className="promesa__fila">
          <span className="promesa__etiqueta">Eligiendo las esquinas a ojo, se prometería</span>
          <span className="promesa__pista"><i className="promesa__barra promesa__barra--promete" style={{ width: ancho(e.la_practica_intuitiva_prometeria / max) }} /><b>{entero(e.la_practica_intuitiva_prometeria)}</b></span>
        </div>
        <div className="promesa__fila">
          <span className="promesa__etiqueta">Con el método, se puede prometer</span>
          <span className="promesa__pista"><i className="promesa__barra promesa__barra--ocurrio" style={{ width: ancho(e.se_esperaria_evitar_por_anio / max) }} /><b>{entero(e.se_esperaria_evitar_por_anio)}</b></span>
        </div>
      </div>
      <p className="lectura mov-sec">Una lista hecha a ojo promete <b>{entero(e.la_practica_intuitiva_prometeria)}</b> porque toma un año malo como si fuera lo normal.
        El método corrige ese efecto: promete <b>{entero(e.se_esperaria_evitar_por_anio)}</b>, una cifra con la que se puede responder.</p>
      <div className="aviso-mov" role="note"><b>Ojo:</b> {datos.fuentes.advertencia}</div>
      <p className="nota mov-sec">Obra supuesta: {p.intervencion}.</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho" onClick={() => ir('fuentes')}>De dónde salen los datos →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 6. Fuentes
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
      <p className="nota">Todo va agregado por hexágono: no se muestran siniestros individuales ni datos de personas (Ley 1581 de 2012).</p>
      <div className="aviso-mov" role="note">{f.advertencia}</div>
      <p className="etiqueta">Modelo {datos.experiencia.version_modelo}</p>
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('cierre')}>Continuar →</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 7. Cierre
export function Cierre({ datos, modo, ir, alInicio }: PropsMov) {
  const [pregunta, resto] = partir(datos.experiencia.cierre.texto_sugerido, '? ')
  const i = pregunta.indexOf(' de su ')
  const totem = esTotem(modo)
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('cierre')}</span>
        <h1 className="display">{i > 0 ? <>{pregunta.slice(0, i)} de <em>{pregunta.slice(i + 4)}</em></> : pregunta}</h1>
        {resto && <p className="lead">{resto}</p>}
      </header>
      <div className="cierre">
        <Proli tamano={5.5} globo={<>Le mostramos {NOMBRE_MOVILIDAD} con <b>los datos de su entidad</b>.</>} />
        <QrCita />
      </div>
      <div className="panel__pie">
        {!totem && <button className="boton boton--violeta boton--ancho" onClick={() => window.open(URL_CITA, '_blank', 'noopener')}>Agendar una cita</button>}
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
