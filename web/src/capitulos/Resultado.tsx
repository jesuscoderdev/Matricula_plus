import { decimal, entero } from '../datos'
import { describir, metricasDe, type Palancas } from '../estado'
import type { Metricas, Supuestos } from '../motor'
import Comparacion, { Reparto } from '../componentes/Comparacion'
import Veredicto from '../componentes/Veredicto'
import { kicker, type PropsCapitulo } from './tipos'

export type Alcance = 'localidad' | 'bogota' | 'zona'
export interface PropsResultado extends PropsCapitulo {
  alcance: Alcance
  setAlcance: (a: Alcance) => void
  coloreo: 'hoy' | 'pol'
  setColoreo: (c: 'hoy' | 'pol') => void
}

/**
 * El veredicto: la cifra que más cambió, en niños y en palabras simples. Primero «cuántos» entran
 * a sus colegios (Matrícula+ optimiza los cupos para que quepan más); si eso casi no cambia,
 * «quiénes»: los vulnerables. La nota dice el precio: algunos pasan a su 2.ª o 3.ª opción.
 */
function veredicto(hoy: Metricas, pol: Metricas, p: Palancas, s: Supuestos, nombre: string): Parameters<typeof Veredicto>[0] {
  const dF = pol.pctFueraDeOpciones - hoy.pctFueraDeOpciones
  const nF = Math.abs(hoy.fueraDeOpciones - pol.fueraDeOpciones)
  const nV = hoy.vulnerablesFuera - pol.vulnerablesFuera
  const dV = pol.pctVulnerablesFuera - hoy.pctVulnerablesFuera
  const etiqueta = <>Con tus reglas, en {nombre}</>
  const fuera = { antes: { etiqueta: 'Hoy no entran a sus colegios', valor: `${decimal(hoy.pctFueraDeOpciones)}%` },
    despues: { etiqueta: 'Con Matrícula+', valor: `${decimal(pol.pctFueraDeOpciones)}%` } }
  if (dF <= -1) return { etiqueta, ...fuera, cifra: entero(nF), frase: 'niños más entran a uno de los colegios que pidieron',
    nota: <>Con los mismos cupos: Matrícula+ <b>optimiza</b> el reparto.{nV > 0 && dV <= -2 && <> Además, {entero(nV)} niños vulnerables menos quedan por fuera.</>}
      {' '}El precio: algunos entran a su 2.ª o 3.ª opción en vez de la primera ({decimal(hoy.pctPrimera)}% → {decimal(pol.pctPrimera)}% en su 1.ª opción).
      {p.colegioNuevo && <> El colegio nuevo suma {entero(s.cuposColegioNuevo)} cupos.</>}</> }
  if (dF >= 1) return { etiqueta, ...fuera, tono: 'peor', cifra: entero(nF), frase: 'niños más se quedan sin ninguno de los colegios que pidieron',
    nota: p.jornadaUnica
      ? <>La jornada única quita el {entero(100 * s.reduccionJornada)}% de los cupos: más horas de clase, <b>menos niños por colegio</b>.</>
      : dV <= -2 && nV > 0
        ? <>A cambio, <b>{entero(nV)} niños vulnerables menos</b> quedan por fuera ({decimal(hoy.pctVulnerablesFuera)}% → {decimal(pol.pctVulnerablesFuera)}%).
            Es la decisión de a quién priorizar; un colegio nuevo sí suma cupos.</>
        : 'Estas reglas dejan a más niños por fuera. Prueba otra prioridad o un colegio nuevo.' }
  const mismos = <>En total quedan por fuera casi los mismos niños ({decimal(hoy.pctFueraDeOpciones)}% → {decimal(pol.pctFueraDeOpciones)}%):
    las reglas deciden <b>quién</b> entra, no cuántos caben. Para que quepan más hace falta capacidad, como un colegio nuevo.</>
  if (dV <= -2 && nV > 0) return { etiqueta, cifra: entero(nV), frase: 'niños vulnerables menos se quedan sin ninguno de los colegios que pidieron',
    antes: { etiqueta: 'Hoy quedan por fuera', valor: `${decimal(hoy.pctVulnerablesFuera)}% de los vulnerables` },
    despues: { etiqueta: 'Con Matrícula+', valor: `${decimal(pol.pctVulnerablesFuera)}%` }, nota: mismos }
  return { etiqueta, ...fuera, tono: 'igual', cifra: '≈ 0', frase: 'cambio en cuántos niños entran a sus colegios',
    nota: <>Con estas reglas el resultado casi no cambia. Prueba la prioridad <b>Equidad</b> o un colegio nuevo.</> }
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
      <Veredicto {...veredicto(m.hoy, m.pol, palancas, supuestos, nombre!)} />
      <h2 className="subtitulo">Dónde queda cada niño</h2>
      <Reparto hoy={m.hoy} pol={m.pol} />
      <h2 className="subtitulo">Todas las cifras</h2>
      <Comparacion hoy={m.hoy} pol={m.pol} s={supuestos} zona={a === 'bogota' ? r.zona : undefined}
                   solo={modo === 'escritorio' ? undefined : ['pctFueraDeOpciones', 'pctPrimera', 'pctSinCupo', 'pctVulnerablesFuera', 'pctViajeLargo']} />
      <p className="nota">Cómo leerlo: quien no entra a ninguno de sus colegios es <b>reubicado</b> por la SED en el colegio con cupo más cercano
        (hasta {decimal(supuestos.radioReubicacionKm)} km); si no hay, se queda <b>sin colegio cerca</b>. <span className="acento">Hoy se reparte por orden de llegada; con Matrícula+, por prioridad y optimizando los cupos.</span></p>
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
