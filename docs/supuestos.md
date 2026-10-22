# Supuestos, fuentes y limitaciones — Matrícula+ · "¿Dónde cabe cada niño?"

Simulador de asignación de cupos en colegios oficiales de Bogotá, construido con datos abiertos.
**Es una herramienta para comparar políticas, no una predicción.**

## Fuentes y año de corte

| Dato | Fuente | Corte |
|---|---|---|
| Oferta de cupos por sede (747 sedes, 412 instituciones) | [SED · Oferta de cupos, sector oficial](https://datosabiertos.bogota.gov.co/dataset/oferta-de-cupos-sector-oficial-bogota-d-c) | 03.2025 |
| Demanda de cupos por institución | [SED · Demanda de cupos, sector oficial](https://datosabiertos.bogota.gov.co/dataset/demanda-de-cupos-sector-oficial-bogota-d-c) | 03.2025 |
| Nombres, DANE y coordenada de sedes | [Catastro · Colegios](https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/educacion/infraestructuraeducativa/MapServer/0) | 2026 |
| DANE de sede de cada punto de oferta | [SED · Matrícula total en colegios oficiales](https://datosabiertos.bogota.gov.co/dataset/matricula-total-en-colegios-oficiales-bogota-d-c) | 04.2025 |
| Manzanas residenciales (estrato 1 a 6) | [SDP · Estratificación Manzana Bogotá D.C.](https://datosabiertos.bogota.gov.co/dataset/estratificacion-para-bogota) (Decreto 532 de 2025, CC BY 4.0) | 29.10.2025 |
| Predios por manzana (peso para ubicar familias) | [Catastro · Densidad predial por manzana](https://datosabiertos.bogota.gov.co/dataset/cantidad-de-predios-por-manzana) ([REST](https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/catastro/densidadpredialmz/MapServer/0), CC BY 4.0) | 2026 |
| Ubicaciones del colegio nuevo | [SED · Colegios oficiales nuevos y en restitución](https://datosabiertos.bogota.gov.co/dataset/colegios-oficiales-nuevos-y-restitucion-bogota-d-c) | 05.2026 |
| Población de 5 a 17 años por UPZ | [SDP/DANE · Proyecciones de población por UPZ](https://datosabiertos.bogota.gov.co/dataset/proyecciones-y-retroproyecciones-de-poblacion-2005-2035) | proyección 2026 |
| Polígonos de UPZ | [SED · Tasa de aprobación escolar oficial por UPZ](https://datosabiertos.bogota.gov.co/dataset/tasa-de-aprobacion-escolar-en-colegios-oficiales-por-upz-bogota-d-c) | 2024 |
| Límites de localidades | [IDECA · Localidad](https://datosabiertos.bogota.gov.co/dataset/localidad-bogota-d-c) | vigente |
| Totales de nuevos (158.957 solicitudes, 140.377 cupos) | Estudio de insuficiencia SED 2025 | 2024–2025 |

## Ubicación de las familias y de los colegios
**Familias.** 38.546 manzanas residenciales caen en las 112 UPZ urbanas; todas las UPZ tienen al menos una, así que
**ninguna familia** quedó con el método anterior (punto aleatorio en la UPZ, que se conserva en el código como
respaldo). El código de manzana de la SDP (8 dígitos) se cruza con el de Catastro (9) insertando un 0 en la
manzana; se comprobó con la geometría en una muestra (centroides a menos de 3 m). El 97% de las manzanas
residenciales tiene dato de predios; las demás usan su área por la densidad predial residencial de su UPZ. Se pesó por predios y no
por área porque hay "manzanas" residenciales enormes y casi vacías en el borde urbano (p. ej. 1 km² con 106 predios
junto al Parque Entrenubes). Resultado: antes solo el 53,5% de las familias caía en una manzana residencial (16,6%
en manzanas de estrato 0 y 29,9% fuera de toda manzana: vías, parques, cerros, humedales); ahora el 99,2% (el resto
es el redondeo a 5 decimales en el borde de la manzana). El reparto por UPZ y localidad no cambia.

**Colegios.** La oferta de la SED no trae el DANE de la sede, pero el dataset de Matrícula total (SED 04.2025)
tiene los mismos 747 puntos en el mismo orden con `DANE12_SED` (se verifica punto a punto en cada carga). Con ese
DANE se emparejan las 747 sedes con la capa de Colegios de Catastro y se midió la distancia entre los dos puntos de
la **misma sede**: mediana **0,5 m**, p90 **0,6 m**, máximo **4.728 m**; 731 sedes a menos de 1 m y 15 a más de
10 m. Es decir, la SED **no** usa centroides de institución: en el 98% de los casos es el mismo punto. En las 15
discrepancias se comparó cada punto con una estimación por la dirección de la sede (vecinos en la nomenclatura
calle–carrera de los 2.211 colegios de Catastro): el punto de Catastro cuadra mejor en 12 (p. ej. Colegio
Cundinamarca: la SED lo ubica a 4,9 km de su dirección y Catastro a 0,3 km; Parques de Bogotá: 2,0 km vs 0,2 km).
Por eso se usa la **coordenada de Catastro** (corte 2026) emparejada por DANE de sede, salvo en dos sedes donde el
punto de la SED cuadra claramente mejor con la dirección (Jaime Hernando Garzón Forero, cuya dirección además
difiere entre fuentes, y Nacional Nicolás Esguerra; lista `PREFERIR_PUNTO_SED` en `engine/fuentes/real.py`). El
nombre de la sede también sale ahora del DANE de sede y no del punto más cercano.

## Validación de datos
- Cupos regulares 03.2025 (preescolar, primaria, secundaria, media y aceleración): **784.632** frente a
  **785.191** del estudio SED. Error de **−0,07%** (lo verifica un test).
- `OTotal` del dataset de oferta suma 818.542 porque incluye **33.910 cupos de educación de adultos**, que no
  compiten por cupo escolar y se excluyen.
- 412 instituciones frente a 413 colegios del estudio.
- Se excluyen 48 sedes rurales (10.582 cupos, 1,3%) que quedan fuera de las UPZ urbanas del mapa.

## Decisiones de modelado

1. **Solo estudiantes nuevos.** Los datasets no separan nuevos de antiguos. Se usan los totales del estudio
   SED: 158.957 solicitudes y 140.377 cupos (0,883 cupos por solicitud). Los cupos de nuevos se reparten
   entre las sedes en proporción a su oferta regular.
2. **Dónde viven las familias.** La demanda de nuevos se reparte por UPZ según la población de 5 a 17 años
   (proyección 2026; de la cohorte 15–19 se toma el 60%, que corresponde a 15, 16 y 17 años). Luego se ajusta
   para que cada localidad conserve su participación en la demanda oficial. Dentro de su UPZ, cada familia vive
   en una **manzana residencial** (estrato 1 a 6 en la estratificación de la SDP; estrato 0 = parques, industria,
   equipamientos, humedales, etc.) elegida con probabilidad proporcional a su **número de predios** según Catastro
   2026 (en propiedad horizontal cada apartamento es un predio, así que se acerca al número de viviendas), y en un
   punto aleatorio de esa manzana. Así no quedan familias en parques, cerros, humedales, el aeropuerto o zonas
   industriales, y los barrios densos reciben más familias que los de casas grandes. Detalles en *Ubicación de las
   familias y de los colegios*.
3. **Familias sintéticas, sin datos personales.** 1 familia = 10 estudiantes nuevos (15.896 familias).
   El 15% tiene un hermano en una de sus 5 sedes más cercanas y el 30% es vulnerable.
   Ambos porcentajes son configurables.
4. **Preferencias.** Hasta 3 colegios, ordenados por distancia en línea recta + un ruido uniforme de 0 a
   1,5 km (para que no todas elijan solo el más cercano). Si la familia tiene hermano y su colegio no quedó
   en la lista, entra de primera.
5. **Prioridad de cada colegio.**
   `puntaje = −w_cercanía·distancia + w_hermanos·[hermano en ese colegio] + w_vulnerabilidad·[vulnerable] + desempate`.
   El desempate es fijo por familia, sale de la semilla y pesa máximo 0,01.

   | Nivel | Cercanía (por km) | Hermanos | Vulnerabilidad |
   |---|---|---|---|
   | bajo | 0,5 | 0 | 0 |
   | medio | 1,0 | 2,5 | 1,5 |
   | alto | 2,0 | 5,0 | 3,0 |

   En pantalla se muestran 4 presets: **Equilibrada** (medio / medio / medio, la que se propone por defecto),
   **Cercanía** (alto / bajo / bajo), **Familias** (medio / alto / bajo) y **Equidad** (medio / medio / alto).
   En PC se pueden afinar los pesos en 5 niveles. Los 27 niveles quedan precalculados en Python de todas formas.
6. **Algoritmo.** Asignación diferida (Gale-Shapley) con propuesta de los estudiantes. Es estable (cero pares
   bloqueantes, verificado en cada uno de los 324 escenarios), respeta la capacidad y es reproducible con
   la misma semilla.
6b. **El proceso en la pantalla.** El navegador vuelve a correr el algoritmo (asignación diferida por rondas,
   `web/src/motor.ts`) para animarlo en la localidad elegida. Usa las mismas distancias y desempates redondeados
   a 4 decimales que Python, y `npm run verificar` comprueba que la asignación coincide en los 48 escenarios de la
   interfaz (4 presets × 6 colegios × 2 jornadas) y en la línea base, y que capacidad, unicidad y estabilidad se
   cumplen también con supuestos editados. Cada punto del mapa es una familia sintética (10 niños).
7. **Línea base ("hoy").** Orden de llegada: un orden aleatorio con semilla, y cada familia toma su primera
   opción con cupo disponible.
7b. **Reubicación (como la SED).** Quien no queda en ninguna de sus opciones recibe un cupo libre cercano, hasta
   **3 km** (editable). Hoy, en orden de llegada, el colegio con cupo más cercano. Con Matrícula+, una segunda
   asignación diferida sobre los cupos libres (los 8 más cercanos dentro del radio) con la misma prioridad. Si no hay
   cupo dentro del radio, el niño queda **sin cupo**. La reubicación solo corre en el navegador; Python valida la fase 1.
8. **Palancas.**
   - *Colegio nuevo:* +1.200 cupos (el dataset no trae cupos) en uno de 5 proyectos reales de la SED:
     Ciudadela Cafam II (Tibabuyes), Theilard de Chardin (Suba), Indusel (Bosa Occidental), Boita (Timiza)
     y Hacienda Casa Blanca (Arborizadora).
   - *Jornada única:* −10% de capacidad en todas las sedes (configurable).
9. **Zona crítica.** Las UPZ con insuficiencia **muy alta** según el Estudio de insuficiencia SED 2025:
   **Tibabuyes** y **El Rincón** (Suba). Es la misma en todos los escenarios.
10. **Distancia** en línea recta entre la casa y el colegio.

## Supuestos editables en la app
En el capítulo 4 (y el número de opciones en Acción) se pueden cambiar, y todo se vuelve a simular:

| Supuesto | Por defecto | Rango |
|---|---|---|
| Colegios que pide cada familia | 3 | 3–5 |
| Familias vulnerables | 30% | 10–50% |
| Con un hermano ya matriculado | 15% | 0–30% |
| Cupos del colegio nuevo | 1.200 | 600–2.400 |
| Distancia máxima de reubicación | 3 km | 1–5 km |
| Cupos que cuesta la jornada única | 10% | 5–20% |
| Qué es un viaje largo | > 2 km | 1–3 km |

La vulnerabilidad y los hermanos se reasignan con números aleatorios fijos por familia (`u_vulnerable`,
`u_hermano`), así que al subir un porcentaje las familias que ya lo eran lo siguen siendo. Con los valores por
defecto el resultado es exactamente el de Python. **Simula una familia** agrega una familia más con los datos que
elige el visitante y vuelve a correr las dos asignaciones completas.

## Métricas
- % fuera de sus opciones (no quedó en ninguna de las que pidió) — la métrica central
- % en su 1.ª opción
- % reubicados y % sin ningún cupo cercano (tras la reubicación)
- % de vulnerables fuera de sus opciones
- % de viajes de más de 2 km y distancia promedio casa–colegio
- % fuera de sus opciones en la zona crítica, y por UPZ (para colorear el mapa)

## Resultados principales (datos reales, supuestos por defecto)

| | 1.ª opción | Fuera de opciones | Reubicados | Sin cupo | Viajes > 2 km | Vulnerables fuera | Zona crítica fuera |
|---|---|---|---|---|---|---|---|
| Hoy (orden de llegada) | 53,2% | 23,6% | 9,9% | 13,7% | 6,3% | 22,5% | 23,1% |
| Equilibrada | 54,3% | 24,0% | 10,1% | 14,0% | 3,5% | 1,8% | 23,6% |
| Equidad | 55,4% | 24,2% | 10,2% | 14,0% | 3,6% | 0,7% | 22,9% |
| Equilibrada + colegio en Tibabuyes | 54,6% | 23,7% | 10,4% | 13,3% | 3,5% | 1,8% | 17,1% |
| Equilibrada + 5 opciones | 52,1% | 20,7% | 6,7% | 14,0% | 3,6% | 0,7% | 19,0% |
| Equilibrada + jornada única | 49,5% | 29,7% | 7,0% | 22,7% | 1,7% | 2,7% | 28,5% |

Lecturas:
- **Las prioridades deciden *quién* cabe, no *cuántos*.** Fuera de sus opciones se mantiene en unos 24%, pero los
  vulnerables fuera bajan de 22,5% a 1,8% y los viajes largos casi a la mitad (6,3% → 3,5%).
- **La capacidad decide cuántos.** Un colegio de 1.200 cupos en Tibabuyes baja la zona crítica de 23,6% a 17,1%
  (con las mismas reglas Equilibradas); la jornada única sin ampliar capacidad sube los niños sin cupo de 13,7% a 22,7%.
- **Más opciones** (5 en vez de 3) bajan "fuera de sus opciones", pero no los niños sin cupo: el faltante es real.

## Limitaciones
- **Ubicación de la demanda:** viene de proyecciones de población, no del lugar de residencia real de
  quienes piden cupo (eso está en SIMAT y no es público). Dentro de la UPZ se usan manzanas residenciales pesadas
  por número de predios: un predio no es una vivienda exacta (cuenta también locales, garajes o depósitos en
  propiedad horizontal, y una casa con varios hogares es un solo predio) y no dice cuántos niños viven ahí.
- **Coordenadas de colegios:** en 15 de 747 sedes la SED y Catastro difieren más de 10 m; se eligió por
  dirección (ver arriba), sin verificación en terreno.
- **Distancia en línea recta**, no tiempo de viaje por la red vial o el SITP.
- **Todos los niveles juntos:** no se distingue preescolar, primaria, secundaria ni media.
- **Cupos de nuevos repartidos de forma proporcional** a la oferta regular de cada sede; la distribución
  real por sede puede ser distinta.
- **Polígonos de UPZ** tomados de un dataset temático de la SED, porque el dataset oficial de límites tiene
  acceso restringido.
- **Hermanos y vulnerabilidad simulados** con porcentajes uniformes; no salen de datos por sede.
- **La jornada única** se aplica como una reducción pareja del 10% en todas las sedes.
- **Reubicación simplificada:** radio fijo en línea recta; la SED también considera jornada y nivel.
- **Una sola semilla.** Con otra semilla las cifras cambian décimas de punto, no la dirección de los efectos.

## Reproducir
```bash
python -m engine.build_scenarios        # descarga lo que falte y precalcula los 324 escenarios (~1–3 min)
pytest tests                            # algoritmo, capacidad, estabilidad, semilla y validación de datos
```
Todos los parámetros están en `engine/simulador/config.py`.
