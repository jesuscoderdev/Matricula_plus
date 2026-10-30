/**
 * Una escena animada relacionada con la pantalla (sin Proli: lo pidió David el 30-oct). Solo se ve en
 * horizontal, en el espacio que queda en la columna de texto entre la conclusión y el botón
 * (Recorrido.tsx); si ese espacio es muy bajo, se oculta (container query en estilos.css). Son objetos
 * en SVG con los colores del manual, ilustrativos: no llevan cifras.
 */
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export type Actividad = 'idea' | 'historia' | 'monedas' | 'lupa' | 'intercambio' | 'grafica' | 'calculos' | 'telescopio' | 'ruta' | 'puzzle' | 'acerca' | 'construye'

const V = '#5a44dd', VERDE = '#7bc689', VERDE_OSC = '#3e8e52', NAVY = '#162b2a', AZUL = '#c7d7ec', PIZARRA = '#505b7d'
const siempre = (duracion: number, extra: object = {}) => ({ duration: duracion, repeat: Infinity, ease: 'easeInOut' as const, ...extra })

/** Un pin de mapa (punta abajo en el origen) */
const Pin = ({ color, x = 0, y = 0 }: { color: string; x?: number; y?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M0 0 C -7 -9 -8 -12 -8 -16 A 8 8 0 1 1 8 -16 C 8 -12 7 -9 0 0 Z" fill={color} />
    <circle cx={0} cy={-16} r={3.2} fill="#ffffff" />
  </g>
)

const ESCENAS: Record<Actividad, () => ReactNode> = {
  // Tu reto: alguien cuenta su reto (el globo escribe), los datos viajan y se enciende la idea
  idea: () => {
    const ciclo = (times: number[], extra: object = {}) => siempre(4.2, { times, ...extra })
    return (
      <>
        <path d="M6 22 Q6 14 14 14 L50 14 Q58 14 58 22 L58 44 Q58 52 50 52 L22 52 L12 62 L14 52 Q6 52 6 44 Z" fill={AZUL} />
        {[20, 32, 44].map((x, k) => (
          <motion.circle key={x} cx={x} cy={33} r={3.6} fill={PIZARRA} animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={siempre(0.9, { delay: k * 0.18 })} />
        ))}
        {[0, 1, 2].map((k) => (
          <motion.rect key={k} width={6} height={6} rx={1.5} fill={k === 1 ? VERDE : V}
                       animate={{ x: [56, 72, 84], y: [44 + k * 6, 64 - k * 4, 50], opacity: [0, 1, 0] }}
                       transition={ciclo([0, 0.5, 1], { delay: k * 0.35, ease: 'easeInOut' })} />
        ))}
        <motion.circle cx={94} cy={44} r={22} fill="#f2c94c" animate={{ opacity: [0, 0, 0.35, 0.35, 0], scale: [0.6, 0.6, 1.1, 1.1, 0.6] }}
                       style={{ originX: '94px', originY: '44px' }} transition={ciclo([0, 0.45, 0.6, 0.9, 1])} />
        <motion.path d="M94 26 C 82 26 76 36 80 46 C 82 51 86 53 86 59 L102 59 C 102 53 106 51 108 46 C 112 36 106 26 94 26 Z"
                     stroke={NAVY} strokeWidth={2.5} animate={{ fill: ['#ffffff', '#ffffff', '#f2c94c', '#f2c94c', '#ffffff'] }} transition={ciclo([0, 0.45, 0.6, 0.9, 1])} />
        <rect x={86} y={61} width={16} height={5} rx={1.5} fill={PIZARRA} /><rect x={88} y={68} width={12} height={4} rx={1.5} fill={PIZARRA} />
        {[[94, 14, 94, 8], [72, 26, 67, 21], [116, 26, 121, 21], [70, 46, 64, 46], [118, 46, 124, 46]].map(([x1, y1, x2, y2], k) => (
          <motion.line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c99a1e" strokeWidth={2.5} strokeLinecap="round"
                       animate={{ opacity: [0, 0, 1, 1, 0] }} transition={ciclo([0, 0.5, 0.62, 0.9, 1])} />
        ))}
        <motion.path d="M10 84 L36 84 M10 94 L52 94" stroke={V} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray="1 1"
                     animate={{ strokeDashoffset: [1, 1, 0, 0, 1] }} transition={ciclo([0, 0.6, 0.8, 0.92, 1])} />
        <motion.path d="M62 88 L68 94 L80 82" fill="none" stroke={VERDE_OSC} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
                     animate={{ opacity: [0, 0, 1, 1, 0] }} transition={ciclo([0, 0.75, 0.82, 0.92, 1])} />
      </>
    )
  },
  // La solución (Presupuesto+), en grande: tres años de la misma calle. El último año solo muestra la esquina
  // de la izquierda; la lupa recorre los años anteriores, aparecen los siniestros de la esquina de la derecha
  // y abajo esa esquina se enciende: mirando un solo año se escapaba.
  historia: () => {
    const ciclo = (times: number[], extra: object = {}) => siempre(8, { times, ease: 'easeInOut', ...extra })
    // [x de la tarjeta, puntos en la esquina izquierda, puntos en la derecha, cuándo aparecen los de la derecha]
    const anios: [number, number, number, number][] = [[6, 1, 2, 0.5], [72, 0, 2, 0.3], [138, 2, 0, 0]]
    return (
      <>
        {anios.map(([x, izq, der, aparece], k) => (
          <g key={x}>
            <rect x={x} y={14} width={56} height={62} rx={6} fill={k === 2 ? '#ffffff' : '#eef2f8'} stroke={k === 2 ? V : AZUL} strokeWidth={k === 2 ? 2 : 1.5} />
            <line x1={x + 4} y1={52} x2={x + 52} y2={52} stroke={AZUL} strokeWidth={4} strokeLinecap="round" />
            {[18, 38].map((dx) => <line key={dx} x1={x + dx} y1={22} x2={x + dx} y2={70} stroke={AZUL} strokeWidth={4} strokeLinecap="round" />)}
            {Array.from({ length: izq }, (_, i) => <circle key={`i${i}`} cx={x + 18} cy={42 - i * 9} r={3.6} fill={V} />)}
            {Array.from({ length: der }, (_, i) => (
              <motion.circle key={`d${i}`} cx={x + 38} cy={42 - i * 9} r={3.6} fill={VERDE_OSC}
                             animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.3, 0.3, 1, 1, 0.3] }}
                             transition={ciclo([0, aparece + i * 0.03, aparece + 0.08 + i * 0.03, 0.9, 1])} />
            ))}
            <text x={x + 28} y={88} textAnchor="middle" fontSize={7.5} fontWeight={600} fill={k === 2 ? V : PIZARRA}>{k === 2 ? 'último año' : 'años anteriores'}</text>
          </g>
        ))}
        {/* la lupa: empieza en el último año y recorre hacia atrás */}
        <motion.g animate={{ x: [132, 132, 66, 0, 0, 132], opacity: [0, 1, 1, 1, 1, 0] }} transition={ciclo([0, 0.1, 0.32, 0.52, 0.85, 1])}>
          <circle cx={34} cy={45} r={21} fill="rgba(123,198,137,0.14)" stroke={NAVY} strokeWidth={3} />
          <line x1={49} y1={60} x2={58} y2={70} stroke={NAVY} strokeWidth={5} strokeLinecap="round" />
        </motion.g>
        {/* abajo, la calle con las dos esquinas: la de la derecha se enciende */}
        <line x1={24} y1={134} x2={176} y2={134} stroke={AZUL} strokeWidth={5} strokeLinecap="round" />
        <Pin color={V} x={72} y={132} />
        <motion.g animate={{ scale: [1, 1, 1.25, 1.25, 1], opacity: [0.35, 0.35, 1, 1, 0.35] }} style={{ originX: '128px', originY: '132px' }}
                  transition={ciclo([0, 0.6, 0.68, 0.9, 1])}>
          <Pin color={VERDE_OSC} x={128} y={132} />
        </motion.g>
        <motion.path d="M138 104 L143 109 L152 99" fill="none" stroke={VERDE_OSC} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                     animate={{ opacity: [0, 0, 1, 1, 0] }} transition={ciclo([0, 0.66, 0.72, 0.9, 1])} />
      </>
    )
  },
  // El problema (Presupuesto+): pocas monedas, muchos lugares; caen sobre un punto distinto cada vez
  monedas: () => (
    <>
      {[25, 60, 95].map((x) => <Pin key={x} color={AZUL} x={x} y={88} />)}
      {[25, 60, 95].map((x, k) => (
        <motion.g key={x} initial={{ y: -20, opacity: 0 }} animate={{ y: [-20, 52, 52], opacity: [0, 1, 0] }}
                  transition={siempre(1.6, { delay: k * 1.6, repeatDelay: 3.2, times: [0, 0.55, 1] })}>
          <circle cx={x} cy={14} r={7} fill="#f2c94c" stroke="#c99a1e" strokeWidth={1.5} />
          <text x={x} y={17.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#8a6510">$</text>
        </motion.g>
      ))}
    </>
  ),
  // La solución (Presupuesto+): la lupa mira hacia atrás, los años anteriores
  lupa: () => (
    <>
      {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={12 + k * 20} y={90 - [26, 34, 18, 30, 44][k]} width={13} height={[26, 34, 18, 30, 44][k]} rx={2} fill={k === 4 ? V : AZUL} />)}
      <motion.g animate={{ x: [80, 0, 80] }} transition={siempre(4.5)}>
        <circle cx={18} cy={40} r={14} fill="rgba(123,198,137,0.18)" stroke={NAVY} strokeWidth={3} />
        <line x1={28} y1={50} x2={38} y2={62} stroke={NAVY} strokeWidth={5} strokeLinecap="round" />
      </motion.g>
    </>
  ),
  // Antes y después (Presupuesto+): sale un punto morado, entra uno verde
  intercambio: () => (
    <>
      <Pin color={PIZARRA} x={30} y={88} />
      <motion.g animate={{ x: [0, 0, -40, -40, 0], opacity: [1, 1, 0, 0, 1] }} transition={siempre(4, { times: [0, 0.3, 0.5, 0.9, 1] })}><Pin color={V} x={60} y={88} /></motion.g>
      <motion.g animate={{ x: [40, 40, 0, 0, 40], opacity: [0, 0, 1, 1, 0] }} transition={siempre(4, { times: [0, 0.4, 0.6, 0.9, 1] })}><Pin color={VERDE_OSC} x={90} y={88} /></motion.g>
      <motion.path d="M48 40 Q 70 20 92 40" fill="none" stroke={VERDE_OSC} strokeWidth={2.5} strokeDasharray="4 4" animate={{ strokeDashoffset: [16, 0] }} transition={siempre(0.8, { ease: 'linear' })} />
    </>
  ),
  // Resultados (Presupuesto+): la barra verde supera a la morada
  grafica: () => (
    <>
      <line x1={10} y1={92} x2={112} y2={92} stroke={PIZARRA} strokeWidth={2} />
      <motion.rect x={28} width={24} rx={3} fill={V} animate={{ height: [0, 52, 52], y: [92, 40, 40] }} transition={siempre(3, { times: [0, 0.4, 1] })} />
      <motion.rect x={66} width={24} rx={3} fill={VERDE} animate={{ height: [0, 64, 64], y: [92, 28, 28] }} transition={siempre(3, { times: [0, 0.5, 1] })} />
      <motion.path d="M70 18 L78 8 L86 18 M78 8 L78 26" fill="none" stroke={VERDE_OSC} strokeWidth={3} strokeLinecap="round"
                   animate={{ opacity: [0, 0, 1, 1], y: [6, 6, 0, 0] }} transition={siempre(3, { times: [0, 0.5, 0.65, 1] })} />
    </>
  ),
  // Cómo lo hicimos: cálculos en el tablero y un engranaje que gira
  calculos: () => (
    <>
      <rect x={6} y={8} width={84} height={64} rx={5} fill={NAVY} stroke={PIZARRA} strokeWidth={2} />
      {['M14 24 L60 24', 'M14 38 L74 38', 'M14 52 L50 52'].map((d, k) => (
        <motion.path key={d} d={d} stroke={k === 1 ? VERDE : '#ffffff'} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray="1 1"
                     animate={{ strokeDashoffset: [1, 0, 0] }} transition={siempre(3, { delay: k * 0.5, times: [0, 0.4, 1] })} />
      ))}
      <g>
        {Array.from({ length: 8 }, (_, k) => <rect key={k} x={97} y={69} width={6} height={26} rx={1.5} fill={V} transform={`rotate(${k * 45} 100 82)`} />)}
        <circle cx={100} cy={82} r={10} fill={V} /><circle cx={100} cy={82} r={4} fill="#ffffff" />
        <animateTransform attributeName="transform" type="rotate" from="0 100 82" to="360 100 82" dur="4s" repeatCount="indefinite" />
      </g>
    </>
  ),
  // Portada (Matrícula+): Proli mira la ciudad con un telescopio
  telescopio: () => (
    <>
      {[[8, 30], [24, 46], [42, 22], [60, 38], [80, 26], [96, 44]].map(([x, h], k) => <rect key={k} x={x} y={92 - h} width={15} height={h} rx={1.5} fill={k % 2 ? AZUL : '#dfe7f2'} />)}
      <rect x={42} y={58} width={15} height={12} fill={V} /><path d="M40 58 L49.5 50 L59 58 Z" fill={V} />
      {[[20, 10], [70, 8], [104, 16]].map(([x, y], k) => (
        <motion.circle key={k} cx={x} cy={y} r={2.2} fill="#f2c94c" animate={{ opacity: [0.2, 1, 0.2] }} transition={siempre(1.6, { delay: k * 0.5 })} />
      ))}
      <g>
        <rect x={-2} y={60} width={34} height={9} rx={3} fill={PIZARRA} transform="rotate(-20 0 64)" />
        <animateTransform attributeName="transform" type="rotate" values="-6 6 70; 4 6 70; -6 6 70" dur="4s" repeatCount="indefinite" />
      </g>
      {/* trípode del telescopio */}
      <path d="M6 70 L-2 96 M6 70 L14 96 M6 70 L6 96" stroke={NAVY} strokeWidth={2.5} strokeLinecap="round" />
    </>
  ),
  // El problema (Matrícula+): el trayecto largo de la casa al colegio
  ruta: () => (
    <>
      <path d="M10 84 L10 70 L20 62 L30 70 L30 84 Z" fill={VERDE} />
      <rect x={88} y={56} width={26} height={28} fill={V} /><path d="M86 56 L101 44 L116 56 Z" fill={V} /><rect x={98} y={70} width={6} height={14} fill="#ffffff" />
      <path d="M30 80 C 50 40, 60 96, 86 70" fill="none" stroke={PIZARRA} strokeWidth={2.5} strokeDasharray="3 4" />
      <circle r={5} fill={NAVY}><animateMotion dur="3.5s" repeatCount="indefinite" path="M30 80 C 50 40, 60 96, 86 70" /></circle>
      <text x={58} y={40} textAnchor="middle" fontSize={10} fontWeight={700} fill={PIZARRA}>&gt; 2 km</text>
    </>
  ),
  // La solución (Matrícula+): cada estudiante encaja con un colegio de su nivel
  puzzle: () => (
    <>
      <rect x={66} y={30} width={40} height={40} rx={4} fill={V} />
      <circle cx={66} cy={50} r={8} fill="#ffffff" />
      <motion.g animate={{ x: [-26, 0, 0, -26] }} transition={siempre(3.2, { times: [0, 0.35, 0.8, 1] })}>
        <rect x={26} y={30} width={40} height={40} rx={4} fill={VERDE} />
        <circle cx={66} cy={50} r={7.5} fill={VERDE} />
      </motion.g>
      <motion.path d="M80 18 L86 24 L98 12" fill="none" stroke={VERDE_OSC} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
                   animate={{ opacity: [0, 0, 1, 0] }} transition={siempre(3.2, { times: [0, 0.38, 0.5, 0.85] })} />
    </>
  ),
  // Antes y después (Matrícula+): los estudiantes que estaban lejos llegan cerca del colegio
  acerca: () => (
    <>
      <rect x={50} y={42} width={22} height={24} fill={V} /><path d="M48 42 L61 32 L74 42 Z" fill={V} />
      <circle cx={61} cy={54} r={34} fill="none" stroke={VERDE} strokeWidth={2} strokeDasharray="4 4" />
      {[[6, 14], [112, 20], [10, 92], [114, 88], [60, 100]].map(([x, y], k) => {
        const cx = 61 + (x - 61) * 0.45, cy = 54 + (y - 54) * 0.45
        return <motion.circle key={k} r={4.5} animate={{ cx: [x, cx, cx, x], cy: [y, cy, cy, y], fill: [V, VERDE_OSC, VERDE_OSC, V] }}
                              transition={siempre(3.6, { delay: k * 0.15, times: [0, 0.45, 0.85, 1] })} />
      })}
    </>
  ),
  // Resultados (Matrícula+): donde faltan cupos, Proli construye un colegio
  construye: () => (
    <>
      {[[30, 76], [56, 76], [82, 76], [43, 58], [69, 58], [56, 40]].map(([x, y], k) => (
        <motion.rect key={k} x={x} width={24} height={16} rx={2} fill={k % 2 ? V : '#7b68e8'}
                     animate={{ y: [-20, y, y, y], opacity: [0, 1, 1, 0] }} transition={siempre(4.2, { delay: k * 0.3, times: [0, 0.2, 0.85, 1] })} />
      ))}
      <motion.path d="M68 40 L68 22 L82 27 L68 32" fill={VERDE} stroke={NAVY} strokeWidth={1.5}
                   animate={{ opacity: [0, 0, 1, 1, 0], y: [6, 6, 0, 0, 0] }} transition={siempre(4.2, { times: [0, 0.55, 0.65, 0.9, 1] })} />
    </>
  ),
}

export default function ProliActividad({ tipo }: { tipo: Actividad }) {
  return (
    <div className={`actividad actividad--${tipo}`} aria-hidden>
      <svg className="actividad__objeto" viewBox={tipo === 'historia' ? '0 0 200 150' : '0 0 120 104'}>{ESCENAS[tipo]()}</svg>
    </div>
  )
}
