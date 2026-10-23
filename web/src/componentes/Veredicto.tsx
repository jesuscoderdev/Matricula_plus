import type { ReactNode } from 'react'

export type Tono = 'mejor' | 'peor' | 'igual'

/**
 * El resultado en grande, para que se entienda de un vistazo: una cifra (en niños o en siniestros,
 * nunca solo en porcentajes), qué significa en una frase, de dónde a dónde cambia y una nota honesta
 * con lo que la cifra no dice. Fondo navy y cifra en el verde del foco, como pide el manual.
 */
export default function Veredicto({ etiqueta, cifra, frase, antes, despues, nota, tono = 'mejor' }: {
  etiqueta: ReactNode
  cifra: ReactNode
  frase: ReactNode
  antes?: { etiqueta: ReactNode; valor: ReactNode }
  despues?: { etiqueta: ReactNode; valor: ReactNode }
  nota?: ReactNode
  tono?: Tono
}) {
  return (
    <section className={`veredicto veredicto--${tono}`} aria-live="polite">
      <span className="veredicto__etiqueta">{etiqueta}</span>
      <div className="veredicto__principal">
        <span className="veredicto__cifra">{cifra}</span>
        <span className="veredicto__frase">{frase}</span>
      </div>
      {antes && despues && (
        <div className="veredicto__de-a">
          <span><small>{antes.etiqueta}</small><b>{antes.valor}</b></span>
          <i aria-hidden>→</i>
          <span><small>{despues.etiqueta}</small><b>{despues.valor}</b></span>
        </div>
      )}
      {nota && <p className="veredicto__nota">{nota}</p>}
    </section>
  )
}
