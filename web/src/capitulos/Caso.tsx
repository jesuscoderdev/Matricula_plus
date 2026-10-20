import { useMemo } from 'react'
import { decimal } from '../datos'
import { familiasDe, nombreColegio } from '../estado'
import { distanciaKm, simularCaso, type ResultadoCaso } from '../motor'
import type { PropsCapitulo } from './tipos'

export interface EstadoCaso {
  lon: number | null
  lat: number | null
  ninos: number
  vulnerable: boolean
  hermanoEn: number | null
  colegios: number[]
  llegada: number
}
export const casoInicial = (): EstadoCaso => ({ lon: null, lat: null, ninos: 1, vulnerable: false, hermanoEn: null, colegios: [], llegada: 0.5 })

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

export interface PropsCaso extends PropsCapitulo {
  caso: EstadoCaso
  setCaso: (c: EstadoCaso) => void
  ubicar: (lon: number, lat: number) => void
}

const LLEGADAS = [{ v: 0.05, t: 'De primeras' }, { v: 0.5, t: 'A mitad' }, { v: 0.95, t: 'De últimas' }]

/**
 * Simula una familia: dónde vive, cuántos niños, si es vulnerable, si tiene un hermano en un
 * colegio, qué colegios pide y cuándo llega. Se agrega a las 15.896 familias y se corre todo.
 */
export default function Caso({ datos, r, modo, supuestos, caso, setCaso, ubicar }: PropsCaso) {
  const set = (c: Partial<EstadoCaso>) => setCaso({ ...caso, ...c })
  const k = supuestos.opciones
  const pos = r.pol.pos
  const lista = useMemo(() => (caso.lon == null ? [] : cercanos(pos, caso.lon, caso.lat!, 8)), [pos, caso.lon, caso.lat])
  const res = useMemo<ResultadoCaso | null>(() => {
    if (caso.lon == null || !caso.colegios.length) return null
    return simularCaso(datos.familias, datos, supuestos, r.pol.politica, {
      lon: caso.lon, lat: caso.lat!, vulnerable: caso.vulnerable, hermanoEn: caso.hermanoEn, colegios: caso.colegios, llegada: caso.llegada,
    })
  }, [datos, supuestos, r.pol.politica, caso])
  const auto = modo === 'auto'

  const alternar = (s: number) => setCaso(alternarColegio(caso, s, k))
  const ninos = caso.ninos === 1 ? 'el niño' : `los ${caso.ninos} niños`

  if (caso.lon == null) {
    return (
      <div className="panel">
        <header className="panel__cabeza">
          <span className="kicker">Simula una familia</span>
          <h1 className="display">¿Dónde <em>vive</em> la familia?</h1>
          <p className="lead">Toca en el mapa el lugar de su casa, o elige una localidad. La sumamos a las {datos.familias.n.toLocaleString('es-CO')} familias
            y corremos la asignación completa: hoy y con Matrícula+.</p>
        </header>
        <div className="chips">
          {datos.localidades.map((l) => (
            <button key={l} className="chip" disabled={auto} onClick={() => {
              const f = familiasDe(datos, l)
              const i = f[Math.floor(f.length / 2)]
              ubicar(datos.familias.lon[i], datos.familias.lat[i])
            }}>{l}</button>
          ))}
        </div>
      </div>
    )
  }

  const estado = (x: ResultadoCaso['hoy']) => x.opcion >= 0
    ? <span className={`estado ${x.opcion === 0 ? 'estado--primera' : 'estado--otra'}`}>{x.opcion + 1}.ª opción · {decimal(x.dist)} km</span>
    : x.reubicado ? <span className="estado estado--reub">Reubicada a {decimal(x.dist)} km</span>
      : <span className="estado estado--sin">Sin cupo cercano</span>
  const destino = (x: ResultadoCaso['hoy']) => (x.sede >= 0 ? nombreColegio(datos, x.sede) : 'Sin colegio')

  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">Simula una familia</span>
        <h1 className="display display--m">¿Dónde quedan <em>{ninos}</em>?</h1>
        <p className="nota">Toca otro punto del mapa para mudar a la familia. Elige hasta {k} colegios en orden de preferencia.</p>
      </header>

      <div className="fila fila--entre">
        <div className="contador-ninos" aria-label="Niños en la familia">
          <button onClick={() => set({ ninos: Math.max(1, caso.ninos - 1) })} disabled={auto} aria-label="Menos">−</button>
          <output>{caso.ninos}</output>
          <button onClick={() => set({ ninos: Math.min(5, caso.ninos + 1) })} disabled={auto} aria-label="Más">+</button>
          <span className="nota">{caso.ninos === 1 ? 'niño' : 'niños, se asignan juntos'}</span>
        </div>
        <button className={`chip ${caso.vulnerable ? 'chip--activo' : ''}`} onClick={() => set({ vulnerable: !caso.vulnerable })} disabled={auto}>
          {caso.vulnerable ? '✓ ' : ''}Familia vulnerable
        </button>
      </div>

      <div className="grupo">
        <div className="grupo__titulo"><b>Sus colegios</b><span>los {lista.length} más cercanos</span></div>
        <div className="caso-lista">
          {lista.map(({ s, d }) => {
            const o = caso.colegios.indexOf(s)
            return (
              <button key={s} className={`caso-colegio ${o >= 0 ? 'caso-colegio--elegido' : ''}`} onClick={() => alternar(s)} disabled={auto}>
                <span className="caso-colegio__n">{o >= 0 ? o + 1 : ''}</span>
                <span>{nombreColegio(datos, s)}{caso.hermanoEn === s && <> · <b>hermano aquí</b></>}</span>
                <small>{decimal(d)} km</small>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grupo">
        <div className="grupo__titulo"><b>¿Ya tiene un hermano en uno de ellos?</b></div>
        <div className="chips">
          <button className={`chip ${caso.hermanoEn == null ? 'chip--activo' : ''}`} onClick={() => set({ hermanoEn: null })} disabled={auto}>No</button>
          {caso.colegios.map((s, o) => (
            <button key={s} className={`chip chip--violeta ${caso.hermanoEn === s ? 'chip--activo' : ''}`} onClick={() => set({ hermanoEn: s })} disabled={auto}>
              En su {o + 1}.ª opción
            </button>
          ))}
        </div>
      </div>

      <div className="grupo">
        <div className="grupo__titulo"><b>¿Cuándo llega a pedir cupo?</b><span>solo importa hoy</span></div>
        <div className="segmentos">
          {LLEGADAS.map((l) => (
            <button key={l.v} className={`segmento ${caso.llegada === l.v ? 'segmento--activo' : ''}`} onClick={() => set({ llegada: l.v })} disabled={auto}>{l.t}</button>
          ))}
        </div>
      </div>

      {res && (
        <>
          <div className="caso-resultado">
            <div className="tarjeta"><span className="etiqueta">Hoy</span><b>{destino(res.hoy)}</b>{estado(res.hoy)}</div>
            <div className="tarjeta tarjeta--violeta"><span className="etiqueta" style={{ color: 'var(--violeta-osc)' }}>Matrícula+</span>
              <b>{destino(res.matricula)}</b>{estado(res.matricula)}</div>
          </div>
          {res.razones.length > 0 && (
            <ul className="lista-supuestos">
              {res.razones.map((x) => (
                <li key={x.sede}>No quedó en <b>{nombreColegio(datos, x.sede)}</b>: {x.motivo === 'lleno'
                  ? 'no tiene cupos para nuevos.'
                  : <>se llenó con familias de más prioridad{x.ultimaDist != null && <> (la última admitida vive a {decimal(x.ultimaDist)} km)</>}.</>}</li>
              ))}
            </ul>
          )}
          <p className="nota">Hoy depende de cuándo llega; con Matrícula+, de su prioridad: cercanía, hermanos y vulnerabilidad.</p>
        </>
      )}
    </div>
  )
}
