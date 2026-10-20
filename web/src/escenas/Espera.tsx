import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import BotonGrande from '../componentes/BotonGrande'
import { NombreApp } from '../componentes/Marca'
import type { PropsEscena } from './tipos'

/** Modo espera (attract loop): mapa respirando y frases gancho rotando. */
export default function Espera({ datos, ir, modo }: PropsEscena) {
  const { localidad_foco, localidad_mayor_superavit, localidades } = datos.resumen
  const frases = useMemo(() => {
    // Las frases con nombres de localidades solo se muestran si los datos las respaldan
    const estado = (n: string) => localidades.find((l) => l.localidad === n)?.estado
    const conDatos = [`En ${localidad_foco} faltan cupos. En ${localidad_mayor_superavit} sobran.`]
    if (estado('Suba') === 'deficit' && estado('Usme') === 'superavit' && localidad_foco !== 'Suba') {
      conDatos.push('En Suba faltan cupos. En Usme sobran.')
    }
    return [
      conDatos[0],
      '¿Y si ningún niño se quedara sin cupo por llegar tarde?',
      'Hay cupos. Pero no donde vive la gente.',
      ...conDatos.slice(1),
    ]
  }, [localidad_foco, localidad_mayor_superavit, localidades])
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % frases.length), 4200)
    return () => clearInterval(id)
  }, [frases.length])

  return (
    <div className="escena escena--espera" onClick={() => ir('problema')}>
      <header className="arriba">
        <NombreApp className="marca-grande" />
        <div className="frase-caja">
          <AnimatePresence mode="wait">
            <motion.h1
              key={i}
              className="frase"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              {frases[i]}
            </motion.h1>
          </AnimatePresence>
        </div>
      </header>
      <footer className="abajo">
        <div className="leyenda">
          <span><i className="punto punto--deficit" />Faltan cupos</span>
          <span><i className="punto punto--superavit" />Sobran cupos</span>
          <span><i className="punto punto--colegio" />Colegio oficial</span>
        </div>
        {modo !== 'auto' && <BotonGrande latir onClick={() => ir('problema')}>Tocar para empezar</BotonGrande>}
      </footer>
    </div>
  )
}
