import { decimal, dosDecimales } from '../datos'
import type { Metricas, Supuestos } from '../motor'
import { COLOR } from '../mapa/MapaEscena'

type Clave = 'pctPrimera' | 'pctFueraDeOpciones' | 'pctSinCupo' | 'distanciaKm' | 'pctViajeLargo' | 'pctVulnerablesFuera'
interface Fila { clave: Clave; nombre: string; detalle?: string; mejorSiBaja: boolean; km?: boolean }

export const filasMetricas = (s: Supuestos): Fila[] => [
  { clave: 'pctFueraDeOpciones', nombre: 'No entran a ninguno de sus colegios', detalle: `de los ${s.opciones} que pidieron`, mejorSiBaja: true },
  { clave: 'pctPrimera', nombre: 'Entran a su primera opción', mejorSiBaja: false },
  { clave: 'pctSinCupo', nombre: 'Sin cupo cercano', detalle: `ni con la reubicación (hasta ${decimal(s.radioReubicacionKm)} km)`, mejorSiBaja: true },
  { clave: 'pctVulnerablesFuera', nombre: 'Vulnerables que no entran a sus colegios', mejorSiBaja: true },
  { clave: 'pctViajeLargo', nombre: `Viajan más de ${decimal(s.umbralViajeLargoKm)} km a su colegio`, mejorSiBaja: true },
  { clave: 'distanciaKm', nombre: 'Distancia promedio a su colegio', mejorSiBaja: true, km: true },
]

function Delta({ hoy, pol, mejorSiBaja, km }: { hoy: number; pol: number; mejorSiBaja: boolean; km?: boolean }) {
  const d = pol - hoy
  const umbral = km ? 0.005 : 0.05
  if (Math.abs(d) < umbral) return <span className="delta delta--igual">= igual</span>
  const mejor = (d < 0) === mejorSiBaja
  const v = km ? `${dosDecimales(Math.abs(d))} km` : `${decimal(Math.abs(d))} puntos`
  return <span className={`delta ${mejor ? 'delta--mejor' : 'delta--peor'}`}>{d < 0 ? '▼' : '▲'} {v} {mejor ? 'mejor' : 'peor'}</span>
}

/** Tabla hoy vs Matrícula+ (con signo, flecha y palabra: nunca solo color). */
export default function Comparacion({ hoy, pol, s, zona, solo }: {
  hoy: Metricas; pol: Metricas; s: Supuestos
  /** fila extra: zona crítica fuera de sus opciones */
  zona?: { hoy: Metricas; pol: Metricas }
  solo?: Clave[]
}) {
  const filas = filasMetricas(s).filter((f) => !solo || solo.includes(f.clave))
  const fmt = (f: Fila, m: Metricas) => (f.km ? `${dosDecimales(m[f.clave])} km` : `${decimal(m[f.clave])}%`)
  return (
    <div className="comparacion">
      <div className="comparacion__cabeza"><span>Niños nuevos</span><span>Hoy</span><span>Matrícula+</span></div>
      {filas.map((f, i) => (
        <div key={f.clave} className={`metrica ${i === 0 ? 'metrica--destacada' : ''}`}>
          <span className="metrica__nombre">{f.nombre}{f.detalle && <small>{f.detalle}</small>}</span>
          <span className="metrica__v">{fmt(f, hoy)}</span>
          <span className="metrica__v metrica__v--pol">{fmt(f, pol)}<Delta hoy={hoy[f.clave]} pol={pol[f.clave]} mejorSiBaja={f.mejorSiBaja} km={f.km} /></span>
        </div>
      ))}
      {zona && (
        <div className="metrica">
          <span className="metrica__nombre">En la zona crítica, no entran a sus colegios<small>Tibabuyes y El Rincón (SED: insuficiencia muy alta)</small></span>
          <span className="metrica__v">{decimal(zona.hoy.pctFueraDeOpciones)}%</span>
          <span className="metrica__v metrica__v--pol">{decimal(zona.pol.pctFueraDeOpciones)}%
            <Delta hoy={zona.hoy.pctFueraDeOpciones} pol={zona.pol.pctFueraDeOpciones} mejorSiBaja /></span>
        </div>
      )}
    </div>
  )
}

const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`
const TRAMOS = [
  { k: 'primera', nombre: '1.ª opción', color: rgb(COLOR.primera) },
  { k: 'otra', nombre: 'otra opción', color: rgb(COLOR.otra) },
  { k: 'reub', nombre: 'reubicados', color: rgb(COLOR.reubicado) },
  { k: 'sin', nombre: 'sin cupo cercano', color: rgb(COLOR.sin) },
] as const

/** Dónde queda cada niño: barras apiladas hoy vs Matrícula+. */
export function Reparto({ hoy, pol }: { hoy: Metricas; pol: Metricas }) {
  const partes = (m: Metricas) => ({
    primera: m.pctPrimera, otra: Math.max(0, 100 - m.pctFueraDeOpciones - m.pctPrimera), reub: m.pctReubicados, sin: m.pctSinCupo,
  })
  const fila = (nombre: string, m: Metricas) => {
    const p = partes(m)
    return (
      <div className="reparto__fila">
        <span>{nombre}</span>
        <div className="reparto__barra" role="img" aria-label={`${nombre}: ${TRAMOS.map((t) => `${decimal(p[t.k])}% ${t.nombre}`).join(', ')}`}>
          {TRAMOS.map((t) => <i key={t.k} style={{ width: `${p[t.k]}%`, background: t.color }} />)}
        </div>
      </div>
    )
  }
  return (
    <div className="reparto">
      {fila('Hoy', hoy)}
      {fila('Matrícula+', pol)}
      <div className="reparto__leyenda">{TRAMOS.map((t) => <span key={t.k}><i style={{ background: t.color }} />{t.nombre}</span>)}</div>
    </div>
  )
}
