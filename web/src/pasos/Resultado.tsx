import { useMemo } from 'react'
import BotonGrande from '../componentes/BotonGrande'
import TarjetaMetrica from '../componentes/TarjetaMetrica'
import { decimal, dosDecimales, entero } from '../datos'
import { METRICAS, type InfoMetrica } from '../metricas'
import { metricasLocalidad } from '../simulacion'
import { describirPalancas, type PropsPaso } from './tipos'

// Métricas de la localidad (calculadas en vivo con el motor del navegador)
const LOC: (InfoMetrica & { campo: 'pctSinCupo' | 'pctPrimera' | 'pctVulnerablesSinCupo' | 'distanciaKm' })[] = [
  { clave: 'pct_sin_cupo', campo: 'pctSinCupo', etiqueta: 'sin cupo en sus 3 opciones', unidad: '%', mejorSiBaja: true, fmt: decimal },
  { clave: 'pct_primera_opcion', campo: 'pctPrimera', etiqueta: 'en su 1.ª opción', unidad: '%', mejorSiBaja: false, fmt: decimal },
  { clave: 'pct_vulnerables_sin_cupo', campo: 'pctVulnerablesSinCupo', etiqueta: 'de los vulnerables, sin cupo', unidad: '%', mejorSiBaja: true, fmt: decimal },
  { clave: 'distancia_prom_km', campo: 'distanciaKm', etiqueta: 'distancia casa–colegio', unidad: 'km', mejorSiBaja: true, fmt: dosDecimales },
]

/**
 * Paso 3 — Resultado: antes / después en la localidad elegida y en toda Bogotá.
 * (El antes y el después en el mapa se ven en vivo en los pasos Problema y Acción.)
 */
export default function Resultado({ datos, palancas, base, actual, ir, modo, localidad, hoy, politica }: PropsPaso) {
  const loc = localidad ?? 'Suba'
  const m = useMemo(() => ({
    hoy: metricasLocalidad(datos, hoy.pref, hoy.llegada.asign, hoy.llegada.opcion, loc),
    pol: metricasLocalidad(datos, politica.pref, politica.traza.asign, politica.traza.opcion, loc),
  }), [datos, hoy, politica, loc])

  // Lectura en una frase: qué cambió en la localidad
  const epf = datos.familias.estudiantes_por_familia
  const menos = m.hoy.sinCupo - m.pol.sinCupo
  const lectura = menos >= epf
    ? <>Con tu política, <b>{entero(menos)} niños menos</b> se quedan sin cupo en {loc}.</>
    : m.hoy.pctVulnerablesSinCupo - m.pol.pctVulnerablesSinCupo >= 3
      ? <>La prioridad no crea cupos, pero decide quién los recibe: los niños vulnerables sin cupo bajan de
          <b> {decimal(m.hoy.pctVulnerablesSinCupo)}%</b> a <b>{decimal(m.pol.pctVulnerablesSinCupo)}%</b>.</>
      : <>La prioridad no crea cupos: para que quepan más niños en {loc} hay que abrirlos. Prueba un colegio nuevo.</>

  return (
    <div className="pantalla-paso">
      <header className="cabeza cabeza--compacta">
        <h1 className="titulo">Así cambia {loc}</h1>
        <p className="subtitulo">{describirPalancas(datos, palancas)} · comparado con el orden de llegada de hoy</p>
      </header>
      <p className="lectura">{lectura}</p>
      <div className="tarjetas-m tarjetas-m--loc">
        {LOC.map((x, i) => (
          <TarjetaMetrica key={x.campo} info={x} valor={m.pol[x.campo]} base={m.hoy[x.campo]} grande={i === 0} retraso={0.1 * i} />
        ))}
      </div>
      <h2 className="seccion">En toda Bogotá</h2>
      <div className="tarjetas-m tarjetas-m--compactas">
        {METRICAS.map((x, i) => (
          <TarjetaMetrica key={x.clave} info={x} valor={actual.metricas[x.clave]} base={base.metricas[x.clave]} retraso={0.4 + 0.08 * i} />
        ))}
      </div>
      <footer className="pie-acciones">
        {modo !== 'auto' && <BotonGrande onClick={() => ir('supuestos')}>¿Qué supusimos? →</BotonGrande>}
      </footer>
    </div>
  )
}
