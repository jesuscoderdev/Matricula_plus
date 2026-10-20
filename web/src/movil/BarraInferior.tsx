import type { ReactNode } from 'react'

export type Pestana = 'recorrido' | 'localidad' | 'agendar'

const PESTANAS: { id: Pestana; etiqueta: string; icono: ReactNode }[] = [
  {
    id: 'recorrido', etiqueta: 'Recorrido',
    icono: <path d="M8 5.5v13l11-6.5z" />,
  },
  {
    id: 'localidad', etiqueta: 'Mi localidad',
    icono: <path d="M12 2.5a7 7 0 0 0-7 7c0 5.2 7 12 7 12s7-6.8 7-12a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />,
  },
  {
    id: 'agendar', etiqueta: 'Agendar',
    icono: <path d="M7 2.5v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-2v-2h-2v2H9v-2zM5 9.5h14v10H5z" />,
  },
]

/** Navegación inferior del modo celular. */
export default function BarraInferior({ actual, cambiar }: { actual: Pestana; cambiar: (p: Pestana) => void }) {
  return (
    <nav className="barra">
      {PESTANAS.map((p) => (
        <button key={p.id} className={`barra__item ${actual === p.id ? 'barra__item--activo' : ''}`} onClick={() => cambiar(p.id)}
                aria-current={actual === p.id ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{p.icono}</svg>
          <span>{p.etiqueta}</span>
        </button>
      ))}
    </nav>
  )
}
