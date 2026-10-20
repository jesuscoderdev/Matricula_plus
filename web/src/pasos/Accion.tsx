import BotonGrande from '../componentes/BotonGrande'
import { Interruptor, Opciones } from '../componentes/Controles'
import TarjetaMetrica from '../componentes/TarjetaMetrica'
import MapaSimulador from '../mapa/MapaSimulador'
import { entero } from '../datos'
import { METRICAS } from '../metricas'
import type { PropsPaso } from './tipos'

/**
 * Paso 2 — Acción: 3 palancas (máximo 3 controles visibles).
 * Cada toque busca el escenario precalculado: el mapa y la cifra cambian al instante.
 */
export default function Accion({ datos, palancas, cambiarPalancas, base, actual, ir, modo }: PropsPaso) {
  const { presets, colegio_nuevo, parametros } = datos.indice
  const ju = Math.round(100 * (parametros.reduccion_jornada_unica as number))
  const cupos = entero(parametros.cupos_colegio_nuevo as number)
  const zona = METRICAS[0]
  return (
    <div className="pantalla-paso">
      <header className="cabeza cabeza--compacta">
        <h1 className="titulo">Tú decides</h1>
        <p className="subtitulo">Mueve las palancas y mira cómo cambia el mapa.</p>
      </header>
      <div className="mapa-zona mapa-zona--accion">
        <MapaSimulador datos={datos} porUpz={actual.porUpz} mostrarCandidatos colegioNuevo={palancas.colegioNuevo}
                       onTocarCandidato={modo === 'auto' ? undefined : (c) => cambiarPalancas({ colegioNuevo: c })} />
        <div className="mapa-zona__flotante">
          <TarjetaMetrica info={zona} valor={actual.metricas[zona.clave]} base={base.metricas[zona.clave]} />
        </div>
      </div>
      <div className="controles">
        <Opciones titulo="1 · ¿A quién darle prioridad?" valor={palancas.preset}
                  cambiar={(v) => cambiarPalancas({ preset: v })}
                  opciones={presets.map((p) => ({ valor: p.clave, etiqueta: p.etiqueta, detalle: p.descripcion }))} />
        <Opciones titulo={<>2 · ¿Dónde construir un colegio? <small>(+{cupos} cupos)</small></>}
                  valor={palancas.colegioNuevo ?? 'ninguno'} columnas={3}
                  cambiar={(v) => cambiarPalancas({ colegioNuevo: v === 'ninguno' ? null : v })}
                  opciones={[{ valor: 'ninguno', etiqueta: 'Ninguno' },
                             ...colegio_nuevo.map((c, i) => ({ valor: c.clave, etiqueta: `${i + 1}. ${c.etiqueta}` }))]} />
        <Interruptor titulo="3 · Jornada única" detalle={`Más horas de clase, ${ju}% menos cupos`}
                     activo={palancas.jornadaUnica} cambiar={(v) => cambiarPalancas({ jornadaUnica: v })} />
      </div>
      <footer className="pie-acciones">
        {modo !== 'auto' && <BotonGrande onClick={() => ir('resultado')}>Ver resultado →</BotonGrande>}
      </footer>
    </div>
  )
}
