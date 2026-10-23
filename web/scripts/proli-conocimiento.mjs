/**
 * Genera lo que sabe Proli (api/_proli/conocimiento.ts) a partir de los MISMOS archivos de datos que
 * usa el sitio. Así Proli nunca dice una cifra distinta de la que muestra la pantalla.
 *
 * Volver a correrlo cada vez que cambien los datos de un demo:
 *   npm run proli:conocimiento
 *
 * Fuentes: public/movilidad/datos/ (experiencia, fuentes, resumen, sitios) y public/simulador/
 * (todos.json: índice y escenarios precalculados; upz.geojson: oferta y demanda por UPZ).
 */
import { simular, metricas } from '../src/motor.ts'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (ruta) => JSON.parse(readFileSync(join(WEB, ruta), 'utf8'))
const fmt = (x, d = 0) => Number(x).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (x, d = 1) => `${fmt(x, d)} %`
const titulo = (s) => s.toLocaleLowerCase('es').replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('es'))

// ------------------------------------------------------------------ Movilidad+
const exp = leer('public/movilidad/datos/experiencia.json')
const fue = leer('public/movilidad/datos/fuentes.json')
const res = leer('public/movilidad/datos/resumen.json')
const sitios = leer('public/movilidad/datos/sitios.geojson')

// Por localidad: siniestros graves por año y tipo de vía, y el hexágono de barrio de mayor riesgo
const porLoc = new Map()
for (const { properties: p } of sitios.features) {
  const l = porLoc.get(p.localidad) ?? { hex: 0, barrio: [0, 0, 0], avenida: [0, 0, 0], top: null }
  l.hex++
  const z = p.zona_vial === 'local' ? l.barrio : l.avenida
  z[0] += p.k_2023; z[1] += p.k_2024; z[2] += p.k_2025
  if (p.zona_vial === 'local' && (!l.top || p.kappa_anual > l.top.kappa_anual)) l.top = p
  porLoc.set(p.localidad, l)
}
const LOCALIDADES_MOVILIDAD = [...porLoc.keys()].sort((a, b) => a.localeCompare(b, 'es'))
const filasMov = LOCALIDADES_MOVILIDAD.map((n) => {
  const l = porLoc.get(n)
  const top = l.top
    ? `${fmt(l.top.kappa_anual, 2)}/año (2024: ${l.top.k_2024}, 2025: ${l.top.k_2025})`
    : 'sin datos'
  return `| ${titulo(n)} | ${fmt(l.barrio[1])} | ${fmt(l.barrio[2])} | ${fmt(l.avenida[1])} | ${fmt(l.avenida[2])} | ${top} |`
})

const m4 = exp.pantalla_4_el_metodo
const pres = exp.pantalla_presupuesto_barrio
const sup = res.supuestos_intervenciones.intervenciones
const v = res.validacion_2025
const movilidad = `
## Demo Movilidad+ (seguridad vial)
Pregunta: «Con este presupuesto, ¿dónde se evitan más siniestros graves?». Enfoque: «Las avenidas ya se vigilan. ¿Y las esquinas de su barrio?».
Capítulos (en orden): Usted decide (el visitante toca 3 esquinas en el mapa de ${exp.pantalla_1_usted_decide.anio_mostrado}) → Pasó un año (qué pasó en ${res.anio_validacion}) → El giro → El método → Presupuesto → Fuentes → Hablemos (QR para agendar).

### Contexto de la ciudad (Anuario de Siniestralidad Vial 2025, Secretaría Distrital de Movilidad)
- ${fmt(exp.contexto_ciudad.fallecidos_2025)} personas fallecieron en siniestros viales en Bogotá en 2025 y ${fmt(exp.contexto_ciudad.lesionados_2025)} resultaron lesionadas (criterio de 30 días).
- Fallecidos: ${pct(exp.contexto_ciudad.variacion_fallecidos_2025_pct)} frente a ${fmt(exp.contexto_ciudad.fallecidos_2024_segun_anuario_2025)} en 2024. Los peatones fueron el único grupo con más muertes (+${exp.contexto_ciudad.peatones_aumento_muertes_2025_pct} %); los mayores de 60 años son el ${exp.contexto_ciudad.mayores_60_entre_peatones_fallecidos_pct} % de los peatones fallecidos.

### El hallazgo (regresión a la media)
- Las ${ref30()} peores esquinas de barrio de 2024 sumaban ${exp.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.graves_2024} siniestros graves; en 2025 tuvieron ${exp.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.graves_2025}. Bajaron ${exp.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.esquinas_que_bajaron} de 30. El análisis no considera obras hechas en esos sitios: no se puede afirmar que «bajaron solas».
- Un año malo suele venir seguido de uno más tranquilo, con obra o sin ella. Quien interviene las esquinas con más siniestros del último año promete más de lo que va a pasar, y luego atribuye a la obra una mejora que habría ocurrido de todos modos.
- Validación (se estimó con ${res.periodo_estimacion.join('–')} y se comparó con ${res.anio_validacion}, un año que el modelo no vio), 30 esquinas de barrio de mayor riesgo: la práctica intuitiva prometía ${fmt(m4.calles_de_barrio_30_sitios.regla_simple.promete)} y ocurrieron ${m4.calles_de_barrio_30_sitios.regla_simple.ocurrio} (+${m4.calles_de_barrio_30_sitios.regla_simple.sobrestimacion_pct} %); el método de Proliferante prometía ${fmt(m4.calles_de_barrio_30_sitios.metodo_proliferante.promete)} y ocurrieron ${m4.calles_de_barrio_30_sitios.metodo_proliferante.ocurrio} (+${m4.calles_de_barrio_30_sitios.metodo_proliferante.sobrestimacion_pct} %). Las dos listas coinciden en ${m4.calles_de_barrio_30_sitios.esquinas_en_comun} de 30 esquinas.
- En avenidas (30 sitios): práctica intuitiva +${m4.avenidas_30_sitios.regla_simple.sobrestimacion_pct} %, método +${m4.avenidas_30_sitios.metodo_proliferante.sobrestimacion_pct} %.
- La diferencia que le queda al método es del orden de la caída general de 2025: ${pct(100 * v.local.tendencia_2025_vs_promedio)} en calles de barrio y ${pct(100 * v.arterial.tendencia_2025_vs_promedio)} en avenidas frente al promedio 2023–2024.
- Mensaje clave: ${m4.mensaje_clave} El método NO encuentra esquinas «escondidas» ni elige sitios con más siniestros futuros: corrige cuánto se puede prometer.

### El método, en simple
- Bogotá se dividió en hexágonos de 115 m (el mismo tamaño que usa la Secretaría de Movilidad). Cada hexágono es de barrio o de avenida según la red vial de OpenStreetMap.
- Bayes empírico (Hauer, 1997): el riesgo de cada esquina mezcla lo que pasó en ella con lo normal en esquinas parecidas. Ejemplo: si en un grupo la media es 4 y la varianza 10, una esquina con 12 siniestros se estima en 0,4 × 4 + 0,6 × 12 = 8,8. Parte de esos 12 fue mala suerte.
- Problema de la mochila: con un presupuesto, se busca la mejor combinación de esquinas en lugar de recorrer la lista de mayor a menor.
- 2022 se excluyó porque sus coordenadas se publicaron redondeadas (unos 110 m de error).
- Es el mismo tipo de análisis que ya usa la ciudad (hexágonos de 115 m, métodos de Hauer), llevado a las calles de barrio. Se actualiza cada vez que llegan datos nuevos.

### Presupuesto (estimaciones de orden de magnitud, no compromisos)
- Intervención: ${pres.intervencion}. Reducción: ${pres.reduccion_supuesta_pct} % de siniestros con heridos (${sup.local.efectividad_fuente.split(';')[0]}). Costo ≈ $${pres.costo_por_esquina_millones} millones por esquina (Unidad de Mantenimiento Vial 2022, ajustado por IPC).
${Object.entries(pres.escenarios).map(([, e]) => `- Con $${fmt(e.presupuesto_millones)} millones: ${fmt(e.esquinas)} esquinas de barrio; se esperaría evitar ≈ ${fmt(e.se_esperaria_evitar_por_anio)} siniestros graves al año (la práctica intuitiva prometería ${fmt(e.la_practica_intuitiva_prometeria)}).`).join('\n')}
- En avenidas se consideró el intervalo peatonal anticipado (−14 % de siniestros con heridos, CMF Clearinghouse ficha 9917), con un costo de cota superior de ≈ $${sup.arterial.costo_millones_cop} millones por intersección.
- Advertencia: ${fue.advertencia}

### Fuentes
${fue.fuentes.map((f) => `- ${f.dato}: ${f.fuente}${f.fuente.includes(f.anio) ? '' : ` (${f.anio})`}.`).join('\n')}
- Cruces: ${fue.cruces}
- Validación: ${fue.metodo_validacion}

### Siniestros graves por localidad (hexágonos con algún siniestro; Sumapaz casi no tiene)
| Localidad | Barrio 2024 | Barrio 2025 | Avenidas 2024 | Avenidas 2025 | Esquina de barrio con mayor riesgo corregido |
|---|---|---|---|---|---|
${filasMov.join('\n')}
`
function ref30() { return exp.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.de_un_total_de }

// ------------------------------------------------------------------ Matrícula+
const todos = leer('public/simulador/todos.json')
const ind = todos.indice
const upz = leer('public/simulador/upz.geojson')
// Las cifras de Matrícula+ salen del mismo motor que corre en el navegador (src/motor.ts), con la
// optimización de cupos incluida, para que Proli diga lo mismo que muestra la pantalla
const fam = leer('public/simulador/familias.json')
const sedes = leer('public/simulador/colegios.geojson').features.filter((x) => x.properties.tipo === 'sede')
const ctx = { cuposSedes: sedes.map((x) => x.properties.cupos), posSedes: sedes.map((x) => x.geometry.coordinates) }
const par = ind.parametros
const SUP = { opciones: par.n_opciones, pctVulnerable: par.pct_vulnerable, pctHermano: par.pct_hermano, cuposColegioNuevo: par.cupos_colegio_nuevo,
  reduccionJornada: par.reduccion_jornada_unica, radioReubicacionKm: 3, umbralViajeLargoKm: 2, pesoDesempate: par.desempate_peso }
const zonaCritica = new Set(ind.zona_critica.map((z) => ind.upz.indexOf(z.codigo)))
const M = ({ mecanismo = 'diferida', preset = 'equilibrada', colegio = null, jornada = false }) => {
  const u = colegio && ind.colegio_nuevo.find((x) => x.clave === colegio)
  const sim = simular(fam, ctx, SUP, { mecanismo, pesos: ind.pesos_presets[preset], colegioNuevo: u ? { clave: u.clave, lon: u.lon, lat: u.lat } : null, jornadaUnica: jornada })
  return { ...metricas(fam, sim, SUP), zona: metricas(fam, sim, SUP, (i) => zonaCritica.has(fam.upz[i])) }
}
const lineaMetricas = (m) =>
  `${fmt(m.fueraDeOpciones)} niños no entran a ninguno de los colegios que pidieron (${pct(m.pctFueraDeOpciones)}), ${pct(m.pctPrimera)} en su primera opción, ${fmt(m.sinCupo)} sin ningún cupo cercano tras la reubicación (${pct(m.pctSinCupo)}), ${pct(m.pctVulnerablesFuera)} de los vulnerables fuera de sus opciones, ${pct(m.zona.pctFueraDeOpciones)} fuera de sus opciones en la zona crítica, ${pct(m.pctViajeLargo)} viajan más de 2 km`
const HOY = M({ mecanismo: 'llegada' })

const porLocM = new Map()
for (const { properties: p } of upz.features) {
  const l = porLocM.get(p.localidad) ?? { cupos: 0, demanda: 0, sinCupo: 0, critica: false }
  l.cupos += p.cupos; l.demanda += p.demanda; l.sinCupo += p.demanda * p.pct_sin_cupo_base / 100
  l.critica ||= p.zona_critica
  porLocM.set(p.localidad, l)
}
const LOCALIDADES_MATRICULA = [...porLocM.keys()].sort((a, b) => a.localeCompare(b, 'es'))
const filasMat = LOCALIDADES_MATRICULA.map((n) => {
  const l = porLocM.get(n)
  return `| ${n} | ${fmt(l.demanda)} | ${fmt(l.cupos)} | ${fmt(l.cupos / Math.max(1, l.demanda), 2)} | ${pct(100 * l.sinCupo / Math.max(1, l.demanda))} |`
})

const matricula = `
## Demo Matrícula+ (cupos escolares)
Pregunta: «¿Dónde cabe cada niño?». Simulador de asignación de cupos para estudiantes NUEVOS en colegios oficiales de Bogotá. Es una herramienta para comparar reglas, no una predicción.
Capítulos: Problema (el visitante elige una localidad y ve cómo se asigna hoy: las familias llegan una por una y quien llega tarde no cabe) → Acción (elige las reglas, un colegio nuevo y la jornada única, y toca ▶ Asignar) → Resultado (localidad, Bogotá y zona crítica) → Supuestos (editables) → Método (Proli y QR). Extras: Simula una familia, Explorar (UPZ por UPZ) y Agendar.

### Datos de partida
- ${ind.supuestos.cupos} Corte: ${ind.supuestos.corte}.
- Hoy (reglas actuales, por orden de llegada): ${lineaMetricas(HOY)}.
- ${ind.supuestos.familias}
- ${ind.supuestos.opciones.replace("'sin cupo' = no quedó en ninguno", "«fuera de sus opciones» = no quedó en ninguno")} ${ind.supuestos.distancia}
- Zona crítica de la Secretaría de Educación: ${ind.zona_critica.map((z) => z.nombre).join(' y ')} (Suba). ${ind.zona_critica_fuente}.

### Cómo asigna Matrícula+
Primero una asignación diferida (todas las familias piden a la vez y cada colegio se queda con las de más prioridad) y luego una OPTIMIZACIÓN de cupos: busca cadenas de cambios entre las opciones de cada familia para que entre el máximo posible de niños a alguno de los colegios que pidieron. Nadie que tenía cupo lo pierde, aunque algunos pasan a su segunda o tercera opción. No crea cupos: con los mismos cupos, caben más niños en sus opciones; las reglas de prioridad deciden quién tiene preferencia. Los niños sin ningún cupo cercano dependen de cuántos cupos hay: para bajarlos hace falta capacidad (colegio nuevo).

### Reglas que el visitante puede elegir (prioridad de cada colegio)
${ind.presets.map((p) => `- ${p.etiqueta}: ${p.descripcion}. En Bogotá: ${lineaMetricas(M({ preset: p.clave }))}.`).join('\n')}

### Colegio nuevo (+${fmt(ind.parametros.cupos_colegio_nuevo)} cupos en un proyecto real de la SED) y jornada única
${ind.colegio_nuevo.map((u) => {
  const m = M({ colegio: u.clave })
  return `- ${u.etiqueta} (${u.proyecto}, UPZ ${u.upz_nombre}). Con reglas Equilibradas, en Bogotá: ${fmt(m.fueraDeOpciones)} niños fuera de sus opciones y ${fmt(m.sinCupo)} sin ningún cupo cercano; en la zona crítica, ${pct(m.zona.pctFueraDeOpciones)} fuera de sus opciones.`
}).join('\n')}
- ${ind.supuestos.jornada_unica} Con reglas Equilibradas y jornada única: ${fmt(M({ jornada: true }).fueraDeOpciones)} niños fuera de sus opciones y ${fmt(M({ jornada: true }).sinCupo)} sin ningún cupo cercano.

### Oferta y demanda por localidad (estudiantes nuevos, hoy)
| Localidad | Solicitudes | Cupos | Cupos por solicitud | % sin cupo hoy |
|---|---|---|---|---|
${filasMat.join('\n')}
`

// ------------------------------------------------------------------ salida
const texto = `# Conocimiento de Proli (generado el ${new Date().toISOString().slice(0, 10)} con scripts/proli-conocimiento.mjs; modelo de Movilidad+ ${exp.version_modelo})\n${movilidad}\n${matricula}`
const salida = join(WEB, 'api', '_proli', 'conocimiento.ts')
mkdirSync(dirname(salida), { recursive: true })
writeFileSync(salida, `// GENERADO por scripts/proli-conocimiento.mjs — no editar a mano; volver a generar con npm run proli:conocimiento
export const CONOCIMIENTO = ${JSON.stringify(texto)}
export const LOCALIDADES_MOVILIDAD = ${JSON.stringify(LOCALIDADES_MOVILIDAD)} as const
export const LOCALIDADES_MATRICULA = ${JSON.stringify(LOCALIDADES_MATRICULA)} as const
`)
console.log(`Escrito ${salida}: ${texto.length} caracteres, ${LOCALIDADES_MOVILIDAD.length} localidades de movilidad, ${LOCALIDADES_MATRICULA.length} de matrícula`)
