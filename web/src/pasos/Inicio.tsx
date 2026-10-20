import { motion } from 'framer-motion'
import { NombreApp } from '../componentes/Marca'
import Proli from '../componentes/Proli'
import { TITULO_SIMULADOR } from '../config'
import { entero, type Datos, type Resultado } from '../datos'
import { urlModo } from '../modo'

interface Props {
  datos: Datos
  base: Resultado
  /** abre el recorrido guiado (paso Problema) */
  alRecorrido: () => void
  /** abre el explorador del mapa por localidad */
  alExplorar: () => void
  alAgendar: () => void
}

/** Pantalla de inicio (celular y PC): qué es y accesos directos. El tótem usa la pantalla de espera. */
export default function Inicio({ datos, base, alRecorrido, alExplorar, alAgendar }: Props) {
  const par = datos.indice.parametros as { cupos_nuevos_total: number; demanda_nuevos_total: number }
  const por100 = Math.round((100 * par.cupos_nuevos_total) / par.demanda_nuevos_total)
  const accesos = [
    { icono: '01', titulo: 'Recorrido guiado', texto: 'Elige tu localidad y mira cómo se asignan los cupos hoy y con Matrícula+. Unos 60 segundos.', accion: alRecorrido, principal: true },
    { icono: '02', titulo: 'Explorar el mapa', texto: 'Recorre Bogotá por localidad y UPZ: cupos, demanda y niños sin cupo.', accion: alExplorar },
    { icono: '03', titulo: 'Agendar una cita', texto: 'Lo probamos con los datos de tu entidad.', accion: alAgendar },
  ]
  return (
    <div className="pantalla inicio">
      <section className="inicio__portada">
        <div className="inicio__textos">
          <span className="kicker">Proliferante · Demo de educación · GovTech 2026</span>
          <NombreApp className="inicio__marca" />
          <h1 className="titulo inicio__titulo">{TITULO_SIMULADOR}</h1>
          <p className="subtitulo">Simulador de asignación de cupos en colegios oficiales de Bogotá, construido con datos abiertos.</p>
          <div className="inicio__cifras">
            <div><b>{entero(base.sinCupo)}</b><span>niños nuevos sin cupo hoy</span></div>
            <div><b>{por100}</b><span>cupos por cada 100 que piden</span></div>
            <div><b>{datos.localidades.length}</b><span>localidades para explorar</span></div>
          </div>
        </div>
        <Proli tamano={7} globo={<>Toca <b>Recorrido guiado</b> y te muestro cómo funciona.</>} />
      </section>
      <section className="inicio__accesos">
        {accesos.map((a, i) => (
          <motion.button key={a.titulo} className={`acceso ${a.principal ? 'acceso--principal' : ''}`} onClick={a.accion}
                         initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}>
            <span className="acceso__icono" aria-hidden="true">{a.icono}</span>
            <span className="acceso__titulo">{a.titulo}</span>
            <span className="acceso__texto">{a.texto}</span>
            <span className="acceso__flecha" aria-hidden="true">→</span>
          </motion.button>
        ))}
      </section>
      <section className="inicio__stand">
        <span>Para el stand:</span>
        <a href={urlModo('stand')}>Tótem táctil</a>
        <a href={urlModo('auto')}>Tótem automático</a>
        <a href={urlModo('celular')}>Vista celular</a>
        <a href={urlModo('escritorio')}>Vista PC</a>
      </section>
    </div>
  )
}
