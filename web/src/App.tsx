import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MapaBogota, { type FaseMapa } from './mapa/MapaBogota'
import { cargarDatos, type Datos } from './datos'
import { SEGUNDOS_INACTIVIDAD } from './config'
import { esTotem, leerModo } from './modo'
import type { EscenaId, PropsEscena } from './escenas/tipos'
import Espera from './escenas/Espera'
import Problema from './escenas/Problema'
import { AsignarHoy, AsignarMatricula } from './escenas/Asignar'
import ComoLoHicimos from './escenas/ComoLoHicimos'
import Cierre from './escenas/Cierre'
import BarraInferior, { type Pestana } from './movil/BarraInferior'
import MiLocalidad from './movil/MiLocalidad'
import DetalleUPZ from './movil/DetalleUPZ'
import AgendarCita from './movil/AgendarCita'

const ESCENAS: Record<EscenaId, ComponentType<PropsEscena>> = {
  espera: Espera, problema: Problema, hoy: AsignarHoy, matricula: AsignarMatricula, como: ComoLoHicimos, cierre: Cierre,
}

// Qué muestra el mapa detrás de cada escena y cuánto espacio dejan libre los textos
const MAPA: Record<EscenaId, { fase: FaseMapa; arriba: number; abajo: number }> = {
  espera: { fase: 'espera', arriba: 0.3, abajo: 0.2 },
  problema: { fase: 'problema', arriba: 0.42, abajo: 0.2 },
  hoy: { fase: 'hoy', arriba: 0.44, abajo: 0.16 },
  matricula: { fase: 'matricula', arriba: 0.44, abajo: 0.24 },
  como: { fase: 'matricula', arriba: 0.44, abajo: 0.24 },
  cierre: { fase: 'matricula', arriba: 0.44, abajo: 0.24 },
}

// Recorrido automático (?modo=auto): ~50 s por vuelta
const DURACION_AUTO: Record<EscenaId, number> = {
  espera: 7, problema: 7, hoy: 9, matricula: 10, como: 9, cierre: 8,
}
const SIGUIENTE: Record<EscenaId, EscenaId> = {
  espera: 'problema', problema: 'hoy', hoy: 'matricula', matricula: 'como', como: 'cierre', cierre: 'espera',
}

export default function App() {
  const modo = useMemo(leerModo, [])
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [escena, setEscena] = useState<EscenaId>('espera')
  const [localidad, setLocalidad] = useState<string>('')
  const [vuelta, setVuelta] = useState(0)
  // Solo celular
  const [pestana, setPestana] = useState<Pestana>('recorrido')
  const [upz, setUpz] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.dataset.modo = modo
    cargarDatos()
      .then((d) => { setDatos(d); setLocalidad(d.resumen.localidad_foco) })
      .catch((e) => setError(String(e.message ?? e)))
  }, [modo])

  // Localidades que rotan en modo auto: las que más niños dejan sin cupo hoy
  const rotacion = useMemo(() => {
    if (!datos) return []
    return [...datos.resumen.localidades].sort((a, b) => b.hoy.sin_cupo - a.hoy.sin_cupo).slice(0, 4).map((l) => l.localidad)
  }, [datos])

  const ir = useCallback((e: EscenaId) => {
    if (e === 'espera' && datos && esTotem(modo)) setLocalidad(datos.resumen.localidad_foco)
    setEscena(e)
  }, [datos, modo])

  // Modo auto: avanza solo y cambia de localidad en cada vuelta
  useEffect(() => {
    if (modo !== 'auto' || !datos) return
    const id = setTimeout(() => {
      const sig = SIGUIENTE[escena]
      if (sig === 'espera') {
        const v = vuelta + 1
        setVuelta(v)
        setLocalidad(rotacion[v % rotacion.length])
      }
      setEscena(sig)
    }, DURACION_AUTO[escena] * 1000)
    return () => clearTimeout(id)
  }, [modo, escena, datos, vuelta, rotacion])

  // Modo stand: si nadie toca la pantalla en N segundos, vuelve al modo espera
  useEffect(() => {
    if (modo !== 'stand' || escena === 'espera') return
    let id = setTimeout(() => ir('espera'), SEGUNDOS_INACTIVIDAD * 1000)
    const reiniciar = () => {
      clearTimeout(id)
      id = setTimeout(() => ir('espera'), SEGUNDOS_INACTIVIDAD * 1000)
    }
    window.addEventListener('pointerdown', reiniciar)
    return () => { clearTimeout(id); window.removeEventListener('pointerdown', reiniciar) }
  }, [modo, escena, ir])

  // El tótem no debe abrir menús contextuales ni hacer zoom con gestos
  useEffect(() => {
    if (!esTotem(modo)) return
    const bloquear = (e: Event) => e.preventDefault()
    window.addEventListener('contextmenu', bloquear)
    window.addEventListener('gesturestart', bloquear)
    return () => { window.removeEventListener('contextmenu', bloquear); window.removeEventListener('gesturestart', bloquear) }
  }, [modo])

  if (error) return <div className="app"><div className="mensaje-error">{error}</div></div>
  if (!datos) return <div className="app"><div className="cargando">Cargando…</div></div>

  const Escena = ESCENAS[escena]
  const m = MAPA[escena]
  const puedeTocarMapa = modo !== 'auto' && (escena === 'problema' || escena === 'hoy' || escena === 'matricula')

  const recorrido = (
    <>
      <MapaBogota
        datos={datos}
        fase={m.fase}
        localidad={localidad}
        margenArriba={m.arriba}
        margenAbajo={m.abajo}
        onTocarLocalidad={puedeTocarMapa ? setLocalidad : undefined}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={escena}
          className="capa-escena"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Escena datos={datos} localidad={localidad} modo={modo} ir={ir} alAgendar={() => setPestana('agendar')} />
        </motion.div>
      </AnimatePresence>
    </>
  )

  const sello = datos.resumen.fuente === 'sintetica' && <div className="sello">Datos sintéticos</div>

  // --- Tótem: solo el recorrido, pantalla completa ---
  if (esTotem(modo)) return <div className="app">{recorrido}{sello}</div>

  // --- Celular: recorrido + "Mi localidad" + "Agendar", con barra inferior ---
  const cambiarPestana = (p: Pestana) => {
    setPestana(p)
    setUpz(null)
  }
  return (
    <div className="app app--celular">
      <main className="vista">
        {pestana === 'recorrido' && <>{recorrido}{sello}</>}
        {pestana === 'localidad' && !upz && (
          <MiLocalidad datos={datos} localidad={localidad} setLocalidad={setLocalidad} onVerUpz={setUpz} />
        )}
        {pestana === 'localidad' && upz && (
          <DetalleUPZ key={upz} datos={datos} codigo={upz} onVolver={() => setUpz(null)} onVerUpz={setUpz} />
        )}
        {pestana === 'agendar' && <AgendarCita />}
      </main>
      <BarraInferior actual={pestana} cambiar={cambiarPestana} />
    </div>
  )
}
