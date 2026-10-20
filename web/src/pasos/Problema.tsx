import { useMemo, useState } from 'react'
import BotonGrande from '../componentes/BotonGrande'
import MapaSimulador, { LeyendaSinCupo } from '../mapa/MapaSimulador'
import MapaProceso from '../mapa/MapaProceso'
import GuiaProceso from '../componentes/GuiaProceso'
import { entero } from '../datos'
import type { PropsPaso } from './tipos'

/**
 * Paso 1 — El problema, en vivo: el visitante elige su localidad y ve cómo se asigna HOY
 * (orden de llegada): las familias llegan una por una, los colegios se llenan y quien llega
 * tarde se queda sin cupo.
 */
export default function Problema({ datos, base, ir, modo, localidad, elegirLocalidad, hoy, politica, palancas }: PropsPaso) {
  const [repeticion, setRepeticion] = useState(0)
  const [termino, setTermino] = useState(false)
  const p = datos.indice.parametros as { cupos_nuevos_total: number; demanda_nuevos_total: number }
  const por100 = Math.round((100 * p.cupos_nuevos_total) / p.demanda_nuevos_total)

  const resumen = useMemo(() => {
    if (!localidad) return null
    const upz = datos.upz.features.filter((f) => f.properties.localidad === localidad).map((f) => f.properties)
    const familias = datos.familias.upz.filter((u) => datos.localidadDeUpz[u] === localidad).length
    return { demanda: familias * datos.familias.estudiantes_por_familia, cupos: upz.reduce((a, u) => a + u.cupos, 0) }
  }, [datos, localidad])

  if (!localidad) {
    return (
      <div className="pantalla-paso">
        <header className="cabeza">
          <h1 className="titulo">Faltan cupos donde viven los niños</h1>
          <p className="subtitulo">Hoy <b>{entero(base.sinCupo)}</b> niños nuevos no quedan en ninguno de sus 3 colegios.
            Hay <b>{por100}</b> cupos por cada 100 que piden.</p>
        </header>
        <div className="mapa-zona">
          <MapaSimulador datos={datos} porUpz={base.porUpz} interactivo={modo !== 'auto'}
                         onTocarUpz={modo === 'auto' ? undefined : (c) => elegirLocalidad(datos.localidadDeUpz[datos.posUpz[c]])} />
          <LeyendaSinCupo />
          <div className="mapa-zona__aviso">👆 Toca tu localidad</div>
        </div>
        <div className="chips chips--paso" role="list">
          {datos.localidades.map((l) => (
            <button key={l} className="chip" onClick={() => elegirLocalidad(l)}>{l}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="pantalla-paso">
      <header className="cabeza cabeza--compacta">
        <h1 className="titulo">Así se asigna hoy en {localidad}</h1>
        {resumen && <p className="subtitulo"><b>{entero(resumen.demanda)}</b> niños nuevos viven aquí y piden cupo ·
          hay <b>{entero(resumen.cupos)}</b> cupos en sus colegios.</p>}
      </header>
      <div className="mapa-zona mapa-zona--proceso">
        <MapaProceso datos={datos} localidad={localidad} hoy={hoy} politica={politica} palancas={palancas}
                     fase="llegada" reproduccion={repeticion} alTerminar={() => setTermino(true)}
                     interactivo={modo !== 'auto'} />
      </div>
      <footer className="pie-acciones">
        {modo !== 'auto' && (
          <>
            <BotonGrande onClick={() => ir('accion')} latir={termino}>¿Y si asignamos distinto? →</BotonGrande>
            <div className="acciones-secundarias">
              <button className="boton-texto" onClick={() => { setTermino(false); setRepeticion((x) => x + 1) }}>↻ Ver de nuevo</button>
              <button className="boton-texto" onClick={() => elegirLocalidad(null)}>Cambiar localidad</button>
            </div>
          </>
        )}
      </footer>
      <GuiaProceso tipo="hoy" />
    </div>
  )
}
