/**
 * Los capítulos de Movilidad+ (panel de texto junto al mapa). Ninguna cifra se escribe a mano:
 * todas salen de los datos (experiencia.json, fuentes.json, resumen.json, sitios.geojson).
 *
 * Tono: un análisis que se suma a la priorización que ya hace la ciudad y la lleva a las calles
 * de barrio. "Con estos supuestos, se esperaría…"; nunca "esta obra salvará X vidas". Movilidad+
 * trata de «tú». Los textos siguen el diagnóstico «Demos GovTech 2026 · Diagnóstico y arreglos de
 * Movilidad+»: los nombres técnicos (Bayes empírico, regresión a la media) van solo en Fuentes.
 */
import { animate, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BotonInicio, BotonTema, LogoEmpresa, MarcaDeAgua, NombreApp } from '../componentes/Marca'
import Proli, { ProliMarca } from '../componentes/Proli'
import QrCita from '../componentes/QrCita'
import Veredicto from '../componentes/Veredicto'
import { ESQUINAS_A_TOCAR, LEMA_MOVILIDAD, NOMBRE_MOVILIDAD, TITULO_MOVILIDAD, URL_CITA } from '../config'
import { esTotem, type Modo } from '../modo'
import { BIT } from './MapaMovilidad'
import { entero, millones, nombreLocalidad, pct, type DatosMovilidad, type Nivel } from './datos'

export type CapituloMov = 'decide' | 'anio' | 'giro' | 'metodo' | 'presupuesto' | 'fuentes' | 'cierre'
export type VistaMov = 'portada' | CapituloMov
export const CAPITULOS_MOV: { id: CapituloMov; nombre: string }[] = [
  { id: 'decide', nombre: 'Tú decides' },
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
const referencia = (d: DatosMovilidad) => d.experiencia.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024
/** "115 m", leído de la unidad del modelo */
export const tamanoHex = (d: DatosMovilidad) => d.resumen.unidad.match(/[\d.,]+\s*m\b/)?.[0] ?? ''
/** Primera oración y el resto de un texto */
const partir = (t: string, sep = '. ') => { const i = t.indexOf(sep); return i < 0 ? [t, ''] : [t.slice(0, i + 1), t.slice(i + sep.length).trim()] }
const conConSigno = (n: number, d: number) => (n - d > 0 ? '+' : n - d < 0 ? '−' : '±') + entero(Math.abs(n - d))
/** Siniestros graves de las esquinas tocadas en el año base y en el de validación */
const sumaTocadas = (d: DatosMovilidad, tocadas: number[]) => ({
  antes: tocadas.reduce((t, i) => t + d.sitios.k24[i], 0),
  despues: tocadas.reduce((t, i) => t + d.sitios.k25[i], 0),
})

/** Localidades donde se pueden elegir las esquinas: con al menos ESQUINAS_A_TOCAR calles de barrio con siniestros. */
export function localidadesElegibles(d: DatosMovilidad): number[] {
  const s = d.sitios
  const n = s.localidades.map(() => 0)
  for (let i = 0; i < s.n; i++) if (s.local[i] === 1 && s.k24[i] > 0) n[s.loc[i]]++
  return s.localidades.map((_, l) => l).filter((l) => n[l] >= ESQUINAS_A_TOCAR)
}

/** Ancho de una barra: proporcional, dejando sitio para el número al lado */
const ancho = (fraccion: number, rem = 3.4) => `calc((100% - ${rem}rem) * ${Math.max(0, Math.min(1, fraccion))})`

const entrar = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }

/** Un número que corre hasta su valor cuando cambia (con "reducir movimiento", salta). */
function Contador({ n, desde }: { n: number; desde?: number }) {
  const [v, setV] = useState(desde ?? n)
  const previo = useRef(desde ?? n)
  useEffect(() => {
    const inicio = previo.current
    previo.current = n
    if (inicio === n || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(n); return }
    const c = animate(inicio, n, { duration: 0.8, ease: [0.16, 1, 0.3, 1], onUpdate: setV })
    return () => c.stop()
  }, [n])
  return <>{entero(v)}</>
}

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
            {modo === 'auto' && <Proli tamano={6} lado="derecha" globo={<>Hola, soy <b>Proli</b>. ¿Qué esquinas arreglarías primero?</>} />}
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
  const s = datos.sitios
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const listo = tocadas.length >= ESQUINAS_A_TOCAR
  // Primero la localidad (botones grandes), después las esquinas dentro de ella
  const eligiendoLocalidad = modo !== 'auto' && localidad == null
  // Calles de barrio con al menos un siniestro grave en el año mostrado, en la localidad elegida
  const conGraves = s.k24.filter((k, i) => k > 0 && s.local[i] === 1 && (localidad == null || s.loc[i] === localidad)).length
  const elegir = (l: number) => { if (l !== localidad) setTocadas([]); setLocalidad(l) }
  return (
    <div className="panel">
      <Cabeza c="decide" titulo={<>¿Dónde invertirías <em>tú</em>?</>}>
        <p className="lead">Elige como lo haría la mayoría: <b>donde hubo más siniestros el año pasado.</b></p>
      </Cabeza>
      {eligiendoLocalidad ? (
        <>
          <p className="subtitulo">Primero, elige una localidad</p>
          <div className="localidades-mov" role="group" aria-label="Localidad">
            {localidadesElegibles(datos).map((l) => (
              <button key={l} data-proli={`localidad-${s.localidades[l]}`} className="localidad-mov" onClick={() => elegir(l)}>
                {nombreLocalidad(s.localidades[l])}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {localidad != null && (
            <div className="localidad-elegida">
              <span><small className="etiqueta">Localidad</small><b>{nombreLocalidad(s.localidades[localidad])}</b></span>
              {modo !== 'auto' && <button className="boton-texto" onClick={() => setLocalidad(null)}>Cambiar</button>}
            </div>
          )}
          <p className="nota">Toca en el mapa {entero(ESQUINAS_A_TOCAR)} esquinas donde harías una obra de seguridad vial. El mapa muestra los siniestros graves
            de {a0} en calles de barrio: <b>{entero(conGraves)}</b> hexágonos de {tamanoHex(datos)} con al menos uno.</p>
          <ol className="esquinas">
            {Array.from({ length: ESQUINAS_A_TOCAR }, (_, j) => {
              const i = tocadas[j]
              return (
                <motion.li key={i ?? `v${j}`} className={`esquina ${i == null ? 'esquina--vacia' : ''}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                  <span className="esquina__n">{j + 1}</span>
                  {i == null ? <span className="esquina__texto">Toca el mapa</span> : (
                    <span className="esquina__texto"><b>{nombreLocalidad(s.localidades[s.loc[i]])}</b>
                      <small>{entero(s.k24[i])} {s.k24[i] === 1 ? 'siniestro grave' : 'siniestros graves'} en {a0}</small></span>
                  )}
                  {i != null && modo !== 'auto' && (
                    <button className="esquina__quitar" onClick={() => setTocadas(tocadas.filter((x) => x !== i))} aria-label="Quitar esta esquina">×</button>
                  )}
                </motion.li>
              )
            })}
          </ol>
          {listo && <p className="lectura">Elegiste mirando los siniestros de {a0}. Ya sabemos qué pasó en {a1} en esas mismas esquinas.</p>}
        </>
      )}
      <div className="panel__pie">
        {modo !== 'auto' && !eligiendoLocalidad && (
          <button className={`boton boton--ancho ${listo ? 'boton--violeta boton--latir' : ''}`} disabled={!listo} onClick={() => ir('anio')}>
            {listo ? `Ver qué pasó en ${a1}` : ESQUINAS_A_TOCAR - tocadas.length === 1 ? 'Falta 1 esquina' : `Faltan ${ESQUINAS_A_TOCAR - tocadas.length} esquinas`}
          </button>
        )}
        {!eligiendoLocalidad && <p className="nota mov-sec">Al tocar, se elige la calle de barrio con más siniestros cerca del dedo. Puedes acercar el mapa.</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 2. Pasó un año
export function Anio({ datos, modo, ir, tocadas, anio, setAnio }: PropsMov) {
  const ref = referencia(datos)
  const s = datos.sitios
  const a0 = anioBase(datos), a1 = anioVal(datos)
  const max = Math.max(1, ...tocadas.flatMap((i) => [s.k24[i], s.k25[i]]))
  const { antes, despues } = sumaTocadas(datos, tocadas)
  return (
    <div className="panel">
      <Cabeza c="anio" titulo={tocadas.length ? <>Así les fue a tus esquinas en <em>{a1}</em></> : <>Así les fue a las peores esquinas en <em>{a1}</em></>}>
        <p className="lead">Datos reales de la Secretaría de Movilidad.</p>
      </Cabeza>
      {tocadas.length > 0 && (
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
        </div>
      )}
      <p className="lectura">
        {tocadas.length > 0
          ? <>Tus esquinas pasaron de <b>{entero(antes)}</b> a <b>{entero(despues)}</b> siniestros graves. {despues < antes ? 'Y no fue solo en las tuyas:' : 'Mira lo que pasó en la ciudad:'}</>
          : <>No elegiste esquinas. Mira lo que pasó en la ciudad:</>}
      </p>
      <div className="tarjeta tarjeta--violeta">
        <span className="etiqueta">Las {entero(ref.de_un_total_de)} peores esquinas de barrio de {a0}</span>
        <div className="gran-cifra gran-cifra--mov">
          <span className="gran-cifra__n">{entero(ref.graves_2024)}<span className="gran-cifra__flecha">→</span>{entero(ref.graves_2025)}</span>
          <span className="gran-cifra__t">siniestros graves en {a0} y en {a1}. Bajaron <b>{entero(ref.esquinas_que_bajaron)} de {entero(ref.de_un_total_de)}</b>.</span>
        </div>
        <small className="nota mov-sec">{ref.advertencia}</small>
      </div>
      <p className="subtitulo">¿Por qué bajaron casi todas?</p>
      <div className="panel__pie">
        {modo !== 'auto' && (
          <div className="segmentos" role="group" aria-label="Año en el mapa">
            <button data-proli="anio-2024" className={`segmento ${anio === 'k24' ? 'segmento--activo' : ''}`} onClick={() => setAnio('k24')}>Mapa {a0}</button>
            <button data-proli="anio-2025" className={`segmento ${anio === 'k25' ? 'segmento--activo' : ''}`} onClick={() => setAnio('k25')}>Mapa {a1}</button>
          </div>
        )}
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('giro')}>Descubrir por qué</button>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 3. El giro
export function Giro({ datos, modo, ir, tocadas }: PropsMov) {
  // Tres momentos: la revelación, la explicación (una comparación cotidiana) y lo que está en juego
  const ref = referencia(datos)
  const { antes, despues } = sumaTocadas(datos, tocadas)
  const bajaron = tocadas.length > 0 && despues < antes
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('giro')}</span>
        <h1 className="display display--giro">
          {bajaron ? <>Tus esquinas bajaron. <em>Pero casi todas las peores también.</em></> : <>Las peores esquinas <em>bajaron casi todas.</em></>}
        </h1>
      </header>
      <div className="gran-cifra gran-cifra--mov">
        <span className="gran-cifra__n"><Contador n={ref.esquinas_que_bajaron} desde={0} /><span className="gran-cifra__de"> de {entero(ref.de_un_total_de)}</span></span>
        <span className="gran-cifra__t">de las peores esquinas de barrio de {anioBase(datos)} tuvieron menos siniestros graves en {anioVal(datos)}.</span>
      </div>
      <p className="lectura">Es como un estudiante que saca su peor nota en un examen: en el siguiente casi siempre le va mejor, aunque no haya estudiado más.
        Con las esquinas pasa igual: <b>un año muy malo suele ser en parte mala suerte</b>, y al año siguiente vuelve a lo normal, con obra o sin ella.</p>
      <div className="aviso-mov" role="note">Si eliges esquinas solo por el año pasado, cualquier obra parecerá un éxito y <b>prometerás resultados que no se van a cumplir</b>.
        Para saber si una obra funciona hay que compararla con lo que habría pasado sin ella.</div>
      <Proli tamano={4} globo={<>Por eso no basta con mirar el año pasado. Te muestro cómo lo hacemos en <b>Proliferante</b>.</>} />
      <div className="panel__pie">
        {modo !== 'auto' && <button className="boton boton--ancho boton--violeta" onClick={() => ir('metodo')}>Ver cómo lo resolvemos</button>}
      </div>
    </div>
  )
}

/** Barras "esperaba / pasó" de una forma de elegir, con cuánto prometió de más (o de menos). */
function Promesa({ titulo, sub, promete, ocurrio, max, peor, anio }: {
  titulo: string; sub: string; promete: number; ocurrio: number; max: number; peor: boolean; anio: number
}) {
  const de = Math.round(promete - ocurrio)
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
      <span className={`promesa__sobre ${peor ? 'promesa__sobre--mal' : 'promesa__sobre--bien'}`}>
        {de === 0 ? 'Prometió lo que pasó' : `Prometió ${entero(Math.abs(de))} ${Math.abs(de) === 1 ? 'siniestro' : 'siniestros'} de ${de > 0 ? 'más' : 'menos'}`}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- 4. El método
export function Metodo({ datos, modo, ir, zona, setZona }: PropsMov) {
  const m = datos.experiencia.pantalla_4_el_metodo
  const c = zona === 'barrio' ? m.calles_de_barrio_30_sitios : m.avenidas_30_sitios
  const n = referencia(datos).de_un_total_de
  const max = Math.max(c.regla_simple.promete, c.regla_simple.ocurrio, c.metodo_proliferante.promete, c.metodo_proliferante.ocurrio)
  const [p0, p1] = datos.resumen.periodo_estimacion
  const a1 = anioVal(datos)
  const error = (x: { promete: number; ocurrio: number }) => Math.abs(x.promete - x.ocurrio)
  const pasadoPeor = error(c.regla_simple) >= error(c.metodo_proliferante)
  return (
    <div className="panel">
      <Cabeza c="metodo" titulo={<>Promesas que <em>se cumplen</em></>}>
        <p className="lead">Con datos de {p0} y {p1}, cada forma de elegir prometió cuántos siniestros graves habría en {a1} en sus {entero(n)} esquinas. Así les fue.</p>
      </Cabeza>
      <div className="tarjeta qhicimos">
        <span className="etiqueta">Qué hicimos</span>
        <ol>
          <li>Dividimos Bogotá en celdas de {tamanoHex(datos)} y ubicamos en cada una los siniestros graves de {p0}, {p1} y {a1} reportados por la Secretaría de Movilidad.</li>
          <li>Con los datos de {p0} y {p1} calculamos el riesgo de cada esquina de dos formas: mirando solo su pasado, como se hace normalmente, y con nuestro método,
            que compara cada esquina con otras parecidas para descontar la mala suerte de un año.</li>
          <li>Cada forma eligió sus {entero(n)} esquinas más peligrosas y calculó cuántos siniestros graves habría en ellas en {a1}.</li>
          <li>Después comparamos esa promesa con lo que de verdad pasó en {a1}, un año que ninguno de los dos cálculos había visto.</li>
        </ol>
      </div>
      {modo !== 'auto' && (
        <div className="segmentos" role="group" aria-label="Tipo de vía">
          <button data-proli="zona-barrio" className={`segmento ${zona === 'barrio' ? 'segmento--activo' : ''}`} onClick={() => setZona('barrio')}>Calles de barrio</button>
          <button data-proli="zona-avenidas" className={`segmento ${zona === 'avenidas' ? 'segmento--activo' : ''}`} onClick={() => setZona('avenidas')}>Avenidas</button>
        </div>
      )}
      <div className="promesa-leyenda" aria-hidden>
        <span><i className="promesa__barra--promete" />Esperaba para {a1}</span>
        <span><i className="promesa__barra--ocurrio" />Pasó en {a1}</span>
      </div>
      <div className="promesas">
        <Promesa titulo="Mirando solo el pasado" sub={`promedio de lo que pasó en ${p0}–${p1}`} anio={a1} peor={pasadoPeor}
                 promete={c.regla_simple.promete} ocurrio={c.regla_simple.ocurrio} max={max} />
        <Promesa titulo="Con el método de Proliferante" sub="compara cada esquina con otras parecidas" anio={a1} peor={!pasadoPeor}
                 promete={c.metodo_proliferante.promete} ocurrio={c.metodo_proliferante.ocurrio} max={max} />
      </div>
      <p className="frase-mov">Las dos eligen casi las mismas esquinas ({entero(c.esquinas_en_comun)} de {entero(n)}). <em>La diferencia está en cuánto se puede prometer y cumplir.</em></p>
      <p className="nota">Es como evaluar a un jugador de fútbol: no lo juzgas por un solo partido muy bueno o muy malo, sino por ese partido junto con lo que suelen
        rendir jugadores parecidos. Así se separa el riesgo real de una esquina de la mala suerte de un año.</p>
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
  const s = datos.sitios
  // Lo que en realidad se esperaría evitar con la lista hecha mirando solo el pasado (con el riesgo
  // corregido), si el modelo lo trae
  const pasadoLogra = datos.resumen.asignacion_presupuesto?.barrio?.[nivel]?.lista_por_conteo_bruto?.esperado_evitados_anual_eb ?? e.se_esperaria_evitar_por_anio
  const deMas = e.la_practica_intuitiva_prometeria - pasadoLogra
  // Dónde quedarían las esquinas: las localidades con más esquinas elegidas
  const porLocalidad = s.localidades.map((nombre, l) => ({ nombre, n: 0, l }))
  for (let i = 0; i < s.n; i++) if (s.sel[i] & BIT[nivel]) porLocalidad[s.loc[i]].n++
  const top = porLocalidad.filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 4)
  return (
    <div className="panel">
      <Cabeza c="presupuesto" titulo={<>¿Qué logras con <em>tu presupuesto</em>?</>} />
      <div className="segmentos segmentos--grandes" role="group" aria-label="Presupuesto">
        {niveles.map((n) => (
          <button key={n} data-proli={`presupuesto-${n}`} className={`segmento ${n === nivel ? 'segmento--activo' : ''}`} disabled={modo === 'auto'} onClick={() => setNivel(n)}>
            ${entero(p.escenarios[n].presupuesto_millones)}<small>millones</small>
          </button>
        ))}
      </div>
      <Veredicto etiqueta={<><Contador n={e.esquinas} /> esquinas de barrio con reductores de velocidad</>}
                 cifra={<>≈ <Contador n={e.se_esperaria_evitar_por_anio} /></>}
                 frase="siniestros graves menos al año" />
      <div className="comparar-mov">
        <div className="comparar-mov__fila">
          <b className="comparar-mov__quien">Eligiendo mirando solo el pasado</b>
          <span className="comparar-mov__dato"><small>Prometes</small><b><Contador n={e.la_practica_intuitiva_prometeria} /></b></span>
          <span className="comparar-mov__dato"><small>Lograrías</small><b>≈ <Contador n={pasadoLogra} /></b></span>
          <span className="comparar-mov__dif comparar-mov__dif--mal">Prometes <Contador n={deMas} /> siniestros evitados que no van a ocurrir.</span>
        </div>
        <div className="comparar-mov__fila">
          <b className="comparar-mov__quien">Con el método de Proliferante</b>
          <span className="comparar-mov__dato"><small>Prometes</small><b>≈ <Contador n={e.se_esperaria_evitar_por_anio} /></b></span>
          <span className="comparar-mov__dato"><small>Lograrías</small><b>≈ <Contador n={e.se_esperaria_evitar_por_anio} /></b></span>
          <span className="comparar-mov__dif comparar-mov__dif--bien">Prometes lo que puedes cumplir.</span>
        </div>
      </div>
      <p className="frase-mov">Mismo presupuesto, casi las mismas obras. <em>La diferencia es una promesa que tu entidad puede defender</em> ante el concejo,
        los órganos de control y la ciudadanía.</p>
      {top.length > 0 && (
        <p className="nota"><b>Dónde quedarían las esquinas:</b>{' '}
          {top.map((x, j) => <span key={x.l}>{j > 0 && ' · '}{nombreLocalidad(x.nombre)} {entero(x.n)}</span>)}{porLocalidad.filter((x) => x.n > 0).length > top.length && ' · …'}</p>
      )}
      <details className="desplegable-mov">
        <summary>Cómo calculamos esto</summary>
        <p>Obra supuesta: {p.intervencion}, a ≈ {entero(p.costo_por_esquina_millones)} millones por esquina: con {millones(e.presupuesto_millones)} alcanzan
          las {entero(e.esquinas)} esquinas de barrio de mayor riesgo real.</p>
        <p>Supone que cada obra reduce un {entero(p.reduccion_supuesta_pct)} % los siniestros con heridos. «Lograrías» es lo que se esperaría evitar según el
          riesgo de cada esquina, ya descontada la mala suerte de un año: es una estimación, no algo medido.</p>
        <p>{datos.fuentes.advertencia}</p>
      </details>
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
  const v = datos.resumen.validacion_2025
  // "bajaron 10,8 %": sin signo, el verbo ya dice la dirección
  const caida = (x: number) => pct(Math.round(Math.abs(x) * 1000) / 10, false)
  const [p0, p1] = datos.resumen.periodo_estimacion
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
      <p className="nota mov-sec">Lo que muestra «El giro» se llama <b>regresión a la media</b>. En {anioVal(datos)}, los siniestros graves bajaron
        {' '}<b>{caida(v.local.tendencia_2025_vs_promedio)}</b> en calles de barrio y <b>{caida(v.arterial.tendencia_2025_vs_promedio)}</b> en
        avenidas frente al promedio {p0}–{p1}, algo que ningún cálculo podía anticipar; eso es coherente con lo poco que prometió de más el método.</p>
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
  // La pregunta del archivo trata de «usted»; aquí va la de «tú». El resto del texto sale del archivo.
  const [, resto] = partir(datos.experiencia.cierre.texto_sugerido, '? ')
  const totem = esTotem(modo)
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('cierre')}</span>
        <h1 className="display">¿Y con los datos de <em>tu entidad</em>?</h1>
        {resto && <p className="lead">{resto}</p>}
      </header>
      <div className="cierre">
        <Proli tamano={5.5} globo={<>Agenda una reunión con <b>Proliferante</b> para conocer tu reto.</>} />
        <QrCita />
      </div>
      <div className="panel__pie">
        {!totem && URL_CITA && <button className="boton boton--violeta boton--ancho" onClick={() => window.open(URL_CITA, '_blank', 'noopener')}>Agenda una reunión</button>}
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
