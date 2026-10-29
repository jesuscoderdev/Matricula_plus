/**
 * Genera lo que sabe Proli (api/_proli/conocimiento.ts) a partir de los MISMOS archivos de datos que
 * usa el sitio. Así Proli nunca dice una cifra distinta de la que muestra la pantalla.
 *
 * Volver a correrlo cada vez que cambien los datos de un demo:
 *   npm run proli:conocimiento
 *
 * Fuentes: public/movilidad/datos/ (experiencia, fuentes, resumen, sitios) y public/matricula/datos/
 * (resultados.json, de engine/reparto_v2.py).
 */
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

// Las tres formas de escoger esquinas de barrio, como en src/movilidad/guion.ts (mismos desempates):
// contar solo 2024, contar 2023 + 2024 y el modelo
const barrio = sitios.features.map((f) => f.properties).filter((p) => p.zona_vial === 'local')
const porId = (a, b) => (a.hex_115m < b.hex_115m ? -1 : a.hex_115m > b.hex_115m ? 1 : 0)
const ORDEN = {
  contar1: [...barrio].sort((a, b) => b.k_2024 - a.k_2024 || b.k_2023 - a.k_2023 || porId(a, b)),
  contar2: [...barrio].sort((a, b) => (b.k_2023 + b.k_2024) - (a.k_2023 + a.k_2024) || b.k_2024 - a.k_2024 || porId(a, b)),
  modelo: [...barrio].sort((a, b) => b.kappa_anual - a.kappa_anual || porId(a, b)),
}
const ESPERA = { contar1: (p) => p.k_2024, contar2: (p) => (p.k_2023 + p.k_2024) / 2, modelo: (p) => p.kappa_anual }
const suma = (l, f) => l.reduce((t, p) => t + f(p), 0)
function comparar(n) {
  const top = Object.fromEntries(Object.keys(ORDEN).map((k) => [k, ORDEN[k].slice(0, n)]))
  const enModelo = new Set(top.modelo.map((p) => p.hex_115m)), enUno = new Set(top.contar1.map((p) => p.hex_115m))
  const forma = (k) => ({ espera: suma(top[k], ESPERA[k]), hubo: suma(top[k], (p) => p.k_2025), comun: top[k].filter((p) => enModelo.has(p.hex_115m)).length })
  const anios = (l) => ({ n: l.length, k23: suma(l, (p) => p.k_2023), k24: suma(l, (p) => p.k_2024), k25: suma(l, (p) => p.k_2025) })
  return { n, contar1: forma('contar1'), contar2: forma('contar2'), modelo: forma('modelo'),
    salen: anios(top.contar1.filter((p) => !enModelo.has(p.hex_115m))), entran: anios(top.modelo.filter((p) => !enUno.has(p.hex_115m))) }
}
const C30 = comparar(ref30()), CP = comparar(pres.escenarios.bajo.esquinas)
const red = pres.reduccion_supuesta_pct / 100
const movilidad = `
## Demo Presupuesto+ (antes Movilidad+; presupuesto de seguridad vial)
Pregunta: «¿Cómo decidir dónde invertir primero?». Lema: «Mismo presupuesto. Más información. Decisiones diferentes.». El objetivo es asignar mejor el presupuesto; la mejor predicción es el cómo, no el fin. No digas que el modelo baja los siniestros ni que una obra funcionó: no se puede demostrar.
Vocabulario de las pantallas (úsalo igual): «selección basada en ${exp.pantalla_1_usted_decide.anio_mostrado}» frente a «selección con Presupuesto+»; «zonas» o «lugares»; «riesgo estimado» (nunca «riesgo real» ni «de verdad»); «análisis retrospectivo». Nunca «un año malo», «pasajero», «método actual» ni «contar»: no se sabe cómo escoge hoy cada entidad.
Seis pasos, en formato vertical: El problema · La solución · Antes y después · Resultados · Cómo lo hicimos · Tu reto. Un solo escenario ilustrativo: las ${fmt(CP.n)} zonas de barrio que alcanzan con $${fmt(pres.escenarios.bajo.presupuesto_millones)} millones (costo supuesto de $${fmt(pres.costo_por_esquina_millones)} millones por intervención). Pasos: El problema (problema; ${fmt(barrio.filter((p) => p.k_2024 > 0).length)} lugares para intervenir, recursos para ${fmt(CP.n)}) → La solución (solucion; mirar un solo período oculta patrones: las ${fmt(CP.salen.n)} zonas seleccionadas únicamente por 2024 tuvieron ${fmt(CP.salen.k23)} siniestros graves en 2023 y ${fmt(CP.salen.k24)} en 2024; las ${fmt(CP.entran.n)} incorporadas por Presupuesto+, ${fmt(CP.entran.k23)} en 2023 y ${fmt(CP.entran.k24)} en 2024) → Antes y después (antes; con el mismo presupuesto cambian ${fmt(CP.entran.n)} decisiones: ${fmt(CP.n - CP.entran.n)} lugares coinciden) → Resultados (resultados; análisis retrospectivo: en ${res.anio_validacion} la selección basada en 2024 registró ${fmt(CP.contar1.hubo)} siniestros graves y la de Presupuesto+ ${fmt(CP.modelo.hubo)}; no significa que se evitaron siniestros) → Cómo lo hicimos (como; datos conectados → riesgo estimado → decisiones mejor informadas; «Consultar metodología» abre fuentes, supuestos y limitaciones) → Tu reto (reto; Proli y agenda). Los siniestros evitados (reducción supuesta de ${pres.reduccion_supuesta_pct} %), la curva de presupuesto, barrio o avenidas, las 30 esquinas y «¿Funcionó la obra?» ya no están en pantalla: son contexto, úsalos solo si preguntan y siempre como escenario hipotético.

### Contexto de la ciudad (Anuario de Siniestralidad Vial 2025, Secretaría Distrital de Movilidad)
- ${fmt(exp.contexto_ciudad.fallecidos_2025)} personas fallecieron en siniestros viales en Bogotá en 2025 y ${fmt(exp.contexto_ciudad.lesionados_2025)} resultaron lesionadas (criterio de 30 días).
- Fallecidos: ${pct(exp.contexto_ciudad.variacion_fallecidos_2025_pct)} frente a ${fmt(exp.contexto_ciudad.fallecidos_2024_segun_anuario_2025)} en 2024. Las muertes de peatones aumentaron (+${exp.contexto_ciudad.peatones_aumento_muertes_2025_pct} %); los mayores de 60 años son el ${exp.contexto_ciudad.mayores_60_entre_peatones_fallecidos_pct} % de los peatones fallecidos.

### El hallazgo (regresión a la media)
- Las ${ref30()} peores esquinas de barrio de 2024 sumaban ${exp.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.graves_2024} siniestros graves; en 2025 tuvieron ${exp.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.graves_2025}. Bajaron ${exp.pantalla_2_pasa_un_anio.referencia_30_peores_esquinas_de_barrio_2024.esquinas_que_bajaron} de 30. El análisis no considera obras hechas en esos sitios: no se puede afirmar que «bajaron solas».
- Un año malo suele venir seguido de uno más tranquilo, con obra o sin ella. Quien interviene las esquinas con más siniestros del último año promete más de lo que va a pasar, y luego puede atribuir a la obra una mejora que en buena parte se esperaba sin obra.
- Validación (se estimó con ${res.periodo_estimacion.join('–')} y se comparó con ${res.anio_validacion}, un año que el modelo no vio), 30 esquinas de barrio de mayor riesgo: contar 2023 + 2024 (el promedio de los siniestros de esos años) calculó ${fmt(m4.calles_de_barrio_30_sitios.regla_simple.promete)} y pasaron ${m4.calles_de_barrio_30_sitios.regla_simple.ocurrio} (calculó un ${m4.calles_de_barrio_30_sitios.regla_simple.sobrestimacion_pct} % de más); el modelo calculó ${fmt(m4.calles_de_barrio_30_sitios.metodo_proliferante.promete)} y pasaron ${m4.calles_de_barrio_30_sitios.metodo_proliferante.ocurrio} (calculó un ${m4.calles_de_barrio_30_sitios.metodo_proliferante.sobrestimacion_pct} % de más). Las dos listas coinciden en ${m4.calles_de_barrio_30_sitios.esquinas_en_comun} de 30 esquinas.
- En avenidas (30 sitios): contar calculó de más un ${m4.avenidas_30_sitios.regla_simple.sobrestimacion_pct} %; el modelo, un ${m4.avenidas_30_sitios.metodo_proliferante.sobrestimacion_pct} %.
- La diferencia que le queda al método es del orden de la caída general de 2025: ${pct(100 * v.local.tendencia_2025_vs_promedio)} en calles de barrio y ${pct(100 * v.arterial.tendencia_2025_vs_promedio)} en avenidas frente al promedio 2023–2024.

### Las dos cosas que hace el modelo (las mismas cifras de las pantallas)
- Escoge distinto que contar solo 2024. De las ${C30.n} esquinas de barrio con más riesgo cambian ${C30.salen.n}: las que salen tuvieron ${C30.salen.k24} siniestros graves en 2024 (${C30.salen.k23} en 2023) y ${C30.salen.k25} en 2025; las que entran, ${C30.entran.k24} en 2024 (${C30.entran.k23} en 2023) y ${C30.entran.k25} en 2025. Las que salen tuvieron un año malo; las que entran llevan años con riesgo.
- En esas ${C30.n}: contar solo 2024 esperaba ${fmt(C30.contar1.espera)} y hubo ${C30.contar1.hubo}; contar 2023 + 2024 esperaba ${fmt(C30.contar2.espera)} y hubo ${C30.contar2.hubo}; el modelo esperaba ≈ ${fmt(C30.modelo.espera)} y hubo ${C30.modelo.hubo}.
- Con $${fmt(pres.escenarios.bajo.presupuesto_millones)} millones (${fmt(CP.n)} esquinas) cambian ${CP.salen.n} frente a contar solo 2024: las que salen tuvieron ${CP.salen.k25} siniestros graves en 2025 y las que entran, ${CP.entran.k25}. Con reductores (−${fmt(pres.reduccion_supuesta_pct)} %): contar solo 2024 promete evitar ${fmt(CP.contar1.espera * red)} al año y se evitan ≈ ${fmt(CP.contar1.hubo * red)}; contar 2023 + 2024 promete ${fmt(CP.contar2.espera * red)} y se evitan ≈ ${fmt(CP.contar2.hubo * red)}; el modelo promete ≈ ${fmt(CP.modelo.espera * red)} y se evitan ≈ ${fmt(CP.modelo.hubo * red)}. Frente a contar solo 2024 son ≈ ${fmt((CP.modelo.hubo - CP.contar1.hubo) * red)} siniestros graves más evitados al año con la misma plata.
- Frente a contar 2023 + 2024 escoge casi lo mismo (${C30.contar2.comun} de ${C30.n} en común; ${CP.contar2.comun} de ${CP.n} con el presupuesto) y no evita más: ahí su valor es la promesa. Dilo así si preguntan.
- Espera lo que se cumple: eso permite firmar metas, decidir entre barrio y avenidas y saber si una obra funcionó. No encuentra esquinas «escondidas»: mira la historia de cada esquina y separa el azar.

### El método, en simple
- Bogotá se dividió en hexágonos de 115 m. Cada hexágono es de barrio o de avenida según la red vial de OpenStreetMap.
- Bayes empírico (Hauer, 1997): el riesgo de cada esquina mezcla lo que pasó en ella con lo normal en esquinas parecidas. Ejemplo: si en un grupo la media es 4 y la varianza 10, una esquina con 12 siniestros se estima en 0,4 × 4 + 0,6 × 12 = 8,8. Parte de esos 12 fue azar.
- Con un presupuesto, se eligen las esquinas de mayor riesgo corregido que alcanzan (todas cuestan lo mismo, así que es la lista ordenada de mayor a menor).
- 2022 se excluyó porque sus coordenadas se publicaron con menos precisión.
- Es un método reconocido en seguridad vial (Hauer), llevado a las calles de barrio. Se puede actualizar cada vez que llegan datos nuevos.
- No afirmes que la Secretaría de Movilidad usa este mismo análisis ni cómo prioriza: no está en las fuentes.

### Presupuesto (estimaciones de orden de magnitud, no compromisos)
- Intervención: ${pres.intervencion}. Reducción: ${pres.reduccion_supuesta_pct} % de siniestros con heridos (${sup.local.efectividad_fuente.split(';')[0]}). Costo ≈ $${pres.costo_por_esquina_millones} millones por esquina (Unidad de Mantenimiento Vial 2022, ajustado por IPC).
${Object.entries(pres.escenarios).map(([nivel, e]) => {
  const ojo = res.asignacion_presupuesto?.barrio?.[nivel]?.lista_por_conteo_bruto?.esperado_evitados_anual_eb
  return `- Con $${fmt(e.presupuesto_millones)} millones: ${fmt(e.esquinas)} esquinas de barrio; con el método se esperaría evitar ≈ ${fmt(e.se_esperaria_evitar_por_anio)} siniestros graves al año. Elegidas contando 2023 + 2024, se evitarían ≈ ${fmt(ojo ?? e.se_esperaria_evitar_por_anio)} (casi lo mismo), pero se prometería evitar ${fmt(e.la_practica_intuitiva_prometeria)}.`
}).join('\n')}
- Mensaje del presupuesto: frente a contar 2023 + 2024, el modelo no evita más; lo que cambia es que prometes lo que puedes cumplir (frente a contar solo 2024 sí evita más: ver arriba). Ni siquiera el método es exacto: frente a lo ocurrido en 2025 también calculó un poco de más, sobre todo con presupuestos grandes.
- En avenidas se consideró el intervalo peatonal anticipado (−14 % de siniestros con heridos, CMF Clearinghouse ficha 9917), con un costo de cota superior de ≈ $${sup.arterial.costo_millones_cop} millones por intersección.
- Advertencia: ${fue.advertencia}
- Curva (el visitante mueve el monto con un control en el capítulo Presupuesto): ${[1000, 2000, 5000, 10000, 20000].map((mm) => exp.presupuesto_curva.puntos.find((p) => p.presupuesto_millones === mm)).filter(Boolean).map((p) => `$${fmt(p.presupuesto_millones)} millones → ≈ ${fmt(p.metodo_esperado)} evitados al año`).join('; ')}. Cada peso adicional rinde menos, porque primero se intervienen las esquinas de más riesgo.
- ¿Barrio o avenidas? (mejor combinación con un modelo de optimización, la mochila): ${exp.presupuesto_reparto.filas.map((f) => `con $${fmt(f.presupuesto_millones)} millones, todo en barrio ≈ ${fmt(f.todo_en_barrio)}, todo en avenidas ≈ ${fmt(f.todo_en_avenidas)}, mejor combinación ≈ ${fmt(f.mejor_combinacion.esperado)} (${fmt(f.mejor_combinacion.esquinas_barrio)} esquinas de barrio y ${fmt(f.mejor_combinacion.intersecciones_avenida)} intersecciones)`).join('; ')}. Con estos costos el método pone el presupuesto en barrio; pero el costo de avenidas es una cota superior: si el intervalo peatonal cuesta menos de ≈ ${fmt(exp.presupuesto_reparto.filas.find((f) => f.presupuesto_millones === 5000)?.avenidas_compiten_si_cuestan_menos_de_millones ?? 0)} millones por intersección (por ejemplo, si solo hay que reprogramar el semáforo), conviene sumar avenidas.

### ¿Funcionó la obra? (en Resultados)
- Ejemplo hipotético: si en enero de 2025 se hubiera hecho una obra en las ${exp.evaluacion_obra.esquinas} peores esquinas de barrio de 2024, pasaron de ${exp.evaluacion_obra.antes_2024} a ${exp.evaluacion_obra.despues_2025} siniestros graves. Mirando antes y después, a la obra se le atribuiría ${pct(exp.evaluacion_obra.efecto_antes_despues_pct)}. Con el método, sin obra ya se esperaban ≈ ${fmt(exp.evaluacion_obra.esperado_sin_obra)}: la obra podría reclamar a lo sumo ≈ ${pct(exp.evaluacion_obra.efecto_con_metodo_pct)}; si además se descuenta la caída general de la ciudad (${pct(exp.evaluacion_obra.tendencia_ciudad_pct)}), casi nada (${pct(exp.evaluacion_obra.efecto_con_metodo_y_tendencia_pct)}). Proliferante puede evaluar si las obras de una entidad funcionaron, descontando este efecto.
- Si preguntan «¿y si la caída fue por obras?»: (1) pasa cada año: las 30 peores de ${exp.pruebas_regresion_a_la_media.un_anio_antes.anio} bajaron de ${exp.pruebas_regresion_a_la_media.un_anio_antes.graves_antes} a ${exp.pruebas_regresion_a_la_media.un_anio_antes.graves_despues} al año siguiente; (2) pasa en miles de esquinas: las ${fmt(exp.pruebas_regresion_a_la_media.por_nivel_2024_2025[0].hexagonos)} esquinas con un siniestro grave en 2024 tuvieron en promedio ${String(exp.pruebas_regresion_a_la_media.por_nivel_2024_2025[0].promedio_2025).replace('.', ',')} en 2025; (3) pasa al revés: de ${fmt(exp.pruebas_regresion_a_la_media.sin_graves_en_2024.hexagonos)} esquinas sin siniestros graves en 2024, ${fmt(exp.pruebas_regresion_a_la_media.sin_graves_en_2024.con_alguno_en_2025)} tuvieron alguno en 2025; (4) el método predijo la caída sin saber nada de obras. No digas que no hubo obras: el análisis no las considera.

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
// Las cifras salen de public/matricula/datos/resultados.json (engine/reparto_v2.py): las mismas de la pantalla
const R = leer('public/matricula/datos/resultados.json')
const G = R.grupos, B = G.bogota, S = R.simulacion, H = R.hermanos, F = R.flujos, X = R.por_que_siguen_lejos, D = R.desercion
const NIV = ['Preescolar', 'Primaria', 'Secundaria', 'Media']
const ld = (c) => `${fmt(c.lejos_antes)} → ${fmt(c.lejos_despues)}`
const LOCALIDADES_MATRICULA = Object.keys(R.por_localidad).filter((l) => R.por_localidad[l].ninos > 0).sort((a, b) => a.localeCompare(b, 'es'))
const filasMat = LOCALIDADES_MATRICULA.map((n) => {
  const c = R.por_localidad[n]
  return `| ${n} | ${fmt(c.ninos)} | ${fmt(c.cupos)} | ${ld(c)} | ${NIV.map((k) => fmt(c.lejos_despues_por_nivel[k])).join(' | ')} |`
})

const matricula = `
## Demo Matrícula+ (cupos escolares)
Pregunta: «¿Y si el cupo no se diera por orden de llegada, sino cruzando datos para darle prioridad a quien más lo necesita?». Titular: en Bogotá, ${fmt(B.lejos_antes)} niños estudian lejos de casa; con Matrícula+, ${fmt(B.lejos_despues)}. Mismos colegios, mismos cupos: solo cambia la forma de repartirlos. Una sola medida: un niño está «lejos» si su colegio queda a más de ${fmt(R.radio_km)} km de su casa.
Seis secciones: El problema · La solución · Antes y después · Resultados · Cómo se hizo · Tu reto. Pantallas (en orden): El problema (problema) → La solución (solucion) → ¿Quién es quién? (prioridad) → Antes y después (antes; el mapa cambia entre «Hoy» y «Con Matrícula+») → Mira tu localidad (localidad) → Resultados (resultados) → ¿Dónde faltan cupos? (faltan; mapa por nivel) → Cómo se hizo (como) → Fuentes (fuentes) → Tu reto (reto, QR para agendar).
Todas las cifras de niños son de una simulación con datos abiertos (niños recreados, no reales); dilo así. La única cifra oficial del problema es la cantidad de niños nuevos que pidieron cupo.

### El problema
- Cada año unos ${fmt(Math.round(B.ninos / 1000) * 1000)} niños piden cupo nuevo en un colegio público (dato oficial: ${fmt(S.nuevos_oficial)}, Secretaría de Educación). ${fmt(G.menores_10.ninos)} tienen menos de 10 años.
- Hoy, quien se inscribe primero elige primero (tres colegios); quien llega tarde se queda con lo que sobre. Resultado simulado: ${fmt(B.lejos_antes)} niños (${pct(100 * B.lejos_antes / B.ninos)}) quedan lejos. De ellos, ${fmt(G.vulnerables_menores_10.lejos_antes)} son a la vez menores de 10 y de estrato 1 o 2.

### La solución (prioridad)
1. Familias de estrato 1 y 2 (estrato 1 primero): ${fmt(G.vulnerables.ninos)} niños, ${fmt(G.estrato_1.ninos)} de estrato 1. Estratificación por manzana (SDP).
2. Los más pequeños (menores de 10: ${fmt(G.menores_10.ninos)}) y los más grandes (14 a 16 años, ≈ noveno a once: ${fmt(G.grandes.ninos)}).
3. Con hermano en un colegio cercano (supuesto: ${fmt(100 * S.pct_hermano)} %, ${fmt(G.con_hermano.ninos)} niños).
Puntos: estrato 1 suma ${S.puntos.estrato_1}, estrato 2 suma ${S.puntos.estrato_2}, ser menor de 10 o tener 14 a 16 suma ${S.puntos.edad}, quedar con el hermano también suma. Regla de oro: ninguna localidad termina con más niños lejos que hoy.
Por qué los grandes: ${fmt(D.noveno_no_pasa_a_decimo_pct, 1)} % de los estudiantes de noveno no pasa a décimo y solo el ${fmt(D.media_se_gradua_pct, 1)} % de los que llegan a la media se gradúa (${D.fuente_grado}). La causa de deserción más reportada es el cambio de residencia (${fmt(D.cambio_residencia_pct, 2)} %; ${D.fuente_causas}). ${D.advertencia}
Por qué estrato: es el dato público por manzana. La Secretaría ya prioriza en la primera fase a ${R.priorizados_sed.join(', ')}; esos datos son por niño y no son públicos.
La edad y el grado de cada niño no se publican: la edad es la típica de su nivel (DANE).

### Antes y después (hoy → Matrícula+)
- Niños lejos: ${ld(B)} (${fmt(100 * (B.lejos_antes - B.lejos_despues) / B.lejos_antes)} % menos). Distancia promedio: ${fmt(B.km_antes, 1)} → ${fmt(B.km_despues, 1)} km.
- Estrato 1 y 2: ${ld(G.vulnerables)}. Estrato 1: ${ld(G.estrato_1)}. Menores de 10: ${ld(G.menores_10)}. De 14 a 16 años: ${ld(G.grandes)}. Menores de 10 de estrato 1 y 2: ${ld(G.vulnerables_menores_10)}. Adolescentes de 14 a 16 de estrato 1 y 2: ${ld(G.vulnerables_grandes)}.
- Hermanos en el mismo colegio: ${fmt(H.juntos_antes)} → ${fmt(H.juntos_despues)} (de ${fmt(H.total)}). Siguen separados ${fmt(H.separados)}: ${fmt(H.colegio_del_hermano_sin_su_nivel)} porque el colegio del hermano no tiene su nivel y ${fmt(H.colegio_del_hermano_lleno)} porque está lleno con niños de más prioridad; solo ${fmt(H.separados_y_lejos)} quedan lejos.
- ¿Son los mismos niños? ${fmt(F.lejos_a_cerca)} pasan de lejos a cerca, ${fmt(F.siguen_lejos)} siguen lejos y ${fmt(F.cerca_a_lejos)} pasan de cerca a lejos para que un niño con más prioridad quede cerca (${fmt(F.cerca_a_lejos_estrato['1'])} de estrato 1, ${fmt(F.cerca_a_lejos_estrato['2'])} de estrato 2; quedan en promedio a ${fmt(F.cerca_a_lejos_km_promedio, 1)} km).
- ¿Y los que siguen lejos? De los ${fmt(X.todos.lejos)}, ${fmt(X.todos.sin_cupo_de_su_nivel_a_2km)} no tienen ningún cupo de su nivel a menos de ${fmt(R.radio_km)} km y ${fmt(X.todos.con_cupo_cerca_ocupado)} tienen cupos cerca ocupados por niños con igual o más prioridad. De los ${fmt(X.vulnerables_menores_10.lejos)} pequeños de estrato 1 y 2, ${fmt(X.vulnerables_menores_10.sin_cupo_de_su_nivel_a_2km)} no tienen ningún cupo de su nivel cerca. Los ${fmt(X.vulnerables_grandes.lejos)} adolescentes de estrato 1 y 2 que siguen lejos no tienen ningún cupo de su nivel cerca. Los que siguen lejos quedan en promedio a ${fmt(R.lejos_km.promedio_despues, 1)} km (hoy ${fmt(R.lejos_km.promedio_antes, 1)}); el máximo baja de ${fmt(R.lejos_km.max_antes, 1)} a ${fmt(R.lejos_km.max_despues, 1)} km.
- Repartir mejor no crea cupos. Por nivel, siguen lejos: ${NIV.map((k) => `${k.toLowerCase()} ${fmt(R.por_nivel[k].lejos_despues)}`).join(', ')}.

### Cómo se hizo
${fmt(S.fuentes_publicas)} fuentes públicas; ${fmt(S.sedes_con_cupos_de_nuevos)} sedes con cupos por nivel; ${fmt(S.colegios_con_solicitudes_por_nivel)} colegios con solicitudes por nivel; ${fmt(S.manzanas_residenciales)} manzanas residenciales con su estrato; ${fmt(S.ninos)} niños recreados (grupos de ${R.ninos_por_grupo_simulado}) en ${S.upz} UPZ y ${S.localidades} localidades; ${fmt(S.distancias_calculadas)} distancias; ${fmt(S.combinaciones_nino_colegio)} combinaciones niño–colegio. Hoy: cada familia pide sus 3 colegios más cercanos de su nivel y se atiende por orden de llegada; quien no entra queda en el más cercano con cupo libre. Matrícula+: reparto óptimo por programación lineal con los puntos de prioridad, respetando cupos por nivel y la regla de oro. Límites: distancia en línea recta; cifras en múltiplos de 10; traslados no simulados; el estrato es un indicador por zona. Los niños son recreados: no hay datos personales.

### Por localidad (niños que piden cupo, cupos, lejos hoy → con Matrícula+, y los que siguen lejos por nivel)
| Localidad | Niños | Cupos | Lejos | Preescolar | Primaria | Secundaria | Media |
|---|---|---|---|---|---|---|---|
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
