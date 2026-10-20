import { useState } from 'react'
import BotonGrande from '../componentes/BotonGrande'
import { Opciones } from '../componentes/Controles'
import TarjetaMetrica from '../componentes/TarjetaMetrica'
import MapaSimulador, { LeyendaSinCupo } from '../mapa/MapaSimulador'
import { METRICAS } from '../metricas'
import { describirPalancas, type PropsPaso } from './tipos'

/** Paso 3 — Resultado: 5 métricas con delta frente a hoy y mapa antes / después. */
export default function Resultado({ datos, palancas, base, actual, ir, modo }: PropsPaso) {
  const [vista, setVista] = useState<'hoy' | 'politica'>('politica')
  return (
    <div className="pantalla-paso">
      <header className="cabeza cabeza--compacta">
        <h1 className="titulo">Así cambia Bogotá</h1>
        <p className="subtitulo">{describirPalancas(datos, palancas)}</p>
      </header>
      <div className="tarjetas-m">
        {METRICAS.map((m, i) => (
          <TarjetaMetrica key={m.clave} info={m} valor={actual.metricas[m.clave]} base={base.metricas[m.clave]}
                          grande={i === 0} retraso={0.1 * i} />
        ))}
      </div>
      <p className="nota">Comparado con hoy: orden de llegada, sin colegio nuevo y sin jornada única.</p>
      <div className="mapa-zona">
        {/* Encuadre en la zona crítica: es donde se ve el efecto de las palancas */}
        <MapaSimulador datos={datos} porUpz={vista === 'hoy' ? base.porUpz : actual.porUpz} encuadre="zona"
                       colegioNuevo={vista === 'hoy' ? null : palancas.colegioNuevo} />
        <LeyendaSinCupo titulo="Sin cupo · zona crítica" />
      </div>
      <Opciones titulo="Ver el mapa" valor={vista} columnas={2} cambiar={setVista}
                opciones={[{ valor: 'hoy', etiqueta: 'Antes (hoy)' }, { valor: 'politica', etiqueta: 'Después (tu política)' }]} />
      <footer className="pie-acciones">
        {modo !== 'auto' && <BotonGrande onClick={() => ir('supuestos')}>¿Qué supusimos? →</BotonGrande>}
      </footer>
    </div>
  )
}
