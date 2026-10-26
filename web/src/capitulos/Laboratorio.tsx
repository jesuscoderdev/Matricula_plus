import { useMemo } from 'react'
import { decimal, entero } from '../datos'
import { supuestosIniciales, useResultados } from '../estado'
import type { Supuestos } from '../motor'
import Comparacion from '../componentes/Comparacion'
import { useOpcionesColegio } from '../colegioNuevo'
import { kicker, type PropsCapitulo } from './tipos'

interface Control {
  k: keyof Supuestos; nombre: string; min: number; max: number; paso: number; fmt: (v: number) => string; ayuda: string
  /** palanca de Acción sin la cual el supuesto no cambia nada */
  requiere?: 'colegio' | 'jornada'
}
// Cada supuesto se nombra con la pregunta que responde
const CONTROLES: Control[] = [
  { k: 'pctVulnerable', nombre: '¿Y si hubiera más familias vulnerables?', min: 0.1, max: 0.5, paso: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, ayuda: 'Tienen prioridad extra según el peso de vulnerabilidad.' },
  { k: 'pctHermano', nombre: '¿Y si más niños tuvieran un hermano en el colegio?', min: 0, max: 0.3, paso: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, ayuda: 'El hermano estudia en uno de los colegios cercanos.' },
  { k: 'cuposColegioNuevo', nombre: '¿Y si el colegio nuevo fuera más grande?', min: 600, max: 2400, paso: 300, fmt: entero, ayuda: 'Cambia los cupos del colegio nuevo que elegiste en Acción.', requiere: 'colegio' },
  { k: 'radioReubicacionKm', nombre: '¿Y si se buscara cupo más lejos de casa?', min: 1, max: 5, paso: 0.5, fmt: (v) => `${decimal(v)} km`, ayuda: 'Hasta dónde se busca otro colegio para quien no entró a los suyos.' },
  { k: 'reduccionJornada', nombre: '¿Y si la jornada única costara más cupos?', min: 0.05, max: 0.2, paso: 0.01, fmt: (v) => `−${Math.round(v * 100)}%`, ayuda: 'Cuántos cupos se pierden con la jornada única.', requiere: 'jornada' },
  { k: 'umbralViajeLargoKm', nombre: '¿Desde cuántos km un viaje es largo?', min: 1, max: 3, paso: 0.5, fmt: (v) => `> ${decimal(v)} km`, ayuda: 'Para la cifra de viajes largos.' },
]

/** 04 — Supuestos: todo lo que asumimos, a la vista y editable. Cada cambio vuelve a simular. */
export default function Laboratorio({ datos, r, modo, supuestos, cambiarSupuestos, restaurarSupuestos, palancas, cambiarPalancas, localidad, ir }: PropsCapitulo) {
  const auto = modo === 'auto'
  const ini = useMemo(() => supuestosIniciales(datos), [datos])
  const editados = (Object.keys(ini) as (keyof Supuestos)[]).some((k) => supuestos[k] !== ini[k])
  const s = datos.indice.supuestos
  // Para decir qué cambió: el mismo resultado con los supuestos originales (y las mismas reglas)
  const r0 = useResultados(datos, ini, palancas)
  const antes = r0?.bogota.pol.pctFueraDeOpciones, ahora = r.bogota.pol.pctFueraDeOpciones
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
        <p className="lead">Estos son los supuestos del modelo. Muévelos y mira cómo cambia el resultado: es una simulación para comparar reglas, no una predicción.</p>
      </header>
      {editados && antes !== undefined && (
        <p className="lectura" aria-live="polite">
          {Math.abs(ahora - antes) < 0.3
            ? <>Este cambio <b>casi no mueve el resultado</b>: la conclusión se mantiene ({decimal(ahora)}% de los niños no entra a sus colegios con Matrícula+).</>
            : <>Con tus supuestos, con Matrícula+ no entran a sus colegios <b>{decimal(ahora)}%</b> de los niños en Bogotá
                {' '}({ahora > antes ? 'más' : 'menos'} que el {decimal(antes)}% de los supuestos originales).</>}
        </p>
      )}
      <div className="grupo">
        {controles.map((c) => (
          <div key={c.k} className={`deslizador ${supuestos[c.k] !== ini[c.k] ? 'deslizador--cambiado' : ''}`}>
            <label htmlFor={`sup-${c.k}`}>{c.nombre}</label>
            <output>{c.fmt(supuestos[c.k])}</output>
            <input id={`sup-${c.k}`} type="range" min={c.min} max={c.max} step={c.paso} value={supuestos[c.k]} disabled={auto || inactivo(c)}
                   onChange={(e) => cambiarSupuestos({ [c.k]: +e.target.value })} />
            {inactivo(c)
              ? <small>{c.requiere === 'colegio' ? 'Primero agrega un colegio nuevo. ' : 'Primero activa la jornada única. '}
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
