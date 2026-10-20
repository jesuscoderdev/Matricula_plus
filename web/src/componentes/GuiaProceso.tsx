/**
 * Explicación paso a paso del proceso que se está animando, con la leyenda de colores.
 * En PC va en el panel derecho; en celular y tótem se oculta (el recuadro del mapa ya lo explica).
 */
export default function GuiaProceso({ tipo, prioridad }: { tipo: 'hoy' | 'matricula'; prioridad?: string }) {
  const pasos = tipo === 'hoy'
    ? [
        'Cada familia pide hasta 3 colegios.',
        'Llegan en orden: la primera que llega, elige primero.',
        'Toma el primer colegio de su lista que tenga cupo libre.',
        'Si los 3 ya están llenos, queda sin cupo, aunque viva al lado.',
      ]
    : [
        'Cada familia elige hasta 3 colegios, en orden, como en la inscripción de la SED.',
        'Todas postulan al mismo tiempo a su favorito.',
        `Cada colegio retiene a las de más prioridad (${prioridad?.toLowerCase() ?? 'según la política'}) hasta llenar sus cupos.`,
        'Las rechazadas pasan a su siguiente opción. Se repite hasta que nadie cambia.',
      ]
  return (
    <aside className="guia solo-escritorio">
      <h2 className="guia__titulo">{tipo === 'hoy' ? 'Cómo se asigna hoy' : 'Cómo asigna Matrícula+'}</h2>
      <ol className="guia__pasos">
        {pasos.map((p, i) => <li key={i}><span className="guia__n">{i + 1}</span>{p}</li>)}
      </ol>
      {tipo === 'matricula' && (
        <p className="guia__nota">Es el algoritmo de asignación diferida (Gale-Shapley): el resultado es estable y a ninguna familia
          le conviene mentir sobre sus preferencias. Lo usan Chile, Nueva York y Boston.</p>
      )}
      <ul className="guia__leyenda">
        <li><i style={{ background: '#2f6fb5' }} />En su 1.ª opción</li>
        <li><i style={{ background: '#7eaade' }} />En otra de sus opciones</li>
        {tipo === 'matricula' && <li><i style={{ background: '#96a0b2' }} />Buscando colegio</li>}
        <li><i style={{ background: '#b4561a' }} />Sin cupo</li>
        <li><i className="guia__anillo" />Colegio: el relleno son los cupos ocupados</li>
        {tipo === 'matricula' && <li><i className="guia__anillo guia__anillo--exceso" />Más solicitudes que cupos</li>}
      </ul>
    </aside>
  )
}
