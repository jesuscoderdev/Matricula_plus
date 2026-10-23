import { decimal, entero } from '../datos'
import { supuestosIniciales } from '../estado'
import type { Supuestos } from '../motor'
import Comparacion from '../componentes/Comparacion'
import { useOpcionesColegio } from '../colegioNuevo'
import { kicker, type PropsCapitulo } from './tipos'

interface Control {
  k: keyof Supuestos; nombre: string; min: number; max: number; paso: number; fmt: (v: number) => string; ayuda: string
  /** palanca de Acción sin la cual el supuesto no cambia nada */
  requiere?: 'colegio' | 'jornada'
}
const CONTROLES: Control[] = [
  { k: 'pctVulnerable', nombre: 'Familias vulnerables', min: 0.1, max: 0.5, paso: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, ayuda: 'Tienen prioridad extra según el peso de vulnerabilidad.' },
  { k: 'pctHermano', nombre: 'Con un hermano ya matriculado', min: 0, max: 0.3, paso: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, ayuda: 'El hermano estudia en uno de los colegios cercanos.' },
  { k: 'cuposColegioNuevo', nombre: 'Cupos del colegio nuevo', min: 600, max: 2400, paso: 300, fmt: entero, ayuda: 'Cambia los cupos del colegio nuevo que elegiste en Acción.', requiere: 'colegio' },
  { k: 'radioReubicacionKm', nombre: 'Distancia máxima de reubicación', min: 1, max: 5, paso: 0.5, fmt: (v) => `${decimal(v)} km`, ayuda: 'Hasta dónde se busca un cupo libre para quien no cupo.' },
  { k: 'reduccionJornada', nombre: 'Cupos que cuesta la jornada única', min: 0.05, max: 0.2, paso: 0.01, fmt: (v) => `−${Math.round(v * 100)}%`, ayuda: 'Cuántos cupos se pierden con la jornada única.', requiere: 'jornada' },
  { k: 'umbralViajeLargoKm', nombre: 'Qué es un viaje largo', min: 1, max: 3, paso: 0.5, fmt: (v) => `> ${decimal(v)} km`, ayuda: 'Para la métrica de viajes largos.' },
]

/** 04 — Supuestos: todo lo que asumimos, a la vista y editable. Cada cambio vuelve a simular. */
export default function Laboratorio({ datos, r, modo, supuestos, cambiarSupuestos, restaurarSupuestos, palancas, cambiarPalancas, localidad, ir }: PropsCapitulo) {
  const auto = modo === 'auto'
  const ini = supuestosIniciales(datos)
  const editados = (Object.keys(ini) as (keyof Supuestos)[]).some((k) => supuestos[k] !== ini[k])
  const s = datos.indice.supuestos
  const controles = modo === 'escritorio' ? CONTROLES : CONTROLES.slice(0, 4)
  // Sin su palanca, el supuesto no mueve ningún resultado: se avisa y se ofrece activarla
  // El colegio que más rinde para la localidad elegida (o el mejor proyecto SED para Bogotá)
  const opcionesColegio = useOpcionesColegio(datos, supuestos, palancas.pesos, palancas.jornadaUnica, localidad)
  const mejorColegio = opcionesColegio?.reduce((a, b) => (b.ninos > a.ninos ? b : a), opcionesColegio[0])
  const proyecto = datos.indice.colegio_nuevo[0]
  const inactivo = (c: Control) =>
    (c.requiere === 'colegio' && !palancas.colegioNuevo) || (c.requiere === 'jornada' && !palancas.jornadaUnica)
  const activar = (c: Control) => cambiarPalancas(c.requiere === 'colegio'
    ? { colegioNuevo: mejorColegio?.colegio ?? { clave: proyecto.clave, lon: proyecto.lon, lat: proyecto.lat } }
    : { jornadaUnica: true })
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('laboratorio')}</span>
        <h1 className="display">Lo que <em>supusimos</em>, y puedes cambiar</h1>
        <p className="lead">Es una simulación para comparar reglas, no una predicción. Mueve un supuesto y todo se vuelve a calcular.</p>
      </header>
      <div className="grupo">
        {controles.map((c) => (
          <div key={c.k} className={`deslizador ${supuestos[c.k] !== ini[c.k] ? 'deslizador--cambiado' : ''}`}>
            <label htmlFor={`sup-${c.k}`}>{c.nombre}</label>
            <output>{c.fmt(supuestos[c.k])}</output>
            <input id={`sup-${c.k}`} type="range" min={c.min} max={c.max} step={c.paso} value={supuestos[c.k]} disabled={auto}
                   onChange={(e) => cambiarSupuestos({ [c.k]: +e.target.value })} />
            {inactivo(c)
              ? <small>{c.requiere === 'colegio' ? 'No hay colegio nuevo: este supuesto no cambia nada. ' : 'Sin jornada única: este supuesto no cambia nada. '}
                  {!auto && <button className="boton-texto" onClick={() => activar(c)}>
                    {c.requiere === 'colegio' ? `Agregar el colegio en ${mejorColegio?.etiqueta ?? proyecto.etiqueta}` : 'Activar la jornada única'}</button>}</small>
              : modo === 'escritorio' && <small>{c.ayuda}</small>}
          </div>
        ))}
      </div>
      <Comparacion hoy={r.bogota.hoy} pol={r.bogota.pol} s={supuestos} solo={modo === 'escritorio'
        ? ['pctFueraDeOpciones', 'pctSinCupo', 'pctVulnerablesFuera', 'pctViajeLargo']
        : ['pctFueraDeOpciones', 'pctSinCupo', 'pctVulnerablesFuera']} />
      {modo === 'escritorio' && (
        <ul className="lista-supuestos">
          <li>{s.familias}</li><li>{s.cupos}</li><li>{s.distancia}</li><li>{s.corte}</li>
        </ul>
      )}
      {!auto && (
        <div className="panel__pie">
          <button className="boton boton--violeta boton--ancho" onClick={() => ir('metodo')}>Cómo lo hicimos →</button>
          {editados && <button className="boton-texto" onClick={restaurarSupuestos}>↺ Volver a los supuestos originales</button>}
        </div>
      )}
    </div>
  )
}
