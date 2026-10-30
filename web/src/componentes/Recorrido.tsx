/**
 * El formato vertical de los demos (revisión de Paola, 29 oct): una sola columna, sin scroll. Cada
 * pantalla trae titular, visual (el mapa u otro), conclusión y un botón principal; en horizontal, el
 * texto va a la izquierda y el visual a la derecha. Arriba, la marca y «Paso N de 6»; atrás va junto al botón principal. Los
 * detalles (metodología, tablas) se abren en una hoja aparte. Lo usan Matrícula+ y Presupuesto+.
 */
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { BotonInicio, BotonTema, LogoEmpresa, LogoReinicio, NombreApp } from './Marca'
import { ProliMarca } from './Proli'
import ProliActividad, { type Actividad } from './ProliActividad'
import MarcaDeAguaViva from './MarcaDeAguaViva'
import type { Modo } from '../modo'

/** Las piezas de una pantalla. Sin `visual`, en su lugar va el mapa. */
export interface Pantalla {
  titular: ReactNode
  visual?: ReactNode
  /** encima del mapa (p. ej. un selector o una etiqueta) */
  sobreMapa?: ReactNode
  conclusion?: ReactNode
  accion?: ReactNode
  /** botones de texto, discretos, debajo del principal */
  secundarias?: ReactNode
  /** en horizontal, Proli haciendo algo de la pantalla en el espacio libre de la columna de texto */
  actividad?: Actividad
}
/** Una línea de la leyenda del mapa: `clase` pinta la muestra (k-pp--…) */
export interface ItemLeyenda { clase: string; texto: string }

/** «Más de N»: la cifra redondeada hacia abajo a `paso` (655.087 con paso 50.000 → «650.000») */
export const masDe = (n: number, paso: number) => new Intl.NumberFormat('es-CO').format(Math.floor(n / paso) * paso)

export const entrar = (k: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.1 + 0.12 * k, duration: 0.35 } })

export const Boton = ({ children, onClick, proli }: { children: ReactNode; onClick: () => void; proli?: string }) => (
  <button className="boton boton--violeta boton--ancho pp__boton" onClick={onClick} data-proli={proli}>{children}</button>
)

export function CabeceraRecorrido({ paso, total, modo, nombre, reiniciar, alSalir, alPortada }: {
  /** 0 = portada (logos en lugar de los pasos) */
  paso: number
  total: number
  modo: Modo
  nombre: string
  reiniciar: () => void
  alSalir?: () => void
  alPortada?: () => void
}) {
  return (
    <header className="cabecera pp-cabecera">
      {paso === 0 ? (
        <div className="pp-cabecera__logos">
          {alSalir && modo !== 'auto' && <BotonInicio alInicio={alSalir} />}
          <LogoEmpresa alTocar={alPortada} />
          <span className="portada__sep" aria-hidden />
          <span className="marca-bloque"><ProliMarca /><NombreApp nombre={nombre} /></span>
        </div>
      ) : (
        <>
          <LogoReinicio alReiniciar={reiniciar} alReiniciarTodo={alSalir} nombre={nombre} />
          <div className="pasos" aria-label={`Paso ${paso} de ${total}`}>
            <span className="pasos__texto">Paso {paso} de {total}</span>
            <span className="pasos__puntos" aria-hidden>
              {Array.from({ length: total }, (_, i) => <i key={i} className={i + 1 === paso ? 'actual' : i + 1 < paso ? 'hecho' : ''} />)}
            </span>
          </div>
        </>
      )}
      {modo === 'escritorio' && <BotonTema />}
    </header>
  )
}

/** Titular, visual (el mapa, con su leyenda debajo, u otro), conclusión y acción */
export function EscenaRecorrido({ vista, p, mapa, leyenda, atras, alTocar, fondoVivo }: {
  vista: string
  p: Pantalla
  mapa: ReactNode
  leyenda?: ItemLeyenda[]
  /** el botón de atrás, al lado del principal (sin él, solo el principal) */
  atras?: () => void
  /** en horizontal: la marca de agua viva de Proliferante detrás del visual */
  fondoVivo?: boolean
  /** tocar cualquier parte (la portada del stand) */
  alTocar?: () => void
}) {
  return (
    <main className={`pp pp--${vista} ${p.visual ? 'pp--visual-propio' : ''}`} onClick={alTocar}>
      <AnimatePresence mode="wait">
        <motion.div key={vista} className="pp__titular" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {p.titular}
        </motion.div>
      </AnimatePresence>
      <div className="pp__visual">
        {fondoVivo && <MarcaDeAguaViva />}
        <div className="pp__mapa">{mapa}</div>
        {!p.visual && leyenda && leyenda.length > 0 && (
          <div className="pp__leyenda">
            {leyenda.map((x) => <span key={x.texto}><i className={`k-pp ${x.clase}`} />{x.texto}</span>)}
          </div>
        )}
        <AnimatePresence>
          {p.visual && (
            <motion.div key={vista} className="pp__visual-propio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              {p.visual}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={vista} className="pp__conclusion" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: 0.1 }}>
          {p.conclusion}
        </motion.div>
      </AnimatePresence>
      <div className="pp__escena">{p.actividad && <ProliActividad key={vista} tipo={p.actividad} />}</div>
      <div className="pp__accion">
        {atras ? (
          <div className="pp__fila">
            <button type="button" className="boton boton--claro pp__atras" onClick={atras} title="Atrás" aria-label="Atrás">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
            {p.accion}
          </div>
        ) : p.accion}
        {p.secundarias}
      </div>
    </main>
  )
}

/** Un detalle opcional: sube desde abajo y aquí sí hay scroll */
export function HojaRecorrido({ abierta, cerrar, children }: { abierta: boolean; cerrar: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {abierta && (
        <motion.div className="hoja" role="dialog" aria-modal="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="hoja__fondo" onClick={cerrar} />
          <motion.section className="hoja__panel" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ duration: 0.25 }}>
            <button className="hoja__cerrar" onClick={cerrar} aria-label="Cerrar">✕</button>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
