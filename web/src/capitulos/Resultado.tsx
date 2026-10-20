import type { ReactNode } from 'react'
import { decimal, entero } from '../datos'
import { describir, metricasDe, type Palancas } from '../estado'
import type { Metricas, Supuestos } from '../motor'
import Comparacion, { Reparto } from '../componentes/Comparacion'
import { kicker, type PropsCapitulo } from './tipos'

export type Alcance = 'localidad' | 'bogota' | 'zona'
export interface PropsResultado extends PropsCapitulo {
  alcance: Alcance
  setAlcance: (a: Alcance) => void
  coloreo: 'hoy' | 'pol'
  setColoreo: (c: 'hoy' | 'pol') => void
}

/** La lectura en una frase: qué cambió en cuántos y qué cambió en quiénes. */
export function lectura(hoy: Metricas, pol: Metricas, p: Palancas, s: Supuestos): ReactNode[] {
  const out: ReactNode[] = []
  const dF = pol.pctFueraDeOpciones - hoy.pctFueraDeOpciones
  const n = Math.abs(hoy.fueraDeOpciones - pol.fueraDeOpciones)
  if (Math.abs(dF) < 1) out.push(<>Casi los mismos niños quedan fuera de sus opciones ({decimal(hoy.pctFueraDeOpciones)}% → {decimal(pol.pctFueraDeOpciones)}%): <b>reordenar no crea cupos</b>.</>)
  else if (dF < 0) out.push(<><b>{entero(n)} niños menos</b> quedan fuera de sus opciones ({decimal(hoy.pctFueraDeOpciones)}% → {decimal(pol.pctFueraDeOpciones)}%).</>)
  else out.push(<><b>{entero(n)} niños más</b> quedan fuera de sus opciones{p.jornadaUnica ? ': la jornada única quita cupos' : ''}.</>)
  const dV = pol.pctVulnerablesFuera - hoy.pctVulnerablesFuera
  const dL = pol.pctViajeLargo - hoy.pctViajeLargo
  const quien: ReactNode[] = []
  if (dV < -2) quien.push(<>los vulnerables fuera pasan de {decimal(hoy.pctVulnerablesFuera)}% a <b>{decimal(pol.pctVulnerablesFuera)}%</b></>)
  if (dL < -0.8) quien.push(<>los viajes de más de {decimal(s.umbralViajeLargoKm)} km bajan de {decimal(hoy.pctViajeLargo)}% a <b>{decimal(pol.pctViajeLargo)}%</b></>)
  if (quien.length) out.push(<> Lo que sí cambia es <b>quién</b> cabe: {quien[0]}{quien[1] && <> y {quien[1]}</>}.</>)
  if (!p.colegioNuevo && Math.abs(dF) < 1) out.push(<> Para que quepan más niños hace falta capacidad: prueba un colegio nuevo.</>)
  return out
}

/** 03 — Resultado: hoy vs Matrícula+ en la localidad, en Bogotá y en la zona crítica. */
export default function Resultado(props: PropsResultado) {
  const { datos, r, modo, supuestos, palancas, localidad, ir, alcance, setAlcance, coloreo, setColoreo } = props
  const auto = modo === 'auto'
  const loc = localidad ? metricasDe(datos, r, supuestos, localidad) : null
  const a = alcance === 'localidad' && !loc ? 'bogota' : alcance
  const m = a === 'localidad' ? loc! : a === 'zona' ? r.zona : r.bogota
  const nombre = a === 'localidad' ? localidad : a === 'zona' ? 'la zona crítica' : 'Bogotá'
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('resultado')}</span>
        <h1 className="display">Lo que cambia en <em>{nombre}</em></h1>
        <p className="nota">{describir(datos, palancas)} · {supuestos.opciones} opciones por familia</p>
      </header>
      <div className="segmentos">
        {loc && <button className={`segmento ${a === 'localidad' ? 'segmento--activo' : ''}`} onClick={() => setAlcance('localidad')} disabled={auto}>{localidad}</button>}
        <button className={`segmento ${a === 'bogota' ? 'segmento--activo' : ''}`} onClick={() => setAlcance('bogota')} disabled={auto}>Bogotá</button>
        <button className={`segmento ${a === 'zona' ? 'segmento--activo' : ''}`} onClick={() => setAlcance('zona')} disabled={auto}>Zona crítica</button>
      </div>
      <p className="lectura">{lectura(m.hoy, m.pol, palancas, supuestos)}</p>
      <Reparto hoy={m.hoy} pol={m.pol} />
      <Comparacion hoy={m.hoy} pol={m.pol} s={supuestos} zona={a === 'bogota' ? r.zona : undefined}
                   solo={modo === 'escritorio' ? undefined : ['pctFueraDeOpciones', 'pctPrimera', 'pctSinCupo', 'pctVulnerablesFuera', 'pctViajeLargo']} />
      <p className="nota">Quien no cabe en sus opciones es <b>reubicado</b> en el colegio con cupo más cercano (hasta {decimal(supuestos.radioReubicacionKm)} km), como hace la SED;
        si no hay, queda <b>sin cupo</b>. Hoy por orden de llegada; con Matrícula+, por prioridad.</p>
      {!auto && (
        <div className="panel__pie">
          <div className="segmentos">
            <button className={`segmento ${coloreo === 'hoy' ? 'segmento--activo' : ''}`} onClick={() => setColoreo('hoy')}>Mapa: hoy</button>
            <button className={`segmento ${coloreo === 'pol' ? 'segmento--activo' : ''}`} onClick={() => setColoreo('pol')}>Mapa: Matrícula+</button>
          </div>
          <button className="boton boton--violeta boton--ancho" onClick={() => ir('laboratorio')}>¿Y si los supuestos cambian? →</button>
          <button className="boton-texto" onClick={() => ir('accion')}>← Cambiar las reglas</button>
        </div>
      )}
    </div>
  )
}
