import { useEffect, useRef, useState } from 'react'
import BotonGrande from '../componentes/BotonGrande'
import { kickerDe } from '../componentes/BarraProgreso'
import { Interruptor, Opciones } from '../componentes/Controles'
import MapaProceso, { type FaseProceso } from '../mapa/MapaProceso'
import { APP_NAME } from '../config'
import GuiaProceso from '../componentes/GuiaProceso'
import { entero } from '../datos'
import type { PropsPaso } from './tipos'

/**
 * Paso 2 — Acción: el visitante elige la política (3 palancas) y ve la asignación diferida
 * correr por rondas en su localidad. Si cambia una palanca después, se vuelve a asignar al instante.
 */
export default function Accion({ datos, palancas, cambiarPalancas, ir, modo, localidad, hoy, politica, disparoAuto }: PropsPaso) {
  const { presets, colegio_nuevo, parametros } = datos.indice
  const ju = Math.round(100 * (parametros.reduccion_jornada_unica as number))
  const cupos = entero(parametros.cupos_colegio_nuevo as number)
  const loc = localidad ?? 'Suba'

  const [fase, setFase] = useState<FaseProceso>('neutro')
  const [repeticion, setRepeticion] = useState(0)
  const [rapido, setRapido] = useState(false)
  const [estado, setEstado] = useState<'listo' | 'asignando' | 'hecho'>('listo')

  const asignar = (veloz = false) => {
    setRapido(veloz)
    setFase('diferida')
    setEstado('asignando')
    setRepeticion((x) => x + 1)
  }

  // Cambiar una palanca después de asignar vuelve a correr el proceso (más rápido)
  const llavePalancas = `${palancas.preset}-${palancas.colegioNuevo}-${palancas.jornadaUnica}`
  const previa = useRef(llavePalancas)
  useEffect(() => {
    if (previa.current === llavePalancas) return
    previa.current = llavePalancas
    if (estado !== 'listo') asignar(true)
  }, [llavePalancas])  // eslint-disable-line react-hooks/exhaustive-deps

  // Modo automático: App "aprieta" el botón
  useEffect(() => { if (disparoAuto) asignar(false) }, [disparoAuto])

  return (
    <div className="pantalla-paso">
      <header className="cabeza cabeza--compacta">
        <span className="kicker">{kickerDe('accion')} · {loc}</span>
        <h1 className="titulo">Asigna con {APP_NAME} en {loc}</h1>
      </header>
      <div className="mapa-zona mapa-zona--proceso">
        <MapaProceso datos={datos} localidad={loc} hoy={hoy} politica={politica} palancas={palancas}
                     fase={fase} reproduccion={repeticion} rapido={rapido} interactivo={modo !== 'auto'}
                     alTerminar={() => setEstado('hecho')} />
      </div>
      <div className="controles controles--compactos">
        <Opciones titulo="1 · ¿A quién darle prioridad?" valor={palancas.preset}
                  cambiar={(v) => cambiarPalancas({ preset: v })}
                  opciones={presets.map((p) => ({ valor: p.clave, etiqueta: p.etiqueta, detalle: p.descripcion }))} />
        <Opciones titulo={<>2 · ¿Construir un colegio? <small>(+{cupos} cupos)</small></>}
                  valor={palancas.colegioNuevo ?? 'ninguno'} columnas={6}
                  cambiar={(v) => cambiarPalancas({ colegioNuevo: v === 'ninguno' ? null : v })}
                  opciones={[{ valor: 'ninguno', etiqueta: 'Ninguno' },
                             ...colegio_nuevo.map((c) => ({ valor: c.clave, etiqueta: c.etiqueta.replace(/ \(.*\)/, '') }))]} />
        <Interruptor titulo="3 · Jornada única" detalle={`Más horas de clase, ${ju}% menos cupos`}
                     activo={palancas.jornadaUnica} cambiar={(v) => cambiarPalancas({ jornadaUnica: v })} />
      </div>
      <footer className="pie-acciones">
        {modo !== 'auto' && (estado === 'hecho'
          ? <>
              <BotonGrande latir onClick={() => ir('resultado')}>Ver el resultado →</BotonGrande>
              <div className="acciones-secundarias">
                <button className="boton-texto" onClick={() => asignar(false)}>↻ Ver el proceso de nuevo</button>
              </div>
            </>
          : <BotonGrande onClick={() => estado === 'listo' && asignar(false)} latir={estado === 'listo'}>
              {estado === 'asignando' ? 'Asignando…' : `▶ Asignar con ${APP_NAME}`}
            </BotonGrande>)}
      </footer>
      <GuiaProceso tipo="matricula" prioridad={presets.find((p) => p.clave === palancas.preset)?.descripcion} />
    </div>
  )
}
