import { decimal, entero } from '../datos'
import { esTotem } from '../modo'
import { kicker, type PropsCapitulo } from './tipos'

interface FuentesIndice {
  datos: { dato: string; fuente: string; corte: string; url: string }[]
  verificacion: string[]
  privacidad: string
}

/**
 * 05 — De dónde salen los datos (como el capítulo Fuentes de Movilidad+): qué cifras son oficiales y
 * cuáles son de la simulación, las fuentes con su corte y cómo se verificaron. Ninguna cifra va escrita
 * a mano: las oficiales salen de los parámetros del índice y las simuladas, del motor.
 */
export default function Fuentes({ datos, r, modo, supuestos, ir }: PropsCapitulo) {
  const f = (datos.indice as unknown as { fuentes: FuentesIndice }).fuentes
  const p = datos.indice.parametros as { demanda_nuevos_total: number; deficit_sed: number; upz_insuficientes_sed: number }
  const totem = esTotem(modo)
  const hoy = r.bogota.hoy
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('fuentes')}</span>
        <h1 className="display">De dónde salen <em>los datos</em></h1>
        <p className="lead">Todo sale de datos abiertos de Bogotá y de estudios públicos de la Secretaría de Educación.
          Ninguna fuente trae datos personales.</p>
      </header>

      <div className="cifras-tipo">
        <div className="cifras-tipo__grupo cifras-tipo__grupo--oficial">
          <b>Cifras oficiales</b><small>Secretaría de Educación</small>
          <ul>
            <li><b>{entero(p.demanda_nuevos_total)}</b> niños nuevos pidieron cupo en 2024</li>
            <li><b>{entero(p.deficit_sed)}</b> cupos de déficit en 2024</li>
            <li><b>{p.upz_insuficientes_sed}</b> UPZ con insuficiencia de cupos</li>
          </ul>
        </div>
        <div className="cifras-tipo__grupo cifras-tipo__grupo--simulada">
          <b>Cifras de la simulación</b><small>estimaciones con datos abiertos</small>
          <ul>
            <li><b>{entero(hoy.fueraDeOpciones)}</b> niños que hoy no entran a ninguno de los colegios que pidieron</li>
            <li><b>{entero(hoy.sinCupo)}</b> sin ningún cupo a menos de {decimal(supuestos.radioReubicacionKm)} km</li>
            <li>El resultado de cada regla de Matrícula+</li>
          </ul>
        </div>
      </div>

      <h2 className="subtitulo">Fuentes</h2>
      <ul className="fuentes-mov">
        {f.datos.map((x) => (
          <li key={x.dato}>
            <b>{x.dato}</b>
            <span>{x.fuente} · {x.corte}</span>
            {!totem && <a href={x.url} target="_blank" rel="noopener noreferrer">{x.url.replace(/^https?:\/\//, '').split('/')[0]}</a>}
          </li>
        ))}
      </ul>

      <h2 className="subtitulo">Cómo se verificaron</h2>
      <ul className="pruebas-mov">
        {f.verificacion.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <p className="nota">{f.privacidad}</p>

      {modo !== 'auto' && (
        <div className="panel__pie">
          <button className="boton boton--violeta boton--ancho" onClick={() => ir('metodo')}>Así lo resolvimos →</button>
          <button className="boton-texto" onClick={() => ir('laboratorio')}>← Ver los supuestos</button>
        </div>
      )}
    </div>
  )
}
