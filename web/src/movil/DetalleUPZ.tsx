import { useMemo } from 'react'
import MapaBogota from '../mapa/MapaBogota'
import { conSigno, decimal, entero, type Datos } from '../datos'
import Comparacion, { ETIQUETA_ESTADO } from './Comparacion'

interface Props {
  datos: Datos
  codigo: string
  onVolver: () => void
  onVerUpz: (codigo: string) => void
}

/** Detalle de una UPZ: balance, comparación de escenarios y sus colegios. */
export default function DetalleUPZ({ datos, codigo, onVolver, onVerUpz }: Props) {
  const u = datos.upz.features.find((f) => f.properties.codigo === codigo)!.properties
  const colegios = useMemo(
    () => datos.colegios.filter((c) => c.upz === codigo).sort((a, b) => b.cupos - a.cupos),
    [datos, codigo],
  )
  return (
    <div className="pantalla">
      <header className="pantalla__cabeza">
        <button className="volver" onClick={onVolver}>‹ {u.localidad}</button>
        <h1 className="titulo titulo--chico">{u.nombre}</h1>
        <span className={`etiqueta-estado etiqueta-estado--${u.estado}`}>{ETIQUETA_ESTADO[u.estado]}</span>
      </header>

      <div className="mapa-caja mapa-caja--baja">
        <MapaBogota datos={datos} fase="problema" localidad={u.localidad} upzSeleccionada={codigo}
                    margenArriba={0.02} margenAbajo={0.02} onTocarUpz={onVerUpz} interactivo />
      </div>

      <section className="bloque">
        <div className="cifras">
          <div><b>{entero(u.demanda)}</b><span>solicitudes</span></div>
          <div><b>{entero(u.oferta)}</b><span>cupos</span></div>
          <div><b className={u.balance < 0 ? 'texto-deficit' : 'texto-superavit'}>{conSigno(u.balance)}</b><span>balance</span></div>
        </div>
        <Comparacion hoy={datos.hoy.kpis.por_upz[codigo]} mat={datos.matricula.kpis.por_upz[codigo]} />
      </section>

      <section className="bloque">
        <h2 className="bloque__titulo">Colegios oficiales ({colegios.length})</h2>
        {colegios.length === 0 && <div className="vacio">No hay sedes oficiales en esta UPZ.</div>}
        <ul className="lista">
          {colegios.map((c) => (
            <li key={c.id} className="lista__item lista__item--colegio">
              <span className="lista__nombre">{c.nombre}<small>DANE {c.dane} · Saber 11 sim. {decimal(c.calidad)}</small></span>
              <span className="lista__dato">
                {entero(c.cupos)} cupos
                <small>ocupados hoy {entero(c.ocupados_hoy)} · con M+ {entero(c.ocupados_matricula)}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
