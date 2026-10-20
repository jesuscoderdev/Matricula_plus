import { useMemo } from 'react'
import { decimal, entero } from '../datos'
import type { PropsCapitulo } from './tipos'

export interface PropsExplorar extends PropsCapitulo {
  upz: string | null
  setUpz: (c: string | null) => void
  coloreo: 'hoy' | 'pol'
  setColoreo: (c: 'hoy' | 'pol') => void
}

/** Explorar el mapa: cualquier UPZ, hoy y con la política elegida. */
export default function Explorar({ datos, r, upz, setUpz, coloreo, setColoreo, elegirLocalidad, ir }: PropsExplorar) {
  const epf = datos.familias.estudiantes_por_familia
  const ninos = useMemo(() => {
    const n = new Float64Array(datos.indice.upz.length)
    for (const u of datos.familias.upz) n[u] += epf
    return n
  }, [datos, epf])
  const peores = useMemo(() => datos.upz.features
    .map((f) => f.properties)
    .filter((p) => ninos[datos.posUpz[p.codigo]] >= 200)
    .sort((a, b) => r.upzHoy[datos.posUpz[b.codigo]] - r.upzHoy[datos.posUpz[a.codigo]])
    .slice(0, 8), [datos, r, ninos])

  const sel = upz ? datos.upz.features.find((f) => f.properties.codigo === upz)?.properties : null
  const i = sel ? datos.posUpz[sel.codigo] : -1
  const toggle = (
    <div className="segmentos">
      <button className={`segmento ${coloreo === 'hoy' ? 'segmento--activo' : ''}`} onClick={() => setColoreo('hoy')}>Hoy</button>
      <button className={`segmento ${coloreo === 'pol' ? 'segmento--activo' : ''}`} onClick={() => setColoreo('pol')}>Con Matrícula+</button>
    </div>
  )

  if (!sel) {
    return (
      <div className="panel">
        <header className="panel__cabeza">
          <span className="kicker">Explorar</span>
          <h1 className="display">Bogotá, <em>UPZ por UPZ</em></h1>
          <p className="lead">El color es la parte de los niños nuevos que no queda en ninguno de sus colegios. Toca una UPZ.</p>
        </header>
        {toggle}
        <div className="grupo">
          <div className="grupo__titulo"><b>Donde más falta cupo hoy</b><span>% fuera de sus opciones</span></div>
          <div className="caso-lista">
            {peores.map((p) => (
              <button key={p.codigo} className="caso-colegio" onClick={() => setUpz(p.codigo)}>
                <span className="caso-colegio__n">{p.zona_critica ? '!' : ''}</span>
                <span>{p.nombre} <small>· {p.localidad}</small></span>
                <small>{decimal(r.upzHoy[datos.posUpz[p.codigo]])}% → {decimal(r.upzPol[datos.posUpz[p.codigo]])}%</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <header className="panel__cabeza">
        <span className="kicker">Explorar · {sel.localidad}</span>
        <h1 className="display">{sel.nombre}</h1>
        {sel.zona_critica && <span className="estado estado--sin">Zona crítica · insuficiencia muy alta (SED)</span>}
      </header>
      <div className="datos-linea">
        <div><b>{entero(ninos[i])}</b><span>niños nuevos (modelo)</span></div>
        <div><b>{entero(sel.cupos)}</b><span>cupos en la UPZ</span></div>
        <div><b>{Math.round(100 * sel.cupos_por_solicitud)}</b><span>cupos por cada 100 solicitudes</span></div>
      </div>
      <div className="comparacion">
        <div className="comparacion__cabeza"><span>Fuera de sus opciones</span><span>Hoy</span><span>Matrícula+</span></div>
        <div className="metrica metrica--destacada">
          <span className="metrica__nombre">Niños que viven aquí</span>
          <span className="metrica__v">{decimal(r.upzHoy[i])}%</span>
          <span className="metrica__v metrica__v--pol">{decimal(r.upzPol[i])}%</span>
        </div>
      </div>
      {toggle}
      <div className="panel__pie">
        <button className="boton boton--violeta boton--ancho" onClick={() => { elegirLocalidad(sel.localidad); ir('problema') }}>
          Ver el proceso en {sel.localidad} →
        </button>
        <button className="boton-texto" onClick={() => setUpz(null)}>← Todas las UPZ</button>
      </div>
    </div>
  )
}
