import { decimal, entero } from '../datos'
import { NIVELES_PESO } from '../estado'
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

  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('accion', localidad ?? undefined)}</span>
        <h1 className="display">Ahora, <em>tú</em> decides las reglas</h1>
        <p className="lead">Con <b>asignación diferida</b> todas las familias piden a la vez y cada colegio se queda con las de más prioridad.
          El orden de llegada deja de importar.</p>
      </header>

      <div className="grupo">
        <div className="grupo__titulo"><b>¿A quién priorizar?</b><span>{preset?.descripcion ?? 'Pesos personalizados'}</span></div>
        <div className="segmentos" style={{ gridAutoFlow: 'row', gridTemplateColumns: '1fr 1fr' }}>
          {presets.map((p) => (
            <button key={p.clave} className={`segmento ${palancas.preset === p.clave ? 'segmento--activo' : ''}`}
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
        <div className="grupo__titulo"><b>Un colegio nuevo</b><span>+{entero(supuestos.cuposColegioNuevo)} cupos · proyectos reales SED</span></div>
        <div className="chips">
          <button className={`chip ${!nuevo ? 'chip--activo' : ''}`} onClick={() => { cambiarPalancas({ colegioNuevo: null }); setEligiendoPunto(false) }} disabled={auto}>Ninguno</button>
          {datos.indice.colegio_nuevo.map((c) => (
            <button key={c.clave} className={`chip chip--violeta ${nuevo?.clave === c.clave ? 'chip--activo' : ''}`} disabled={auto}
                    onClick={() => { cambiarPalancas({ colegioNuevo: { clave: c.clave, lon: c.lon, lat: c.lat } }); setEligiendoPunto(false) }}>
              {c.etiqueta}
            </button>
          ))}
          {!auto && (
            <button className={`chip chip--violeta ${eligiendoPunto || (nuevo && !nuevo.clave) ? 'chip--activo' : ''}`}
                    onClick={() => setEligiendoPunto(!eligiendoPunto)}>
              ⌖ {nuevo && !nuevo.clave ? 'En tu punto' : 'Ponlo en el mapa'}
            </button>
          )}
        </div>
      </div>

      <button className={`interruptor ${palancas.jornadaUnica ? 'interruptor--on' : ''}`} role="switch" aria-checked={palancas.jornadaUnica}
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
            : <button className="boton boton--ancho" onClick={asignar}>{asignado ? '↻ Asignar de nuevo' : '▶ Asignar con estas reglas'}</button>}
          {terminado && asignado && <button className="boton-texto" onClick={asignar}>↻ Ver la asignación otra vez</button>}
        </div>
      )}
    </div>
  )
}
