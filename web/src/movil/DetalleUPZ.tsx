import { useMemo } from 'react'
import MapaSimulador from '../mapa/MapaSimulador'
import { decimal, entero, type Bbox, type Datos, type Resultado } from '../datos'

interface Props {
  datos: Datos
  codigo: string
  base: Resultado
  actual: Resultado
  onVolver: () => void
  onVerUpz: (codigo: string) => void
}

/** Detalle de una UPZ: cupos de nuevos, demanda de residentes, % sin cupo y sus colegios. */
export default function DetalleUPZ({ datos, codigo, base, actual, onVolver, onVerUpz }: Props) {
  const f = datos.upz.features.find((x) => x.properties.codigo === codigo)!
  const u = f.properties
  const sedes = useMemo(() => datos.colegios.features
    .filter((c) => c.properties.tipo === 'sede' && c.properties.upz === codigo)
    .map((c) => c.properties).sort((a, b) => b.cupos - a.cupos), [datos, codigo])
  const bbox = useMemo<Bbox>(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    const rec = (c: any) => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]); x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1]) } else c.forEach(rec) }
    rec(f.geometry.coordinates)
    const m = 0.01   // margen para ver las UPZ vecinas
    return [[x0 - m, y0 - m], [x1 + m, y1 + m]]
  }, [f])
  const i = datos.posUpz[codigo]
  return (
    <div className="pantalla">
      <header className="pantalla__cabeza">
        <button className="volver" onClick={onVolver}>‹ {u.localidad}</button>
        <h1 className="titulo titulo--chico">{u.nombre}</h1>
        {u.zona_critica && <span className="etiqueta-zona">Zona crítica</span>}
      </header>
      <div className="mapa-caja mapa-caja--baja">
        <MapaSimulador datos={datos} porUpz={actual.porUpz} encuadre={bbox} upzSeleccionada={codigo} onTocarUpz={onVerUpz} interactivo />
      </div>
      <section className="bloque">
        <div className="cifras">
          <div><b>{entero(u.demanda)}</b><span>niños piden cupo</span></div>
          <div><b>{entero(u.cupos)}</b><span>cupos en la UPZ</span></div>
          <div><b>{entero(Math.round(100 * u.cupos_por_solicitud))}</b><span>cupos por cada 100</span></div>
        </div>
        <div className="cifras cifras--dos">
          <div><b>{decimal(base.porUpz[i] ?? 0)}%</b><span>sin cupo hoy</span></div>
          <div><b>{decimal(actual.porUpz[i] ?? 0)}%</b><span>sin cupo con tu política</span></div>
        </div>
        <p className="nota">Los niños también usan cupos de UPZ vecinas: por eso el % sin cupo no es igual a la falta de cupos dentro de la UPZ.</p>
      </section>
      <section className="bloque">
        <h2 className="bloque__titulo">Colegios oficiales ({sedes.length})</h2>
        {sedes.length === 0 && <div className="nota">No hay sedes oficiales en esta UPZ.</div>}
        <ul className="lista">
          {sedes.map((s) => (
            <li key={s.id} className="lista__item">
              <span className="lista__nombre">{s.nombre}</span>
              <span className="lista__dato">{entero(s.cupos)} cupos de nuevos</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
