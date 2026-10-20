import type { CSSProperties } from 'react'

// Familias (puntos) que llegan en espiral al colegio (el icono M+): ángulo, retraso y color.
// Los mismos de index.html, para que no haya salto al montar.
const PUNTOS: [string, string, string][] = [
  ['0deg', '0s', '#7f45ee'], ['51deg', '0.4s', '#268484'], ['103deg', '0.8s', '#e0662a'], ['154deg', '1.2s', '#a88cf0'],
  ['206deg', '1.6s', '#8bc68e'], ['257deg', '2s', '#7f45ee'], ['309deg', '2.4s', '#268484'], ['26deg', '1.4s', '#a88cf0'],
  ['129deg', '0.2s', '#7f45ee'], ['231deg', '1s', '#e0662a'], ['334deg', '1.8s', '#8bc68e'], ['180deg', '2.6s', '#7f45ee'],
]

/**
 * Pantalla de carga con el logo Matrícula+. Es la misma que trae index.html antes de que llegue
 * el JavaScript: usa sus clases .esq* (con modo oscuro del sistema), así no hay salto al montar.
 * Si la carga falla, muestra el error y un botón para reintentar.
 */
export default function Esqueleto({ error, reintentar }: { error?: string | null; reintentar?: () => void }) {
  return (
    <div className="esq" role="status" aria-live="polite" aria-label={error ? 'Error al cargar' : 'Cargando Matrícula+'}>
      <div className="esq__escena" aria-hidden>
        <span className="esq__orbita" /><span className="esq__orbita esq__orbita--2" />
        {!error && PUNTOS.map(([a, d, c], i) => (
          <i key={i} className="esq__p" style={{ '--a': a, '--d': d, '--c': c } as CSSProperties} />
        ))}
        <svg className="esq__icono" viewBox="0 0 100 100">
          <rect width="100" height="100" rx="21" />
          <text x="45" y="75" textAnchor="middle">M</text>
          <path d="M75.3 16.6V32M67.6 24.3H83" />
        </svg>
      </div>
      <div className="esq__nombre">
        Matrícula
        <svg viewBox="0 0 7.2 7.2" aria-hidden>
          <path d="M3.6 1.3V5.9M1.3 3.6H5.9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>
      {error ? (
        <div className="esq__error">
          <b>No pudimos cargar los datos.</b>
          <span>{error}</span>
          {reintentar && <button className="boton boton--violeta" onClick={reintentar}>Reintentar</button>}
        </div>
      ) : (
        <div className="esq__estado"><span className="esq__carga"><i /><i /><i /></span><span>Cargando datos de Bogotá</span></div>
      )}
    </div>
  )
}
