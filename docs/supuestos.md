# Supuestos, fuentes y limitaciones — Matrícula+ · "¿Dónde cabe cada niño?"

Simulador de asignación de cupos en colegios oficiales de Bogotá, construido con datos abiertos.
**Es una herramienta para comparar políticas, no una predicción.**

## Fuentes y año de corte

| Dato | Fuente | Corte |
|---|---|---|
| Oferta de cupos por sede (747 sedes, 412 instituciones) | [SED · Oferta de cupos, sector oficial](https://datosabiertos.bogota.gov.co/dataset/oferta-de-cupos-sector-oficial-bogota-d-c) | 03.2025 |
| Demanda de cupos por institución | [SED · Demanda de cupos, sector oficial](https://datosabiertos.bogota.gov.co/dataset/demanda-de-cupos-sector-oficial-bogota-d-c) | 03.2025 |
| Nombres y DANE de sedes | [Catastro · Colegios](https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/educacion/infraestructuraeducativa/MapServer/0) | 2026 |
| Ubicaciones del colegio nuevo | [SED · Colegios oficiales nuevos y en restitución](https://datosabiertos.bogota.gov.co/dataset/colegios-oficiales-nuevos-y-restitucion-bogota-d-c) | 05.2026 |
| Población de 5 a 17 años por UPZ | [SDP/DANE · Proyecciones de población por UPZ](https://datosabiertos.bogota.gov.co/dataset/proyecciones-y-retroproyecciones-de-poblacion-2005-2035) | proyección 2026 |
| Polígonos de UPZ | [SED · Tasa de aprobación escolar oficial por UPZ](https://datosabiertos.bogota.gov.co/dataset/tasa-de-aprobacion-escolar-en-colegios-oficiales-por-upz-bogota-d-c) | 2024 |
| Límites de localidades | [IDECA · Localidad](https://datosabiertos.bogota.gov.co/dataset/localidad-bogota-d-c) | vigente |
| Totales de nuevos (158.957 solicitudes, 140.377 cupos) | Estudio de insuficiencia SED 2025 | 2024–2025 |

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
   para que cada localidad conserve su participación en la demanda oficial. Cada familia vive en un punto
   aleatorio dentro de su UPZ.
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
| Hoy (orden de llegada) | 53,3% | 23,2% | 9,5% | 13,7% | 6,3% | 21,9% | 21,7% |
| Equilibrada | 54,7% | 23,7% | 9,8% | 13,9% | 3,0% | 2,0% | 20,0% |
| Equidad | 55,7% | 23,7% | 9,8% | 13,9% | 3,1% | 0,6% | 20,3% |
| Equilibrada + colegio en Tibabuyes | 55,0% | 23,2% | 10,1% | 13,1% | 3,0% | 2,0% | 12,4% |
| Equilibrada + 5 opciones | 52,3% | 20,2% | 6,4% | 13,8% | 3,1% | 0,6% | 16,0% |
| Equilibrada + jornada única | 50,0% | 29,2% | 6,5% | 22,7% | 1,3% | 3,2% | 25,5% |

Lecturas:
- **Las prioridades deciden *quién* cabe, no *cuántos*.** Fuera de sus opciones se mantiene en unos 23%, pero los
  vulnerables fuera bajan de 21,9% a 2,0% y los viajes largos se reducen a la mitad.
- **La capacidad decide cuántos.** Un colegio de 1.200 cupos en Tibabuyes baja la zona crítica de 21,7% a 12,4%;
  la jornada única sin ampliar capacidad sube los niños sin cupo de 13,7% a 22,7%.
- **Más opciones** (5 en vez de 3) bajan "fuera de sus opciones", pero no los niños sin cupo: el faltante es real.

## Limitaciones
- **Ubicación de la demanda:** viene de proyecciones de población, no del lugar de residencia real de
  quienes piden cupo (eso está en SIMAT y no es público).
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
