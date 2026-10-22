import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { decimal, type Datos } from '../datos'
import { familiasDe, nombreColegio } from '../estado'
import { distanciaKm, simularCaso, type Politica, type ResultadoCaso, type Supuestos } from '../motor'
import type { PropsCapitulo } from './tipos'

export interface EstadoCaso {
  lon: number | null
  lat: number | null
  vulnerable: boolean
  hermanoEn: number | null
  colegios: number[]
  llegada: number
  /** nombre del personaje de ejemplo, si la familia salió de uno */
  quien: string | null
}
export const casoInicial = (): EstadoCaso => ({ lon: null, lat: null, vulnerable: false, hermanoEn: null, colegios: [], llegada: 0.5, quien: null })

/** Los colegios más cercanos a un punto (con el colegio nuevo, si hay). */
export function cercanos(pos: [number, number][], lon: number, lat: number, n: number) {
  return pos.map((p, s) => ({ s, d: distanciaKm(lon, lat, p[0], p[1]) })).sort((a, b) => a.d - b.d).slice(0, n)
}

/** Agrega o quita un colegio de la lista (hasta k), en orden de preferencia. */
export function alternarColegio(caso: EstadoCaso, s: number, k: number): EstadoCaso {
  const ya = caso.colegios.includes(s)
  const colegios = ya ? caso.colegios.filter((x) => x !== s) : caso.colegios.length < k ? [...caso.colegios, s] : caso.colegios
  return { ...caso, colegios, hermanoEn: caso.hermanoEn != null && !colegios.includes(caso.hermanoEn) ? null : caso.hermanoEn }
}

/** Corre la asignación completa con la familia del caso (~100 ms: llamarla con cuidado). */
export function resolverCaso(datos: Datos, s: Supuestos, p: Politica, c: EstadoCaso): ResultadoCaso | null {
  if (c.lon == null || !c.colegios.length) return null
  return simularCaso(datos.familias, datos, s, p, {
    lon: c.lon, lat: c.lat!, vulnerable: c.vulnerable, hermanoEn: c.hermanoEn, colegios: c.colegios, llegada: c.llegada,
  })
}

// ---------------------------------------------------------------- el viaje (para el mapa)
export type Cual = 'hoy' | 'matricula'
export interface PasoViaje { sede: number; resultado: 'rechazo' | 'queda' | 'reubicado' }
export interface Viaje { pasos: PasoViaje[]; final: 'queda' | 'reubicado' | 'sin'; llave: string; sedes: number[] }

/** Recorrido de la familia: pide sus opciones en orden hasta que queda; si no, la reubican o queda sin cupo. */
export function viajeDe(colegios: number[], res: ResultadoCaso, cual: Cual, k: number): Viaje {
  const lista = colegios.slice(0, k)
  const pasoDe = (x: ResultadoCaso['hoy']): Pick<Viaje, 'pasos' | 'final'> => x.opcion >= 0
    ? { pasos: [...lista.slice(0, x.opcion).map((sede) => ({ sede, resultado: 'rechazo' as const })), { sede: lista[x.opcion], resultado: 'queda' }], final: 'queda' }
    : { pasos: [...lista.map((sede) => ({ sede, resultado: 'rechazo' as const })), ...(x.reubicado ? [{ sede: x.sede, resultado: 'reubicado' as const }] : [])],
        final: x.reubicado ? 'reubicado' : 'sin' }
  const v = pasoDe(cual === 'hoy' ? res.hoy : res.matricula)
  // Los dos recorridos caben en el encuadre (así la cámara no salta al cambiar)
  const sedes = [...new Set([...lista, ...[res.hoy, res.matricula].filter((x) => x.sede >= 0).map((x) => x.sede)])]
  return { ...v, sedes, llave: `${cual}-${v.pasos.map((x) => x.sede + x.resultado).join(',')}` }
}

// ---------------------------------------------------------------- personajes de ejemplo
interface Personaje {
  nombre: string
  localidad: string
  fraccion: number          // qué familia real de la localidad (posición en la lista)
  vulnerable: boolean
  llegada: number
  hermano: number | null    // opción donde ya estudia un hermano
  rasgos: string[]
}
// Elegidos probando con simularCaso (supuestos y reglas por defecto): en los tres primeros
// Matrícula+ cambia el resultado; el último es el caso feliz, igual en los dos.
export const PERSONAJES: Personaje[] = [
  { nombre: 'Laura', localidad: 'Bosa', fraccion: 0.19, vulnerable: false, llegada: 0.95, hermano: null, rasgos: ['llega de últimas'] },
  { nombre: 'Andrés', localidad: 'Suba', fraccion: 0.32, vulnerable: false, llegada: 0.5, hermano: 0, rasgos: ['hermano en su 1.ª opción'] },
  { nombre: 'Marta', localidad: 'Ciudad Bolívar', fraccion: 0.04, vulnerable: true, llegada: 0.5, hermano: null, rasgos: ['familia vulnerable'] },
  { nombre: 'Sofía', localidad: 'Kennedy', fraccion: 0.3, vulnerable: false, llegada: 0.05, hermano: null, rasgos: ['llega de primeras'] },
]

export function casoDePersonaje(p: Personaje, datos: Datos, pos: [number, number][], k: number): EstadoCaso {
  const f = familiasDe(datos, p.localidad)
  const i = f[Math.floor(f.length * p.fraccion)]
  const lon = datos.familias.lon[i], lat = datos.familias.lat[i]
  const colegios = cercanos(pos, lon, lat, k).map((x) => x.s)
  return { lon, lat, vulnerable: p.vulnerable, llegada: p.llegada, colegios,
    hermanoEn: p.hermano != null ? colegios[p.hermano] ?? null : null, quien: p.nombre }
}

// ---------------------------------------------------------------- comparar resultados
type Destino = ResultadoCaso['hoy']
/** Menor = mejor: primero quedar en sus opciones, luego reubicada, luego sin cupo; y la distancia. */
const puntaje = (x: Destino) => (x.opcion >= 0 ? 0 : x.reubicado ? 100 : 1000) + x.dist
const corto = (x: Destino) => (x.opcion >= 0 ? `${x.opcion + 1}.ª opción · ${decimal(x.dist)} km` : x.reubicado ? `reubicada a ${decimal(x.dist)} km` : 'sin cupo')

function veredicto(r: ResultadoCaso): { texto: string; tono: 'mejor' | 'igual' | 'peor' } {
  const { hoy, matricula: m } = r
  if (hoy.sede === m.sede && hoy.reubicado === m.reubicado) return { texto: 'Igual en los dos', tono: 'igual' }
  const mejor = puntaje(m) < puntaje(hoy)
  const [a, b] = mejor ? [m, hoy] : [hoy, m]
  const quien = mejor ? 'Matrícula+' : 'Hoy'
  let texto: string
  if (b.sede < 0) texto = `${quien} le da cupo a ${decimal(a.dist)} km`
  else if (a.opcion >= 0 && b.opcion < 0) texto = `${quien} la deja en su ${a.opcion + 1}.ª opción`
  else if (b.dist - a.dist >= 0.05) texto = `${quien} la acerca ${decimal(b.dist - a.dist)} km`
  else texto = `${quien} la deja en una opción mejor`
  return { texto, tono: mejor ? 'mejor' : 'peor' }
}

/** Corre tareas caras de a una (con pausas entre ellas) para que la interfaz no se trabe. */
function useDiferido<T>(tareas: (() => T)[], llave: string): (T | undefined)[] {
  const ref = useRef(tareas)
  ref.current = tareas
  const [hecho, setHecho] = useState<{ llave: string; res: T[] }>({ llave: '', res: [] })
  useEffect(() => {
    let i = 0, id = 0
    const res: T[] = []
    const paso = () => {
      if (i >= ref.current.length) return
      res.push(ref.current[i++]())
      setHecho({ llave, res: [...res] })
      id = window.setTimeout(paso, 30)
    }
    id = window.setTimeout(paso, 280)  // espera a que se calme la interacción
    return () => window.clearTimeout(id)
  }, [llave])
  return hecho.llave === llave ? hecho.res : []
}

// ---------------------------------------------------------------- panel
export interface PropsCaso extends PropsCapitulo {
  caso: EstadoCaso
  setCaso: (c: EstadoCaso) => void
  ubicar: (lon: number, lat: number) => void
  res: ResultadoCaso | null
  cual: Cual
  setCual: (c: Cual) => void
}

const LLEGADAS = [{ v: 0.05, t: 'De primeras' }, { v: 0.5, t: 'A mitad' }, { v: 0.95, t: 'De últimas' }]

/**
 * Simula una familia: dónde vive, cuántos niños, si es vulnerable, si tiene un hermano en un
 * colegio, qué colegios pide y cuándo llega. Se agrega a las 15.896 familias y se corre todo.
 * Arriba, siempre a la vista, el duelo Hoy vs. Matrícula+; en el mapa, su viaje.
 */
export default function Caso({ datos, r, modo, supuestos, caso, setCaso, ubicar, res, cual, setCual }: PropsCaso) {
  const set = (c: Partial<EstadoCaso>) => setCaso({ ...caso, ...c })
  const k = supuestos.opciones
  const pos = r.pol.pos
  const politica = r.pol.politica
  const auto = modo === 'auto'
  const quieto = useReducedMotion()
  const lista = useMemo(() => (caso.lon == null ? [] : cercanos(pos, caso.lon, caso.lat!, 8)), [pos, caso.lon, caso.lat])

  // Personajes: su resultado se calcula en segundo plano para mostrarlo en la tarjeta
  const casosEjemplo = useMemo(() => PERSONAJES.map((p) => casoDePersonaje(p, datos, pos, k)), [datos, pos, k])
  const resEjemplo = useDiferido(caso.lon == null ? casosEjemplo.map((c) => () => resolverCaso(datos, supuestos, politica, c)) : [],
    caso.lon == null ? `ej-${k}-${JSON.stringify(supuestos)}-${JSON.stringify(politica)}` : 'nada')

  // Tótem automático: carga un personaje solo (y alterna el viaje Hoy / Matrícula+)
  useEffect(() => { if (auto && caso.lon == null) setCaso(casosEjemplo[0]) }, [auto, caso.lon, casosEjemplo, setCaso])
  useEffect(() => {
    if (!auto) return
    const id = window.setInterval(() => setCual(cual === 'hoy' ? 'matricula' : 'hoy'), 9000)
    return () => window.clearInterval(id)
  }, [auto, cual, setCual])

  // ¿Qué cambiaría su suerte? Variantes del caso, simuladas de a una
  const variantes = useMemo(() => {
    if (caso.lon == null || !caso.colegios.length) return []
    const v: { texto: string; cambio: Partial<EstadoCaso> }[] = []
    const [c1, c2] = caso.colegios
    if (caso.llegada > 0.05) v.push({ texto: 'Si llegara de primeras', cambio: { llegada: 0.05 } })
    if (caso.hermanoEn !== c1) v.push({ texto: `Si tuviera un hermano en ${nombreColegio(datos, c1)}`, cambio: { hermanoEn: c1 } })
    if (!caso.vulnerable) v.push({ texto: 'Si fuera una familia vulnerable', cambio: { vulnerable: true } })
    if (c2 != null) v.push({ texto: `Si pidiera primero ${nombreColegio(datos, c2)}`, cambio: { colegios: [c2, c1, ...caso.colegios.slice(2)] } })
    const otro = lista.find((x) => !caso.colegios.includes(x.s))
    if (otro) {
      const ult = caso.colegios[caso.colegios.length - 1]
      const colegios = caso.colegios.length < k ? [...caso.colegios, otro.s] : [...caso.colegios.slice(0, -1), otro.s]
      v.push({ texto: caso.colegios.length < k ? `Si pidiera también ${nombreColegio(datos, otro.s)}` : `Si cambiara ${nombreColegio(datos, ult)} por ${nombreColegio(datos, otro.s)}`,
        cambio: { colegios, hermanoEn: caso.hermanoEn != null && !colegios.includes(caso.hermanoEn) ? null : caso.hermanoEn } })
    }
    return v
  }, [datos, caso, lista, k])
  const llaveCaso = JSON.stringify([caso.lon, caso.lat, caso.vulnerable, caso.hermanoEn, caso.colegios, caso.llegada, supuestos, politica])
  const resVariantes = useDiferido(variantes.map((x) => () => resolverCaso(datos, supuestos, politica, { ...caso, ...x.cambio })), llaveCaso)
  const sugerencias = useMemo(() => {
    if (!res) return []
    const out: { texto: string; efecto: string; cambio: Partial<EstadoCaso>; ganancia: number }[] = []
    variantes.forEach((v, j) => {
      const rv = resVariantes[j]
      if (!rv) return
      const dH = puntaje(res.hoy) - puntaje(rv.hoy), dM = puntaje(res.matricula) - puntaje(rv.matricula)
      if (dH < -0.05 || dM < -0.05 || (dH <= 0.05 && dM <= 0.05)) return
      const efecto = [dH > 0.05 && `${corto(rv.hoy)} hoy`, dM > 0.05 && `${corto(rv.matricula)} con Matrícula+`].filter(Boolean).join(' y ')
      out.push({ texto: v.texto, efecto, cambio: v.cambio, ganancia: Math.max(dH, 0) + Math.max(dM, 0) })
    })
    return out.sort((a, b) => b.ganancia - a.ganancia).slice(0, 3)
  }, [res, variantes, resVariantes])
  const calculando = variantes.length > 0 && resVariantes.length < variantes.length

  // ---------------------------------------------------------------- 1. ¿quién? (personajes)
  if (caso.lon == null) {
    return (
      <div className="panel">
        <header className="panel__cabeza">
          <span className="kicker">Simula una familia</span>
          <h1 className="display">¿A quién le <em>toca</em> qué colegio?</h1>
          <p className="lead">Elige una familia. La sumamos a las {datos.familias.n.toLocaleString('es-CO')} familias y corremos la asignación completa:
            hoy y con Matrícula+.</p>
        </header>
        <div className="personajes">
          {PERSONAJES.map((p, j) => {
            const rr = resEjemplo[j]
            return (
              <button key={p.nombre} className="personaje" disabled={auto} onClick={() => setCaso(casosEjemplo[j])}>
                <span className="personaje__inicial" aria-hidden>{p.nombre[0]}</span>
                <span className="personaje__texto">
                  <span><b>{p.nombre}</b> <span className="personaje__loc">· {p.localidad}</span></span>
                  <small>{p.rasgos.join(' · ')}</small>
                </span>
                <span className="personaje__avance" aria-live="polite">
                  {rr ? <><Insignia x={rr.hoy} /><i>→</i><Insignia x={rr.matricula} /></> : <span className="personaje__calc">…</span>}
                </span>
              </button>
            )
          })}
        </div>
        <div className="grupo caso-propia">
          <div className="grupo__titulo"><b>O crea la tuya</b><span>toca el mapa o elige una localidad</span></div>
          <div className="chips">
            {datos.localidades.map((l) => (
              <button key={l} className="chip chip--chico" disabled={auto} onClick={() => {
                const f = familiasDe(datos, l)
                const i = f[Math.floor(f.length / 2)]
                ubicar(datos.familias.lon[i], datos.familias.lat[i])
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------- 2. el caso
  const v = res ? veredicto(res) : null
  const transicion = quieto ? { duration: 0 } : { duration: 0.32, ease: [0.2, 0.7, 0.2, 1] as const }
  const lado = (c: Cual, x: Destino | undefined) => (
    <button className={`duelo__lado duelo__lado--${c} ${cual === c ? 'duelo__lado--activo' : ''}`} onClick={() => setCual(c)} disabled={auto}
            aria-pressed={cual === c} title="Ver su viaje en el mapa">
      <span className="etiqueta">{c === 'hoy' ? 'Hoy' : 'Matrícula+'}{cual === c && <span className="duelo__ojo"> · en el mapa</span>}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={x ? `${x.sede}-${x.opcion}-${x.reubicado}` : 'nada'} className="duelo__destino"
                     initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={transicion}>
          <b>{!x ? 'Elige un colegio' : x.sede >= 0 ? nombreColegio(datos, x.sede) : 'Sin colegio'}</b>
          {x && <Insignia x={x} largo />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
  // Estado de cada colegio pedido: ✕ si la rechazó, ✓ si quedó (hoy y con Matrícula+)
  const marca = (x: Destino | undefined, o: number) => !x ? null : x.opcion === o ? 'si' : x.opcion < 0 || o < x.opcion ? 'no' : null
  const razon = (s: number) => res?.razones.find((x) => x.sede === s)

  return (
    <div className="panel panel--caso">
      <div className="duelo">
        <div className="duelo__cabeza">
          <span className="kicker">{caso.quien ? `La familia de ${caso.quien}` : 'Simula una familia'}</span>
          <button className="boton-texto" onClick={() => setCaso(casoInicial())} disabled={auto}>← Otra familia</button>
        </div>
        <div className="duelo__lados">
          {lado('hoy', res?.hoy)}
          <span className="duelo__vs" aria-hidden>vs</span>
          {lado('matricula', res?.matricula)}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={v?.texto ?? 'nada'} className={`duelo__veredicto duelo__veredicto--${v?.tono ?? 'igual'}`}
                    initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={transicion}>
            {v ? v.texto : `Elige hasta ${k} colegios en el mapa o en la lista`}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="grupo">
        <div className="grupo__titulo"><b>Sus colegios, en orden</b><span>hasta {k} · ✓ quedó · ✕ no</span></div>
        <div className="caso-lista">
          {lista.map(({ s, d }) => {
            const o = caso.colegios.indexOf(s)
            const h = o >= 0 ? marca(res?.hoy, o) : null, m = o >= 0 ? marca(res?.matricula, o) : null
            const rz = m === 'no' ? razon(s) : undefined
            return (
              <button key={s} className={`caso-colegio ${o >= 0 ? 'caso-colegio--elegido' : ''}`} onClick={() => setCaso(alternarColegio(caso, s, k))} disabled={auto}>
                <span className="caso-colegio__n">{o >= 0 ? o + 1 : ''}</span>
                <span className="caso-colegio__nombre">
                  {nombreColegio(datos, s)}{caso.hermanoEn === s && <> · <b>hermano aquí</b></>}
                  {rz && <small className="caso-colegio__razon">Matrícula+: {rz.motivo === 'lleno' ? 'no tiene cupos para nuevos'
                    : <>lleno con familias de más prioridad{rz.ultimaDist != null && <> (la última vive a {decimal(rz.ultimaDist)} km)</>}</>}</small>}
                </span>
                <span className="caso-colegio__marcas">
                  {o >= 0 && <><Marca quien="Hoy" m={h} /><Marca quien="M+" m={m} /></>}
                  <small>{decimal(d)} km</small>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {(sugerencias.length > 0 || calculando) && (
        <div className="grupo">
          <div className="grupo__titulo"><b>¿Qué cambiaría su suerte?</b>{calculando && <span className="calculando">calculando…</span>}</div>
          <div className="sugerencias">
            <AnimatePresence initial={false}>
              {sugerencias.map((x) => (
                <motion.button key={x.texto} className="sugerencia" onClick={() => set(x.cambio)} disabled={auto} layout={!quieto}
                               initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={transicion}>
                  <span>{x.texto}</span><b>→ {x.efecto}</b>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      {!calculando && sugerencias.length === 0 && variantes.length > 0 && (
        <p className="nota">Ningún cambio sencillo (llegar antes, hermano, otros colegios) le mejora el resultado.</p>
      )}

      <div className="caso-controles">
        <div className="grupo">
          <div className="grupo__titulo"><b>¿Cuándo llega a pedir cupo?</b><span>solo importa hoy</span></div>
          <div className="segmentos">
            {LLEGADAS.map((l) => (
              <button key={l.v} className={`segmento ${caso.llegada === l.v ? 'segmento--activo' : ''}`} onClick={() => set({ llegada: l.v })} disabled={auto}>{l.t}</button>
            ))}
          </div>
        </div>
        <div className="fila fila--entre">
          <span className="nota">¿La SED la registra como vulnerable? <b>Solo importa con Matrícula+</b></span>
          <button className={`chip ${caso.vulnerable ? 'chip--activo' : ''}`} onClick={() => set({ vulnerable: !caso.vulnerable })} disabled={auto}>
            {caso.vulnerable ? '✓ ' : ''}Vulnerable
          </button>
        </div>
        <div className="grupo">
          <div className="grupo__titulo"><b>¿Ya tiene un hermano en uno?</b><span>solo importa con Matrícula+</span></div>
          <div className="chips">
            <button className={`chip chip--chico ${caso.hermanoEn == null ? 'chip--activo' : ''}`} onClick={() => set({ hermanoEn: null })} disabled={auto}>No</button>
            {caso.colegios.map((s, o) => (
              <button key={s} className={`chip chip--chico chip--violeta ${caso.hermanoEn === s ? 'chip--activo' : ''}`} onClick={() => set({ hermanoEn: s })} disabled={auto}>
                En su {o + 1}.ª
              </button>
            ))}
          </div>
        </div>
        <p className="nota">Toca otro punto del mapa para mudar a la familia. Hoy depende de cuándo llega; con Matrícula+, de su prioridad:
          cercanía, hermanos y vulnerabilidad.</p>
      </div>
    </div>
  )
}

/** Estado de un resultado: n.ª opción · km, reubicada o sin cupo. */
function Insignia({ x, largo = false }: { x: Destino; largo?: boolean }) {
  return x.opcion >= 0
    ? <span className={`estado ${x.opcion === 0 ? 'estado--primera' : 'estado--otra'}`}>{x.opcion + 1}.ª opción{largo && ` · ${decimal(x.dist)} km`}</span>
    : x.reubicado ? <span className="estado estado--reub">Reubicada{largo && ` a ${decimal(x.dist)} km`}</span>
      : <span className="estado estado--sin">Sin cupo{largo && ' cercano'}</span>
}

/** ✓ / ✕ de un colegio pedido, con quién lo decide (Hoy o M+). */
function Marca({ quien, m }: { quien: string; m: 'si' | 'no' | null }) {
  if (!m) return <span className="marca marca--nada" title={`${quien}: no llegó a pedirlo`}>{quien}</span>
  return <span className={`marca marca--${m}`} title={`${quien}: ${m === 'si' ? 'quedó aquí' : 'no quedó'}`}>{m === 'si' ? '✓' : '✕'} {quien}</span>
}
