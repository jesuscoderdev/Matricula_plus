import type { ReactNode } from 'react'

export interface Opcion<T extends string> {
  valor: T
  etiqueta: ReactNode
  detalle?: ReactNode
}

/** Grupo de botones grandes de selección única (≥ 64 px en el tótem). */
export function Opciones<T extends string>({ titulo, opciones, valor, cambiar, columnas = 3 }: {
  titulo: ReactNode
  opciones: Opcion<T>[]
  valor: T
  cambiar: (v: T) => void
  columnas?: number
}) {
  return (
    <fieldset className="control">
      <legend className="control__titulo">{titulo}</legend>
      <div className="opciones" style={{ gridTemplateColumns: `repeat(${columnas}, 1fr)` }} role="radiogroup">
        {opciones.map((o) => (
          <button
            key={o.valor}
            role="radio"
            aria-checked={o.valor === valor}
            className={`opcion ${o.valor === valor ? 'opcion--activa' : ''}`}
            onClick={() => cambiar(o.valor)}
          >
            <span className="opcion__marca" aria-hidden="true">{o.valor === valor ? '●' : '○'}</span>
            <span className="opcion__etiqueta">{o.etiqueta}</span>
            {o.detalle && <span className="opcion__detalle">{o.detalle}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** Interruptor grande con estado escrito ("Sí" / "No"), no solo por color. */
export function Interruptor({ titulo, detalle, activo, cambiar }: {
  titulo: ReactNode
  detalle?: ReactNode
  activo: boolean
  cambiar: (v: boolean) => void
}) {
  return (
    <button className={`interruptor ${activo ? 'interruptor--activo' : ''}`} role="switch" aria-checked={activo}
            onClick={() => cambiar(!activo)}>
      <span className="interruptor__textos">
        <span className="control__titulo">{titulo}</span>
        {detalle && <span className="opcion__detalle">{detalle}</span>}
      </span>
      <span className="interruptor__pista" aria-hidden="true"><span className="interruptor__bola" /></span>
      <span className="interruptor__estado">{activo ? 'Sí' : 'No'}</span>
    </button>
  )
}
