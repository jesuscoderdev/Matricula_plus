import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cargarDatos, resultado, resultadoBase, type Datos, type Palancas } from './datos'
import { DURACION_PASOS, SEGUNDOS_INACTIVIDAD } from './config'
import { esTotem, leerModo, modoAutomatico, type Modo } from './modo'
import BarraProgreso, { PASOS, type PasoId } from './componentes/BarraProgreso'
import { LogoReinicio } from './componentes/Marca'
import Intro from './componentes/Intro'
import type { PropsPaso } from './pasos/tipos'
import { describirPalancas } from './pasos/tipos'
import { useSimHoy, useSimPolitica } from './simulacion'
import Espera from './pasos/Espera'
import Problema from './pasos/Problema'
import Accion from './pasos/Accion'
import Resultado from './pasos/Resultado'
import Supuestos from './pasos/Supuestos'
import Metodo from './pasos/Metodo'
import Inicio from './pasos/Inicio'
import BarraInferior, { type Pestana } from './movil/BarraInferior'
import MiLocalidad from './movil/MiLocalidad'
import DetalleUPZ from './movil/DetalleUPZ'
import AgendarCita from './movil/AgendarCita'

type Vista = 'espera' | PasoId
const PANTALLAS: Record<Vista, ComponentType<PropsPaso>> = {
  espera: Espera, problema: Problema, accion: Accion, resultado: Resultado, supuestos: Supuestos, metodo: Metodo,
}
const PALANCAS_INICIALES: Palancas = { preset: 'cercania', colegioNuevo: null, jornadaUnica: false }

// Modo automático: en cada vuelta se elige otra localidad y se "mueven" otras palancas.
// En Problema se toca la localidad; en Acción se cambian las palancas y se aprieta ▶ Asignar.
const GUIONES: { localidad: string; cambios: { segundo: number; cambio: Partial<Palancas> }[] }[] = [
  { localidad: 'Suba', cambios: [{ segundo: 2, cambio: { preset: 'equidad' } }, { segundo: 4, cambio: { colegioNuevo: 'tibabuyes' } }] },
  { localidad: 'Kennedy', cambios: [{ segundo: 2, cambio: { preset: 'familias' } }, { segundo: 4, cambio: { jornadaUnica: true } }] },
  { localidad: 'Ciudad Bolívar', cambios: [{ segundo: 2, cambio: { preset: 'equidad' } }, { segundo: 4, cambio: { colegioNuevo: 'ciudad_bolivar' } }] },
  { localidad: 'Bosa', cambios: [{ segundo: 2, cambio: { preset: 'equidad' } }, { segundo: 4, cambio: { colegioNuevo: 'bosa' } }] },
]
const SEGUNDO_ELEGIR_LOCALIDAD = 1.5
const SEGUNDO_ASIGNAR = 5.5

export default function App() {
  const [modo, setModo] = useState<Modo>(leerModo)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  // El tótem arranca en la pantalla de espera; celular y PC, en la pantalla de inicio
  const [vista, setVista] = useState<Vista>(esTotem(modo) ? 'espera' : 'problema')
  const [palancas, setPalancas] = useState<Palancas>(PALANCAS_INICIALES)
  const [vuelta, setVuelta] = useState(0)
  // Animación de entrada al abrir la web
  const [intro, setIntro] = useState(true)
  // Solo celular y PC
  const [pestana, setPestana] = useState<Pestana>('inicio')
  const [localidad, setLocalidad] = useState<string | null>(null)
  const [disparoAuto, setDisparoAuto] = useState(0)
  const [upz, setUpz] = useState<string | null>(null)

  useEffect(() => {
    cargarDatos().then(setDatos).catch((e) => setError(String(e.message ?? e)))
  }, [])
  useEffect(() => { document.documentElement.dataset.modo = modo }, [modo])
  // Sin ?modo= en la URL, la vista sigue el tamaño de la ventana (PC ↔ celular)
  useEffect(() => {
    if (!modoAutomatico()) return
    const alCambiar = () => setModo(leerModo())
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])

  const reiniciar = useCallback(() => {
    setPalancas(PALANCAS_INICIALES)
    setLocalidad(null)
    setVista(esTotem(modo) ? 'espera' : 'problema')
    setPestana('inicio')
    setUpz(null)
  }, [modo])
  const ir = useCallback((v: Vista) => (v === 'espera' ? reiniciar() : setVista(v)), [reiniciar])
  const cambiarPalancas = useCallback((c: Partial<Palancas>) => setPalancas((p) => ({ ...p, ...c })), [])

  // Kiosco táctil: sin interacción en N segundos, vuelve al inicio
  useEffect(() => {
    if (modo !== 'stand' || vista === 'espera') return
    let id = window.setTimeout(reiniciar, SEGUNDOS_INACTIVIDAD * 1000)
    const tocar = () => { window.clearTimeout(id); id = window.setTimeout(reiniciar, SEGUNDOS_INACTIVIDAD * 1000) }
    window.addEventListener('pointerdown', tocar)
    return () => { window.clearTimeout(id); window.removeEventListener('pointerdown', tocar) }
  }, [modo, vista, reiniciar])

  // Modo automático: recorre los 5 pasos con sus tiempos y mueve palancas en el paso Acción
  useEffect(() => {
    if (modo !== 'auto' || !datos || intro) return
    const orden: Vista[] = ['espera', ...PASOS.map((p) => p.id)]
    const dur = vista === 'espera' ? 5 : DURACION_PASOS[vista]
    const timers: number[] = []
    const guion = GUIONES[vuelta % GUIONES.length]
    if (vista === 'problema') {
      timers.push(window.setTimeout(() => setLocalidad(guion.localidad), SEGUNDO_ELEGIR_LOCALIDAD * 1000))
    }
    if (vista === 'accion') {
      for (const g of guion.cambios) timers.push(window.setTimeout(() => cambiarPalancas(g.cambio), g.segundo * 1000))
      timers.push(window.setTimeout(() => setDisparoAuto((x) => x + 1), SEGUNDO_ASIGNAR * 1000))
    }
    timers.push(window.setTimeout(() => {
      const sig = orden[(orden.indexOf(vista) + 1) % orden.length]
      if (sig === 'espera') { setVuelta((v) => v + 1); setPalancas(PALANCAS_INICIALES); setLocalidad(null) }
      setVista(sig)
    }, dur * 1000))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [modo, vista, datos, vuelta, cambiarPalancas, intro])

  // El tótem no abre menús contextuales ni hace zoom con gestos
  useEffect(() => {
    if (!esTotem(modo)) return
    const bloquear = (e: Event) => e.preventDefault()
    window.addEventListener('contextmenu', bloquear)
    window.addEventListener('gesturestart', bloquear)
    return () => { window.removeEventListener('contextmenu', bloquear); window.removeEventListener('gesturestart', bloquear) }
  }, [modo])

  const base = useMemo(() => (datos ? resultadoBase(datos) : null), [datos])
  const actual = useMemo(() => (datos ? resultado(datos, palancas) : null), [datos, palancas])
  // El proceso corrido en el navegador (para animarlo en la localidad)
  const hoy = useSimHoy(datos)
  const politica = useSimPolitica(datos, palancas)

  // La animación de entrada va siempre en la misma posición del árbol, así no se reinicia
  // cuando terminan de cargar los datos.
  const entrada = intro && <Intro alTerminar={() => setIntro(false)} />
  if (error || !datos || !base || !actual || !hoy || !politica) {
    return (
      <div className="app">
        <>{error ? <div className="mensaje-error">{error}</div> : !intro && <div className="cargando">Cargando…</div>}</>
        {entrada}
      </div>
    )
  }

  const Pantalla = PANTALLAS[vista]
  const supuestosCortos = `Familias sintéticas, sin datos personales · ${datos.indice.supuestos.corte} · distancia en línea recta`
  const flujo = (
    <div className="flujo">
      <div className="barra-superior">
        <LogoReinicio alReiniciar={reiniciar} />
        {vista !== 'espera' && <BarraProgreso actual={vista} ir={modo === 'auto' ? undefined : ir} />}
      </div>
      <div className="flujo__cuerpo">
        <AnimatePresence mode="wait">
          <motion.div key={vista} className="capa-paso" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <Pantalla datos={datos} modo={modo} palancas={palancas} cambiarPalancas={cambiarPalancas}
                      base={base} actual={actual} hoy={hoy} politica={politica}
                      localidad={localidad} elegirLocalidad={setLocalidad} disparoAuto={disparoAuto}
                      ir={ir} alAgendar={() => setPestana('agendar')} />
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Supuestos siempre visibles */}
      <div className="pie-supuestos">{supuestosCortos}{datos.indice.fuente === 'sintetica' && ' · DATOS SINTÉTICOS'}</div>
    </div>
  )

  if (esTotem(modo)) return <div className="app"><>{flujo}</>{entrada}</div>

  // --- Celular y PC: inicio + recorrido + explorar el mapa + agendar ---
  const abrirRecorrido = () => { setVista('problema'); setPestana('recorrido') }
  return (
    <div className={`app app--celular ${modo === 'escritorio' ? 'app--escritorio' : ''}`}>
      <>
      <main className="vista">
        {pestana === 'inicio' && (
          <Inicio datos={datos} base={base} alRecorrido={abrirRecorrido}
                  alExplorar={() => setPestana('localidad')} alAgendar={() => setPestana('agendar')} />
        )}
        {pestana === 'recorrido' && flujo}
        {pestana === 'localidad' && !upz && (
          <MiLocalidad datos={datos} localidad={localidad ?? 'Suba'} setLocalidad={setLocalidad} base={base} actual={actual}
                       resumenPolitica={describirPalancas(datos, palancas)} onVerUpz={setUpz} />
        )}
        {pestana === 'localidad' && upz && (
          <DetalleUPZ key={upz} datos={datos} codigo={upz} base={base} actual={actual}
                      onVolver={() => setUpz(null)} onVerUpz={setUpz} />
        )}
        {pestana === 'agendar' && <AgendarCita />}
      </main>
      <BarraInferior actual={pestana} cambiar={(p) => { setPestana(p); setUpz(null) }} />
      </>
      {entrada}
    </div>
  )
}
