import { useMemo } from 'react'
import { decimal, entero } from '../datos'
import { metricasDe } from '../estado'
import { kicker, type PropsCapitulo } from './tipos'

/**
 * 01 — El problema, en vivo. Sin localidad: el mapa de Bogotá y la cifra. Con localidad:
 * así se asigna hoy (orden de llegada) y luego la reubicación de quienes no cupieron.
 */
export default function Problema({ datos, r, modo, supuestos, localidad, elegirLocalidad, ir, terminado, repetir }: PropsCapitulo) {
  const p = datos.indice.parametros as { cupos_nuevos_total: number; demanda_nuevos_total: number }
  const por100 = Math.round((100 * p.cupos_nuevos_total) / p.demanda_nuevos_total)
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
          <h1 className="display">Faltan cupos <em>donde viven</em> los niños</h1>
          <p className="lead">Hoy los cupos se reparten por orden de llegada: <span className="acento">quien llega primero, elige primero.</span>
            Así, <b>{decimal(r.bogota.hoy.pctFueraDeOpciones)}%</b> de los niños nuevos no queda en ninguno de sus {supuestos.opciones} colegios.</p>
        </header>
        <div className="datos-linea">
          <div><b>{entero(p.demanda_nuevos_total)}</b><span>niños nuevos piden cupo</span></div>
          <div><b>{entero(p.cupos_nuevos_total)}</b><span>cupos para nuevos</span></div>
          <div><b>{por100}</b><span>cupos por cada 100 que piden</span></div>
        </div>
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
        <p className="lead">Las familias llegan una por una y toman el primer colegio de su lista con cupo.
          Quien llega tarde encuentra todo lleno, aunque viva al lado.</p>
      </header>
      <div className="datos-linea">
        <div><b>{entero(loc.piden)}</b><span>niños nuevos viven aquí</span></div>
        <div><b>{entero(loc.cupos)}</b><span>cupos en la localidad</span></div>
        <div><b>{loc.por100}</b><span>cupos por cada 100</span></div>
      </div>
      {terminado ? (
        <div className="tarjeta tarjeta--tinta">
          <span className="etiqueta">Resultado de hoy en {localidad}</span>
          <div className="gran-cifra">
            <span className="gran-cifra__n" style={{ color: 'var(--naranja)' }}>{entero(hoy.fueraDeOpciones)}</span>
            <span className="gran-cifra__t" style={{ color: '#c7d7ec' }}>niños fuera de sus opciones ({decimal(hoy.pctFueraDeOpciones)}%):
              {' '}{entero(hoy.fueraDeOpciones - hoy.sinCupo)} reubicados lejos y {entero(hoy.sinCupo)} sin ningún cupo cercano.</span>
          </div>
        </div>
      ) : (
        <p className="nota">Cada punto del mapa es una familia sintética ({epf} niños). Toca uno para ver su historia.</p>
      )}
      {!auto && (
        <div className="panel__pie">
          <button className={`boton boton--violeta boton--ancho ${terminado ? 'boton--latir' : ''}`} onClick={() => ir('accion')}>
            ¿Y si asignamos distinto? →
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
