import { decimal, entero } from '../datos'
import { NIVELES_PESO } from '../estado'
import { useOpcionesColegio, type OpcionColegio } from '../colegioNuevo'
import { kicker, type PropsCapitulo } from './tipos'

export interface PropsAccion extends PropsCapitulo {
  asignado: boolean
  asignar: () => void
  eligiendoPunto: boolean
  setEligiendoPunto: (v: boolean) => void
}

const NOMBRES_PESO = { cercania: 'Cercanía', hermanos: 'Hermanos', vulnerabilidad: 'Vulnerabilidad' } as const
const NIVEL = ['nada', 'poco', 'medio', 'mucho', 'máximo']

/**
 * 02 — La acción: el visitante mueve las palancas de política y ve correr la asignación
 * diferida por rondas en su localidad.
 */
export default function Accion(props: PropsAccion) {
  const { datos, modo, supuestos, cambiarSupuestos, palancas, cambiarPalancas, localidad, ir,
    terminado, asignado, asignar, eligiendoPunto, setEligiendoPunto } = props
  const auto = modo === 'auto'
  const escritorio = modo === 'escritorio'
  const presets = datos.indice.presets
  const nuevo = palancas.colegioNuevo
  const elegirPreset = (clave: string) => cambiarPalancas({ preset: clave, pesos: datos.indice.pesos_presets[clave] })
  const nivelDe = (k: keyof typeof NIVELES_PESO) => {
    const v = palancas.pesos[k]
    const n = NIVELES_PESO[k]
    return n.reduce((mejor, x, i) => (Math.abs(x - v) < Math.abs(n[mejor] - v) ? i : mejor), 0)
  }
  const preset = presets.find((p) => p.clave === palancas.preset)
  // Colegio nuevo: según la localidad elegida (proyectos SED que le ayudan + el mejor lugar)
  const opciones = useOpcionesColegio(datos, supuestos, palancas.pesos, palancas.jornadaUnica, localidad)
  const activa = (o: OpcionColegio) => !!nuevo && (o.real ? nuevo.clave === o.colegio.clave
    : !nuevo.clave && nuevo.lon === o.colegio.lon && nuevo.lat === o.colegio.lat)
  const propio = !!nuevo && !nuevo.clave && !nuevo.etiqueta
  const haySugerido = !!opciones?.some((o) => !o.real)

  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('accion', localidad ?? undefined)}</span>
        <h1 className="display">Ahora, <em>tú</em> decides las reglas</h1>
        <p className="lead">Todas las familias piden a la vez y cada colegio se queda con las de más prioridad. Después, Matrícula+ <b>optimiza</b>:
          busca cambios entre opciones para que quepan más niños en los colegios que pidieron.</p>
      </header>

      <div className="grupo">
        <div className="grupo__titulo"><b>¿A quién priorizar?</b><span>{preset?.descripcion ?? 'Pesos personalizados'}</span></div>
        <div className="segmentos" style={{ gridAutoFlow: 'row', gridTemplateColumns: '1fr 1fr' }}>
          {presets.map((p) => (
            <button key={p.clave} data-proli={`reglas-${p.clave}`} className={`segmento ${palancas.preset === p.clave ? 'segmento--activo' : ''}`}
                    onClick={() => elegirPreset(p.clave)} disabled={auto}>{p.etiqueta}</button>
          ))}
        </div>
        {escritorio && (
          <details>
            <summary className="boton-texto" style={{ listStyle: 'none' }}>Afinar los pesos ▾</summary>
            <div className="grupo" style={{ marginTop: '0.4rem' }}>
              {(Object.keys(NOMBRES_PESO) as (keyof typeof NIVELES_PESO)[]).map((k) => (
                <div key={k} className="deslizador">
                  <label htmlFor={`peso-${k}`}>{NOMBRES_PESO[k]}</label>
                  <output>{NIVEL[nivelDe(k)]}</output>
                  <input id={`peso-${k}`} type="range" min={0} max={4} step={1} value={nivelDe(k)}
                         onChange={(e) => cambiarPalancas({ preset: 'personalizada', pesos: { ...palancas.pesos, [k]: NIVELES_PESO[k][+e.target.value] } })} />
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="grupo">
        <div className="grupo__titulo"><b>Un colegio nuevo</b>
          <span>+{entero(supuestos.cuposColegioNuevo)} cupos · {localidad ? <>dónde más rinde para <b>{localidad}</b></> : 'proyectos reales de la SED'}</span></div>
        <div className="chips">
          <button data-proli="colegio-ninguno" className={`chip ${!nuevo ? 'chip--activo' : ''}`} onClick={() => { cambiarPalancas({ colegioNuevo: null }); setEligiendoPunto(false) }} disabled={auto}>Ninguno</button>
          {opciones ? opciones.map((o) => (
            <button key={o.etiqueta} data-proli={o.real ? `colegio-${o.colegio.clave}` : 'colegio-sugerido'} disabled={auto}
                    className={`chip chip--violeta chip--colegio ${activa(o) ? 'chip--activo' : ''}`}
                    onClick={() => { cambiarPalancas({ colegioNuevo: o.colegio }); setEligiendoPunto(false) }}>
              {o.real ? o.etiqueta : <>★ {o.etiqueta}</>}
              <small>{o.ninos > 0 ? `+${entero(o.ninos)} niños en sus colegios` : 'casi no cambia aquí'}</small>
            </button>
          )) : <span className="chip chip--calculando">Calculando dónde rinde más…</span>}
          {!auto && (
            <button className={`chip chip--violeta ${eligiendoPunto || propio ? 'chip--activo' : ''}`}
                    onClick={() => setEligiendoPunto(!eligiendoPunto)}>
              ⌖ {propio ? 'En tu punto' : 'Ponlo en el mapa'}
            </button>
          )}
        </div>
        {haySugerido && <small className="nota">★ Lugar sugerido por la simulación, no un lote real{opciones!.some((o) => o.real) ? '; los demás son proyectos reales de la SED' : ''}.
          Las cifras son niños de {localidad} que entran a alguno de los colegios que pidieron.</small>}
      </div>

      <button data-proli="jornada" className={`interruptor ${palancas.jornadaUnica ? 'interruptor--on' : ''}`} role="switch" aria-checked={palancas.jornadaUnica}
              onClick={() => cambiarPalancas({ jornadaUnica: !palancas.jornadaUnica })} disabled={auto}>
        <span className="interruptor__texto"><b>Jornada única en todos los colegios</b>
          <span>Más horas de clase, pero −{decimal(100 * supuestos.reduccionJornada)}% de cupos</span></span>
        <span className="interruptor__pista" />
      </button>

      <div className="grupo">
        <div className="grupo__titulo"><b>Colegios que puede pedir cada familia</b><span>hoy: 3</span></div>
        <div className="segmentos">
          {[3, 4, 5].map((n) => (
            <button key={n} className={`segmento ${supuestos.opciones === n ? 'segmento--activo' : ''}`}
                    onClick={() => cambiarSupuestos({ opciones: n })} disabled={auto}>{n} opciones</button>
          ))}
        </div>
      </div>

      {!auto && (
        <div className="panel__pie">
          {terminado && asignado
            ? <button className="boton boton--violeta boton--ancho boton--latir" onClick={() => ir('resultado')}>Ver el resultado →</button>
            : <button className="boton boton--ancho" onClick={asignar} data-proli="asignar">{asignado ? '↻ Asignar de nuevo' : '▶ Asignar con estas reglas'}</button>}
          {terminado && asignado && <button className="boton-texto" onClick={asignar}>↻ Ver la asignación otra vez</button>}
        </div>
      )}
    </div>
  )
}
