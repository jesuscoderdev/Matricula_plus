import { entero } from '../datos'
import { describir } from '../estado'
import Proli from '../componentes/Proli'
import QrCita from '../componentes/QrCita'
import { esTotem } from '../modo'
import { kicker, type PropsCapitulo } from './tipos'

/**
 * 05 — Así lo resolvimos: lo que hizo Proliferante, contado como logros (qué hicimos y qué
 * permitió), y el cierre con Proli y el QR. Las cifras salen de los datos, no van escritas a mano.
 */
export default function Metodo({ datos, modo, palancas, ir }: PropsCapitulo) {
  const par = datos.indice.parametros as { demanda_nuevos_total: number }
  const etapas = [
    { t: 'Reunimos los datos', d: `${entero(par.demanda_nuevos_total)} solicitudes de cupo y ${entero(datos.familias.n_sedes)} sedes de la SED, cruzadas con la población de 5 a 17 años de cada UPZ`,
      logro: 'Ver dónde faltan cupos, barrio por barrio, solo con datos abiertos' },
    { t: 'Recreamos la ciudad', d: `${entero(datos.familias.n)} familias simuladas, ubicadas donde vive la gente, sin un solo dato personal`,
      logro: 'Probar reglas sin tocar a ninguna familia real' },
    { t: 'Simulamos dos reglas', d: 'La de hoy (orden de llegada) y la de Matrícula+, familia por familia, en segundos y en tu navegador',
      logro: 'Comparar el resultado antes de decidir, no después' },
    { t: 'Medimos el impacto', d: `Seis indicadores por localidad y para toda Bogotá. Tu elección: ${describir(datos, palancas)}`,
      logro: 'Saber quién gana y quién pierde con cada regla' },
    { t: 'Dejamos la decisión lista', d: 'Un simulador que la entidad puede volver a correr cada año',
      logro: 'Ajustar la política con evidencia, año tras año' },
  ]
  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">{kicker('metodo')}</span>
        <h1 className="display">Así lo <em>resolvimos</em></h1>
      </header>
      <ol className="pasos-metodo">
        {etapas.map((e) => <li key={e.t}><span><b>{e.t}</b><small>{e.d}</small><span className="pasos-metodo__logro">{e.logro}</span></span></li>)}
      </ol>
      <div className="cierre">
        <Proli tamano={modo === 'escritorio' ? 6.5 : 7} globo={<>Esto lo hicimos con datos abiertos. <span className="acento">¿Tienes un reto en tu entidad?</span> <b>Agenda una reunión.</b></>} />
        <QrCita />
      </div>
      {modo !== 'auto' && (
        <div className="panel__pie">
          {!esTotem(modo) && <button className="boton boton--violeta boton--ancho" onClick={() => ir('agendar')}>Agenda una reunión para conocer tu reto</button>}
          <button className="boton-texto" onClick={() => ir('portada')}>↺ Volver a empezar</button>
        </div>
      )}
    </div>
  )
}
