import { decimal, dosDecimales } from '../datos'
import type { Metricas, Supuestos } from '../motor'
import { COLOR } from '../mapa/MapaEscena'

type Clave = 'pctPrimera' | 'pctFueraDeOpciones' | 'pctSinCupo' | 'distanciaKm' | 'pctViajeLargo' | 'pctVulnerablesFuera'
type Grupo = 'cuantos' | 'quienes' | 'como'
interface Fila { clave: Clave; grupo: Grupo; nombre: string; detalle?: string; mejorSiBaja: boolean; km?: boolean }

/** Las tres preguntas que responde la tabla, en el orden en que se leen. */
const GRUPOS: { id: Grupo; titulo: string }[] = [
  { id: 'cuantos', titulo: '¿Cuántos niños consiguen colegio?' },
  { id: 'quienes', titulo: '¿Quién lo consigue?' },
  { id: 'como', titulo: '¿Qué tan bien les va?' },
]

export const filasMetricas = (s: Supuestos): Fila[] => [
  { clave: 'pctFueraDeOpciones', grupo: 'cuantos', nombre: 'No entran a ninguno de los colegios que pidieron', detalle: `de sus ${s.opciones} opciones`, mejorSiBaja: true },
  { clave: 'pctSinCupo', grupo: 'cuantos', nombre: 'Se quedan sin ningún cupo cerca', detalle: `ni a ${decimal(s.radioReubicacionKm)} km de casa`, mejorSiBaja: true },
  { clave: 'pctVulnerablesFuera', grupo: 'quienes', nombre: 'Niños vulnerables que no entran a sus colegios', mejorSiBaja: true },
  { clave: 'pctPrimera', grupo: 'como', nombre: 'Entran a su primera opción', mejorSiBaja: false },
  { clave: 'pctViajeLargo', grupo: 'como', nombre: `Viajan más de ${decimal(s.umbralViajeLargoKm)} km a su colegio`, mejorSiBaja: true },
  { clave: 'distanciaKm', grupo: 'como', nombre: 'Distancia promedio a su colegio', mejorSiBaja: true, km: true },
]

/** El cambio en palabras: «Mejora» o «Empeora» y cuánto (nunca solo color ni flechas). */
function Delta({ hoy, pol, mejorSiBaja, km }: { hoy: number; pol: number; mejorSiBaja: boolean; km?: boolean }) {
  const d = pol - hoy
  const umbral = km ? 0.005 : 0.05
  if (Math.abs(d) < umbral) return <span className="delta delta--igual">Igual</span>
  const mejor = (d < 0) === mejorSiBaja
  const v = km ? `${dosDecimales(Math.abs(d))} km` : `${decimal(Math.abs(d))} puntos`
  return <span className={`delta ${mejor ? 'delta--mejor' : 'delta--peor'}`}>{mejor ? 'Mejora' : 'Empeora'} {v}</span>
}

/** Tabla hoy vs Matrícula+, agrupada por pregunta: cuántos, quiénes y qué tan bien. */
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
      {GRUPOS.map((g) => {
        const deGrupo = filas.filter((f) => f.grupo === g.id)
        const conZona = g.id === 'quienes' && zona
        if (!deGrupo.length && !conZona) return null
        return (
          <div key={g.id} className="comparacion__grupo">
            <div className="comparacion__pregunta">{g.titulo}</div>
            {deGrupo.map((f) => (
              <div key={f.clave} className={`metrica ${f.clave === 'pctFueraDeOpciones' ? 'metrica--destacada' : ''}`}>
                <span className="metrica__nombre">{f.nombre}{f.detalle && <small>{f.detalle}</small>}</span>
                <span className="metrica__v">{fmt(f, hoy)}</span>
                <span className="metrica__v metrica__v--pol">{fmt(f, pol)}<Delta hoy={hoy[f.clave]} pol={pol[f.clave]} mejorSiBaja={f.mejorSiBaja} km={f.km} /></span>
              </div>
            ))}
            {conZona && (
              <div className="metrica">
                <span className="metrica__nombre">Niños de la zona crítica que no entran a sus colegios<small>Tibabuyes y El Rincón, donde la SED ve más falta de cupos</small></span>
                <span className="metrica__v">{decimal(zona.hoy.pctFueraDeOpciones)}%</span>
                <span className="metrica__v metrica__v--pol">{decimal(zona.pol.pctFueraDeOpciones)}%
                  <Delta hoy={zona.hoy.pctFueraDeOpciones} pol={zona.pol.pctFueraDeOpciones} mejorSiBaja /></span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`
const TRAMOS = [
  { k: 'primera', nombre: '1.ª opción', color: rgb(COLOR.primera) },
  { k: 'otra', nombre: 'otra opción', color: rgb(COLOR.otra) },
  { k: 'reub', nombre: 'en otro colegio', color: rgb(COLOR.reubicado) },
  { k: 'sin', nombre: 'sin cupo cerca', color: rgb(COLOR.sin) },
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
