export const PASOS = [
  { id: 'problema', etiqueta: 'Problema' },
  { id: 'accion', etiqueta: 'Acción' },
  { id: 'resultado', etiqueta: 'Resultado' },
  { id: 'supuestos', etiqueta: 'Supuestos' },
  { id: 'metodo', etiqueta: 'Método' },
] as const
export type PasoId = (typeof PASOS)[number]['id']

/** Barra de progreso del flujo guiado. Permite volver a un paso ya visitado. */
export default function BarraProgreso({ actual, ir }: { actual: PasoId; ir?: (p: PasoId) => void }) {
  const i = PASOS.findIndex((p) => p.id === actual)
  return (
    <nav className="progreso" aria-label={`Paso ${i + 1} de ${PASOS.length}: ${PASOS[i].etiqueta}`}>
      {PASOS.map((p, k) => (
        <button
          key={p.id}
          className={`progreso__paso ${k < i ? 'progreso__paso--hecho' : ''} ${k === i ? 'progreso__paso--actual' : ''}`}
          onClick={(e) => { e.stopPropagation(); if (k < i) ir?.(p.id) }}
          aria-current={k === i ? 'step' : undefined}
          tabIndex={k < i ? 0 : -1}
        >
          <span className="progreso__barra" />
          <span className="progreso__texto">{k + 1}<span className="progreso__nombre">. {p.etiqueta}</span></span>
        </button>
      ))}
    </nav>
  )
}
