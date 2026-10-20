import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'
import { entero } from '../datos'

interface Props {
  valor: number
  formato?: (n: number) => string
  duracion?: number
  retraso?: number
  /** valor inicial del conteo (p. ej. la cifra de hoy) */
  desde?: number
}

/** Cifra que cuenta desde su valor anterior hasta el nuevo. */
export default function Contador({ valor, formato = entero, duracion = 1.4, retraso = 0, desde = 0 }: Props) {
  const [mostrado, setMostrado] = useState(desde)
  const anterior = useRef(desde)
  useEffect(() => {
    const ctrl = animate(anterior.current, valor, {
      duration: duracion,
      delay: retraso,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (x) => { anterior.current = x; setMostrado(x) },
    })
    return () => ctrl.stop()
  }, [valor, duracion, retraso])
  return <span className="tabular">{formato(mostrado)}</span>
}
