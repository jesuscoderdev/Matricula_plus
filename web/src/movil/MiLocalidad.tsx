import { useEffect, useMemo, useRef } from 'react'
import MapaBogota from '../mapa/MapaBogota'
import { conSigno, entero, type Datos } from '../datos'
import Comparacion, { ETIQUETA_ESTADO } from './Comparacion'

interface Props {
  datos: Datos
  localidad: string
  setLocalidad: (l: string) => void
  onVerUpz: (codigo: string) => void
}

/** "Ver mi localidad": selector, mapa de sus UPZ, comparación y lista de UPZ. */
export default function MiLocalidad({ datos, localidad, setLocalidad, onVerUpz }: Props) {
  const nombres = useMemo(() => datos.resumen.localidades.map((l) => l.localidad).sort((a, b) => a.localeCompare(b, 'es')), [datos])
  const loc = datos.resumen.localidades.find((l) => l.localidad === localidad)!
  const upzs = useMemo(
    () => datos.upz.features.map((f) => f.properties).filter((p) => p.localidad === localidad).sort((a, b) => a.balance - b.balance),
    [datos, localidad],
  )

  // Mantiene visible el chip de la localidad elegida
  const chips = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chips.current?.querySelector('.chip--activo')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [localidad])

  return (
    <div className="pantalla">
      <header className="pantalla__cabeza">
        <h1 className="titulo titulo--chico">Ver mi localidad</h1>
        {datos.resumen.fuente === 'sintetica' && <span className="detalle">Simulación con datos sintéticos</span>}
        <div className="chips" ref={chips}>
          {nombres.map((n) => (
            <button key={n} className={`chip ${n === localidad ? 'chip--activo' : ''}`} onClick={() => setLocalidad(n)}>{n}</button>
          ))}
        </div>
      </header>

      <div className="mapa-caja">
        <MapaBogota datos={datos} fase="problema" localidad={localidad} margenArriba={0.02} margenAbajo={0.02}
                    onTocarUpz={onVerUpz} interactivo />
        <div className="mapa-caja__pista">Toca una UPZ para ver el detalle</div>
      </div>

      <section className="bloque">
        <div className="fila-resumen">
          <span className={`etiqueta-estado etiqueta-estado--${loc.estado}`}>{ETIQUETA_ESTADO[loc.estado]}</span>
          <span className="detalle">{entero(loc.demanda)} solicitudes · {entero(loc.oferta)} cupos · balance {conSigno(loc.balance)}</span>
        </div>
        <Comparacion hoy={loc.hoy} mat={loc.matricula} />
      </section>

      <section className="bloque">
        <h2 className="bloque__titulo">UPZ de {localidad}</h2>
        <ul className="lista">
          {upzs.map((u) => (
            <li key={u.codigo}>
              <button className="lista__item" onClick={() => onVerUpz(u.codigo)}>
                <i className={`punto punto--${u.estado === 'equilibrio' ? 'neutro' : u.estado}`} />
                <span className="lista__nombre">{u.nombre}</span>
                <span className={`lista__dato ${u.balance < 0 ? 'texto-deficit' : 'texto-superavit'}`}>{conSigno(u.balance)} cupos</span>
                <span className="lista__flecha">›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
