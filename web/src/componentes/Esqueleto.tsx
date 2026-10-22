import type { CSSProperties } from 'react'
import { APP_NAME } from '../config'

// Familias (puntos) que llegan en espiral al colegio (el icono M+): ángulo, retraso y color.
// Los mismos de index.html, para que no haya salto al montar.
const PUNTOS: [string, string, string][] = [
  ['0deg', '0s', '#5a44dd'], ['51deg', '0.4s', '#505b7d'], ['103deg', '0.8s', '#7bc689'], ['154deg', '1.2s', '#aca2ee'],
  ['206deg', '1.6s', '#7bc689'], ['257deg', '2s', '#5a44dd'], ['309deg', '2.4s', '#505b7d'], ['26deg', '1.4s', '#aca2ee'],
  ['129deg', '0.2s', '#5a44dd'], ['231deg', '1s', '#7bc689'], ['334deg', '1.8s', '#7bc689'], ['180deg', '2.6s', '#5a44dd'],
]

/**
 * Pantalla de carga con el logo del proyecto (Matrícula+ por defecto). Es la misma que trae index.html antes de que llegue
 * el JavaScript: usa sus clases .esq* (con modo oscuro del sistema), así no hay salto al montar.
 * Si la carga falla, muestra el error y un botón para reintentar.
 */
export default function Esqueleto({ error, reintentar, nombre = APP_NAME, variante = 'tinta', estado = 'Cargando datos de Bogotá' }: {
  error?: string | null; reintentar?: () => void
  /** marca del proyecto que carga (por defecto Matrícula+) y variante de su icono */
  nombre?: string; variante?: 'tinta' | 'violeta'; estado?: string
}) {
  const termina = nombre.endsWith('+')
  return (
    <div className="esq" role="status" aria-live="polite" aria-label={error ? 'Error al cargar' : `Cargando ${nombre}`}>
      <div className="esq__escena" aria-hidden>
        <span className="esq__orbita" /><span className="esq__orbita esq__orbita--2" />
        {!error && PUNTOS.map(([a, d, c], i) => (
          <i key={i} className="esq__p" style={{ '--a': a, '--d': d, '--c': c } as CSSProperties} />
        ))}
        <svg className={`esq__icono ${variante === 'violeta' ? 'esq__icono--violeta' : ''}`} viewBox="0 0 100 100">
          <rect width="100" height="100" rx="21" />
          <text x="45" y="75" textAnchor="middle">M</text>
          <path d="M75.3 16.6V32M67.6 24.3H83" />
        </svg>
      </div>
      <div className="esq__nombre">
        {termina ? nombre.slice(0, -1) : nombre}
        {termina && (
          <svg viewBox="0 0 7.2 7.2" aria-hidden>
            <path d="M3.6 1.3V5.9M1.3 3.6H5.9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        )}
      </div>
      {error ? (
        <div className="esq__error">
          <b>No pudimos cargar los datos.</b>
          <span>{error}</span>
          {reintentar && <button className="boton boton--violeta" onClick={reintentar}>Reintentar</button>}
        </div>
      ) : (
        <div className="esq__estado"><span className="esq__carga"><i /><i /><i /></span><span>{estado}</span></div>
      )}
    </div>
  )
}
