import BotonGrande from '../componentes/BotonGrande'
import Contador from '../componentes/Contador'
import MapaSimulador, { LeyendaSinCupo } from '../mapa/MapaSimulador'
import { decimal } from '../datos'
import type { PropsPaso } from './tipos'

/** Paso 1 — El problema: hay menos cupos que solicitudes, y no están donde viven los niños. */
export default function Problema({ datos, base, ir, modo }: PropsPaso) {
  const p = datos.indice.parametros as { cupos_nuevos_total: number; demanda_nuevos_total: number }
  const por100 = Math.round((100 * p.cupos_nuevos_total) / p.demanda_nuevos_total)
  const zona = datos.indice.zona_critica
  return (
    <div className="pantalla-paso">
      <header className="cabeza">
        <h1 className="titulo">Faltan cupos donde viven los niños</h1>
        <div className="cifra-fila">
          <div className="cifra-gigante texto-naranja"><Contador valor={base.sinCupo} retraso={0.3} /></div>
          <p className="cifra-texto">niños nuevos <b>sin cupo</b> en ninguno de sus 3 colegios, asignando por orden de llegada.</p>
        </div>
        <p className="subtitulo">Por cada <b>100</b> niños que piden cupo hay <b>{por100}</b> cupos.
          En la <b className="subrayado-zona">zona crítica</b> se queda sin cupo el <b>{decimal(base.metricas.pct_sin_cupo_zona_critica)}%</b>.</p>
      </header>
      <div className="mapa-zona">
        <MapaSimulador datos={datos} porUpz={base.porUpz} />
        <LeyendaSinCupo />
      </div>
      <p className="nota">Zona crítica: {zona.slice(0, 5).map((z) => z.nombre).join(', ')} y {zona.length - 5} UPZ más.</p>
      <footer className="pie-acciones">
        {modo !== 'auto' && <BotonGrande onClick={() => ir('accion')}>Probar una política →</BotonGrande>}
      </footer>
    </div>
  )
}
