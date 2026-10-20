import BotonGrande from '../componentes/BotonGrande'
import Kpi from '../componentes/Kpi'
import { APP_NAME } from '../config'
import { decimal, entero } from '../datos'
import type { PropsEscena } from './tipos'

/** Paso 3: "Así se asigna hoy". Las líneas se dibujan en el mapa (fase "hoy"). */
export function AsignarHoy({ datos, localidad, ir, modo }: PropsEscena) {
  const k = datos.hoy.kpis.por_localidad[localidad]
  return (
    <div className="escena">
      <header className="arriba">
        <div className="sobretitulo">{localidad}</div>
        <h1 className="titulo">Así se asigna hoy</h1>
        <div className="subtitulo">Orden de llegada · un solo colegio por familia</div>
        <div className="kpis">
          <Kpi etiqueta="niños sin cupo" valor={k.sin_cupo} tono={k.sin_cupo > 0 ? 'malo' : 'neutro'} retraso={0.8} />
          <Kpi etiqueta="en su 1ª opción" valor={k.pct_primera_opcion} unidad="%" retraso={1.0} />
          <Kpi etiqueta="viajes de más de 40 min" valor={k.viajes_largos} tono={k.viajes_largos > 0 ? 'malo' : 'neutro'} retraso={1.2} />
        </div>
        <LeyendaLineas tiempo={k.tiempo_prom_min} />
      </header>
      <footer className="abajo">
        {modo !== 'auto' && <BotonGrande onClick={() => ir('matricula')}>Asignar con {APP_NAME}</BotonGrande>}
      </footer>
    </div>
  )
}

/** Paso 4: "Con Matrícula+". Las líneas se reacomodan y los KPIs muestran el cambio. */
export function AsignarMatricula({ datos, localidad, ir, modo }: PropsEscena) {
  const h = datos.hoy.kpis.por_localidad[localidad]
  const m = datos.matricula.kpis.por_localidad[localidad]
  return (
    <div className="escena">
      <header className="arriba">
        <div className="sobretitulo">{localidad}</div>
        <h1 className="titulo">Con {APP_NAME}</h1>
        <div className="subtitulo">Cupo garantizado · cada familia ordena 3 a 5 colegios</div>
        <div className="kpis">
          <Kpi etiqueta="niños sin cupo" valor={m.sin_cupo} tono={m.sin_cupo > 0 ? 'malo' : 'bueno'}
               delta={m.sin_cupo - h.sin_cupo} mejorSiBaja retraso={0.8} desde={h.sin_cupo} />
          <Kpi etiqueta="en su 1ª opción" valor={m.pct_primera_opcion} unidad="%"
               tono={m.pct_primera_opcion >= h.pct_primera_opcion ? 'bueno' : 'neutro'}
               delta={Math.round(m.pct_primera_opcion - h.pct_primera_opcion)} unidadDelta=" pts" retraso={1.0} desde={h.pct_primera_opcion} />
          <Kpi etiqueta="viajes de más de 40 min" valor={m.viajes_largos}
               tono={m.viajes_largos <= h.viajes_largos ? 'bueno' : 'malo'}
               delta={m.viajes_largos - h.viajes_largos} mejorSiBaja retraso={1.2} desde={h.viajes_largos} />
        </div>
        <LeyendaLineas tiempo={m.tiempo_prom_min} />
      </header>
      <footer className="abajo">
        <div className="nota-honesta">
          {m.sin_cupo > 0
            ? <>Aún faltan <b>{entero(m.sin_cupo)}</b> cupos cerca de casa: ahí es donde hay que abrir oferta.</>
            : <>Los mismos cupos, mejor repartidos: <span className="texto-superavit">ningún niño se queda sin cupo por llegar tarde.</span></>}
        </div>
        {modo !== 'auto' && <BotonGrande onClick={() => ir('como')}>¿Cómo lo hicimos?</BotonGrande>}
      </footer>
    </div>
  )
}

function LeyendaLineas({ tiempo }: { tiempo: number | null }) {
  return (
    <div className="leyenda leyenda--lineas">
      <span><i className="raya raya--acento" />1ª opción</span>
      <span><i className="raya raya--deficit" />viaje &gt; 40 min</span>
      <span><i className="punto punto--deficit" />sin cupo</span>
      {tiempo !== null && <span className="leyenda__dato">Viaje prom. {decimal(tiempo)} min</span>}
    </div>
  )
}
