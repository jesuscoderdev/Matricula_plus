import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { APP_NAME, TITULO_SIMULADOR } from '../config'
import { Cruz, IconoApp } from './Marca'

/**
 * Animación de entrada (sigue a la pantalla de carga, con su mismo fondo): el icono M+ queda
 * arriba, aparece la cruz y luego las letras de "Matrícula" una a una, empujándola hacia la
 * derecha hasta formar "Matrícula+". Se puede saltar tocando la pantalla. Con "reducir
 * movimiento" se muestra el nombre directo.
 */
const RETRASO_LETRAS = 0.75   // s que el "+" está solo
const PASO_LETRA = 0.075      // s entre letras
const PAUSA_FINAL = 0.9       // s con el nombre completo antes de salir

export default function Intro({ alTerminar }: { alTerminar: () => void }) {
  const reducir = useReducedMotion()
  const termina = APP_NAME.endsWith('+')
  const palabra = termina ? APP_NAME.slice(0, -1) : APP_NAME
  const letras = [...palabra]
  const [visibles, setVisibles] = useState(reducir ? letras.length : 0)
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    const timers: number[] = []
    if (!reducir) {
      letras.forEach((_, i) => timers.push(window.setTimeout(() => setVisibles(i + 1), (RETRASO_LETRAS + i * PASO_LETRA) * 1000)))
    }
    const total = reducir ? 0.8 : RETRASO_LETRAS + letras.length * PASO_LETRA + PAUSA_FINAL
    timers.push(window.setTimeout(() => setSaliendo(true), total * 1000))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence onExitComplete={alTerminar}>
      {!saliendo && (
        <motion.div
          className="intro"
          onPointerDown={() => setSaliendo(true)}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
        >
          <motion.div initial={false} animate={reducir ? {} : { scale: [1, 1.06, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>
            <IconoApp />
          </motion.div>
          <div className="intro__marca" aria-label={APP_NAME}>
            <AnimatePresence>
              {letras.slice(0, visibles).map((l, i) => (
                <motion.span
                  key={i}
                  layout
                  className="intro__letra"
                  initial={{ opacity: 0, y: '0.35em', filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  {l}
                </motion.span>
              ))}
            </AnimatePresence>
            {termina && (
              <motion.span
                layout
                className="intro__mas"
                initial={reducir ? false : { scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{
                  scale: { type: 'spring', stiffness: 260, damping: 14 },
                  rotate: { duration: 0.55, ease: 'easeOut' },
                  layout: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                }}
              >
                <Cruz />
              </motion.span>
            )}
          </div>
          <motion.p
            className="intro__lema"
            initial={{ opacity: 0 }}
            animate={{ opacity: visibles === letras.length ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          >
            {TITULO_SIMULADOR}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
