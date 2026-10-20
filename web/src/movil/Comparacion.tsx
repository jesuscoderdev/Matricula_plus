import { APP_NAME } from '../config'
import { conSigno, decimal, entero, type Kpi } from '../datos'

interface Fila {
  etiqueta: string
  hoy: number | null
  mat: number | null
  fmt: (n: number) => string
  unidad?: string
  mejorSiBaja?: boolean
}

/** Tabla "Hoy vs Matrícula+" con el cambio coloreado. */
export default function Comparacion({ hoy, mat }: { hoy?: Kpi; mat?: Kpi }) {
  if (!hoy || !mat || hoy.estudiantes === 0) {
    return <div className="vacio">Aquí casi no viven niños que pidan cupo (zona industrial, parque o aeropuerto).</div>
  }
  const filas: Fila[] = [
    { etiqueta: 'Niños sin cupo', hoy: hoy.sin_cupo, mat: mat.sin_cupo, fmt: entero, mejorSiBaja: true },
    { etiqueta: 'En su 1ª opción', hoy: hoy.pct_primera_opcion, mat: mat.pct_primera_opcion, fmt: decimal, unidad: '%' },
    { etiqueta: 'En su top 3', hoy: hoy.pct_top3, mat: mat.pct_top3, fmt: decimal, unidad: '%' },
    { etiqueta: 'Viajes > 40 min', hoy: hoy.viajes_largos, mat: mat.viajes_largos, fmt: entero, mejorSiBaja: true },
    { etiqueta: 'Viaje promedio', hoy: hoy.tiempo_prom_min, mat: mat.tiempo_prom_min, fmt: decimal, unidad: ' min', mejorSiBaja: true },
  ]
  return (
    <table className="comparacion">
      <thead>
        <tr><th /><th>Hoy</th><th>{APP_NAME}</th><th>Cambio</th></tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const d = f.hoy !== null && f.mat !== null ? f.mat - f.hoy : null
          const bueno = d !== null && (f.mejorSiBaja ? d < 0 : d > 0)
          const clase = d === null || Math.abs(d) < 0.05 ? '' : bueno ? 'texto-superavit' : 'texto-deficit'
          return (
            <tr key={f.etiqueta}>
              <td>{f.etiqueta}</td>
              <td>{f.hoy === null ? '—' : f.fmt(f.hoy) + (f.unidad ?? '')}</td>
              <td><b>{f.mat === null ? '—' : f.fmt(f.mat) + (f.unidad ?? '')}</b></td>
              <td className={clase}>{d === null ? '—' : conSigno(d, f.fmt)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export const ETIQUETA_ESTADO = { deficit: 'Faltan cupos', superavit: 'Sobran cupos', equilibrio: 'En equilibrio' } as const
