import { useEffect, useMemo, useRef } from 'react'
import MapaSimulador, { LeyendaSinCupo } from '../mapa/MapaSimulador'
import { decimal, entero, type Bbox, type Datos, type Resultado } from '../datos'

interface Props {
  datos: Datos
  localidad: string
  setLocalidad: (l: string) => void
  base: Resultado
  actual: Resultado
  resumenPolitica: string
  onVerUpz: (codigo: string) => void
}

/** "Ver mi localidad": selector, mapa de sus UPZ y % sin cupo hoy vs con la política elegida. */
export default function MiLocalidad({ datos, localidad, setLocalidad, base, actual, resumenPolitica, onVerUpz }: Props) {
  const localidades = useMemo(() => [...new Set(datos.upz.features.map((f) => f.properties.localidad))]
    .sort((a, b) => a.localeCompare(b, 'es')), [datos])
  const upzs = useMemo(() => datos.upz.features.filter((f) => f.properties.localidad === localidad), [datos, localidad])
  const bbox = useMemo<Bbox>(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    const rec = (c: any) => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]); x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1]) } else c.forEach(rec) }
    upzs.forEach((f) => rec(f.geometry.coordinates))
    return [[x0, y0], [x1, y1]]
  }, [upzs])
  const pct = (r: Resultado, codigo: string) => r.porUpz[datos.posUpz[codigo]] ?? 0
  const filas = upzs.map((f) => f.properties).sort((a, b) => pct(base, b.codigo) - pct(base, a.codigo))

  const chips = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chips.current?.querySelector('.chip--activo')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [localidad])

  return (
    <div className="pantalla">
      <header className="pantalla__cabeza">
        <h1 className="titulo titulo--chico">Ver mi localidad</h1>
        <span className="detalle">Con tu política: {resumenPolitica}</span>
        <div className="chips" ref={chips}>
          {localidades.map((n) => (
            <button key={n} className={`chip ${n === localidad ? 'chip--activo' : ''}`} onClick={() => setLocalidad(n)}>{n}</button>
          ))}
        </div>
      </header>
      <div className="mapa-caja">
        <MapaSimulador datos={datos} porUpz={actual.porUpz} encuadre={bbox} onTocarUpz={onVerUpz} interactivo />
        <LeyendaSinCupo />
      </div>
      <section className="bloque">
        <h2 className="bloque__titulo">Niños sin cupo por UPZ</h2>
        <table className="comparacion">
          <thead><tr><th>UPZ</th><th>Hoy</th><th>Tu política</th></tr></thead>
          <tbody>
            {filas.map((u) => {
              const h = pct(base, u.codigo), a = pct(actual, u.codigo), d = a - h
              return (
                <tr key={u.codigo} onClick={() => onVerUpz(u.codigo)} className="fila-tocable">
                  <td>{u.nombre}{u.zona_critica && <small className="marca-zona"> · zona crítica</small>}</td>
                  <td>{decimal(h)}%</td>
                  <td><b>{decimal(a)}%</b> <small>{Math.abs(d) < 0.05 ? '=' : d < 0 ? `▼ ${decimal(-d)}` : `▲ ${decimal(d)}`}</small></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="nota">Toca una UPZ para ver sus cupos y colegios. Cifras de {entero(datos.indice.base.estudiantes)} solicitudes de nuevos.</p>
      </section>
    </div>
  )
}
