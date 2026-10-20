import { NombreAnimado } from './Marca'

/**
 * Esqueleto de carga con la forma de la app (cabecera, mapa y relato). Es el mismo que trae
 * index.html antes de que llegue el JavaScript: usa sus clases .esq*, así no hay salto al montar.
 * Si la carga falla, muestra el error y un botón para reintentar.
 */
export default function Esqueleto({ error, reintentar }: { error?: string | null; reintentar?: () => void }) {
  return (
    <div className="esq" role="status" aria-live="polite" aria-label={error ? 'Error al cargar' : 'Cargando Matrícula+'}>
      <div className="esq__cab">
        <NombreAnimado cargando={!error} />
        <div className="esq__b" style={{ width: '9rem', height: '1.6rem', borderRadius: '99rem' }} />
      </div>
      <div className="esq__cuerpo">
        <div className="esq__mapa"><div className="esq__ciudad" /></div>
        <div className="esq__panel">
          <div className="esq__b" style={{ width: '30%', height: '0.7rem' }} />
          <div className="esq__b" style={{ width: '85%', height: '1.9rem' }} />
          <div className="esq__b" style={{ width: '60%', height: '1.9rem' }} />
          <div className="esq__b" style={{ width: '95%', height: '0.8rem', marginTop: '0.4rem' }} />
          <div className="esq__b" style={{ width: '80%', height: '0.8rem' }} />
          <div className="esq__fila">
            <div className="esq__b" style={{ flex: 1, height: '3.2rem' }} />
            <div className="esq__b" style={{ flex: 1, height: '3.2rem' }} />
            <div className="esq__b" style={{ flex: 1, height: '3.2rem' }} />
          </div>
          {error ? (
            <div className="esq__error">
              <b>No pudimos cargar los datos.</b>
              <span>{error}</span>
              {reintentar && <button className="boton boton--violeta" onClick={reintentar}>Reintentar</button>}
            </div>
          ) : (
            <div className="esq__estado"><span className="esq__punto" /><span>Cargando datos de Bogotá…</span></div>
          )}
        </div>
      </div>
    </div>
  )
}
