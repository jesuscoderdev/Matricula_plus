import { useMemo } from 'react'
import { decimal, entero } from '../datos'
import { metricasDe } from '../estado'
import { kicker, type PropsCapitulo } from './tipos'

/**
 * 01 — El problema, en vivo. Sin localidad: el mapa de Bogotá y la cifra. Con localidad:
 * así se asigna hoy (orden de llegada) y luego la reubicación de quienes no cupieron.
 */
export default function Problema({ datos, r, modo, supuestos, localidad, elegirLocalidad, ir, terminado, repetir }: PropsCapitulo) {
  const p = datos.indice.parametros as { demanda_nuevos_total: number; deficit_sed: number; upz_insuficientes_sed: number }
  const epf = datos.familias.estudiantes_por_familia
  const loc = useMemo(() => {
    if (!localidad) return null
    const upz = datos.upz.features.filter((f) => f.properties.localidad === localidad).map((f) => f.properties)
    const m = metricasDe(datos, r, supuestos, localidad)
    const cupos = upz.reduce((a, u) => a + u.cupos, 0)
    return { m, piden: m.hoy.estudiantes, cupos, por100: Math.round((100 * cupos) / Math.max(1, m.hoy.estudiantes)) }
  }, [datos, r, supuestos, localidad])
  const auto = modo === 'auto'

  if (!localidad || !loc) {
    return (
      <div className="panel">
        <header className="panel__cabeza">
          <span className="kicker">{kicker('problema')}</span>
          <h1 className="display">Los cupos no están <em>donde viven</em> los niños</h1>
          <p className="lead">Hoy, en la fase general, cada familia toma el cupo por orden de llegada: <span className="acento">quien llega primero, elige primero.</span>
            {' '}En la simulación, <b>{decimal(r.bogota.hoy.pctFueraDeOpciones)}%</b> de los niños nuevos no queda en ninguno de sus {supuestos.opciones} colegios.</p>
        </header>
        <div className="datos-linea">
          <div><b>{entero(p.demanda_nuevos_total)}</b><span>niños nuevos pidieron cupo en 2024</span></div>
          <div><b>{entero(p.deficit_sed)}</b><span>cupos de déficit</span></div>
          <div><b>{p.upz_insuficientes_sed}</b><span>UPZ con insuficiencia de cupos</span></div>
        </div>
        <small className="nota">Fuente: Estudio de insuficiencia y limitaciones, Secretaría de Educación del Distrito, 2025.</small>
        <div className="grupo">
          <div className="grupo__titulo"><b>Elige una localidad para verlo en acción</b><span>o tócala en el mapa</span></div>
          <div className="chips">
            {datos.localidades.map((l) => <button key={l} className="chip" onClick={() => elegirLocalidad(l)} disabled={auto}>{l}</button>)}
          </div>
        </div>
      </div>
    )
  }

  const { hoy } = loc.m
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('problema', localidad)}</span>
        <h1 className="display">Así se asigna <em>hoy</em> en {localidad}</h1>
        <p className="lead">Cada familia pide hasta {supuestos.opciones} colegios cercanos. Hoy llegan una por una y toman el primero
          de su lista con cupo: quien llega tarde encuentra todo lleno, aunque viva al lado.</p>
      </header>
      <div className="datos-linea">
        <div><b>{entero(loc.piden)}</b><span>niños nuevos viven aquí</span></div>
        <div><b>{entero(loc.cupos)}</b><span>cupos en la localidad</span></div>
        <div><b>{loc.por100}</b><span>cupos por cada 100 niños</span></div>
      </div>
      {terminado ? (
        <div className="tarjeta tarjeta--tinta">
          <span className="etiqueta">Resultado de hoy en {localidad}</span>
          <div className="gran-cifra">
            <span className="gran-cifra__n" style={{ color: 'var(--naranja)' }}>{entero(hoy.fueraDeOpciones)}</span>
            <span className="gran-cifra__t" style={{ color: '#c7d7ec' }}>niños no entran a ninguno de los colegios que pidieron ({decimal(hoy.pctFueraDeOpciones)}%):
              {' '}{entero(hoy.fueraDeOpciones - hoy.sinCupo)} terminan en otro colegio y {entero(hoy.sinCupo)} se quedan sin ningún cupo cerca.</span>
          </div>
        </div>
      ) : (
        <p className="nota">Cada punto del mapa es una familia simulada ({epf} niños), sin datos personales. Toca uno para ver su historia.</p>
      )}
      {!auto && (
        <div className="panel__pie">
          <button className={`boton boton--violeta boton--ancho ${terminado ? 'boton--latir' : ''}`} onClick={() => ir('accion')}>
            ¿Cómo logramos que más niños tengan colegio? →
          </button>
          <div className="fila fila--entre">
            <button className="boton-texto" onClick={repetir}>↻ Ver de nuevo</button>
            <button className="boton-texto" onClick={() => elegirLocalidad(null)}>Cambiar localidad</button>
          </div>
        </div>
      )}
    </div>
  )
}
