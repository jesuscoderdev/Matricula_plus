import { entero } from '../datos'
import { describir } from '../estado'
import Proli from '../componentes/Proli'
import QrCita from '../componentes/QrCita'
import { esTotem } from '../modo'
import { kicker, type PropsCapitulo } from './tipos'

/** 05 — El método Proliferante aplicado a este demo, y el cierre con Proli y el QR. */
export default function Metodo({ datos, modo, palancas, ir }: PropsCapitulo) {
  const etapas = [
    { t: 'Datos abiertos', d: `Oferta y demanda SED 2025, ${entero(datos.familias.n_sedes)} sedes, UPZ y población de 5 a 17 años` },
    { t: 'Modelo', d: `${entero(datos.familias.n)} familias sintéticas en manzanas residenciales, sin datos personales` },
    { t: 'Simulación', d: 'Orden de llegada vs asignación diferida, con reubicación, en tu navegador' },
    { t: 'Decisión', d: describir(datos, palancas) },
    { t: 'Aprendizaje', d: 'Medir, comparar y ajustar la política cada año' },
  ]
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('metodo')}</span>
        <h1 className="display">De datos abiertos a <em>decisiones</em></h1>
      </header>
      <ol className="pasos-metodo">
        {etapas.map((e) => <li key={e.t}><span><b>{e.t}</b><small>{e.d}</small></span></li>)}
      </ol>
      <div className="cierre">
        <Proli tamano={modo === 'escritorio' ? 6.5 : 7} globo={<><span className="acento">¿Lo vemos con los datos de tu entidad?</span> <b>Agenda una cita.</b></>} />
        <QrCita />
      </div>
      {modo !== 'auto' && (
        <div className="panel__pie">
          {!esTotem(modo) && <button className="boton boton--violeta boton--ancho" onClick={() => ir('agendar')}>Agendar una cita</button>}
          <div className="fila fila--entre">
            <button className="boton-texto" onClick={() => ir('caso')}>Simula una familia →</button>
            <button className="boton-texto" onClick={() => ir('portada')}>↺ Volver a empezar</button>
          </div>
        </div>
      )}
    </div>
  )
}
