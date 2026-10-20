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

   En pantalla se muestran 3 presets: **Cercanía** (alto / bajo / bajo), **Familias** (medio / alto / bajo)
   y **Equidad** (medio / medio / alto). Los 27 niveles quedan precalculados de todas formas.
6. **Algoritmo.** Asignación diferida (Gale-Shapley) con propuesta de los estudiantes. Es estable (cero pares
   bloqueantes, verificado en cada uno de los 324 escenarios), respeta la capacidad y es reproducible con
   la misma semilla.
6b. **El proceso en la pantalla.** El navegador vuelve a correr el algoritmo (asignación diferida por rondas,
   `web/src/motor.ts`) para animarlo en la localidad elegida. Usa las mismas distancias y desempates redondeados
   a 4 decimales que Python, y `npm run verificar` comprueba que el resultado coincide en los 36 escenarios de la
   interfaz y en la línea base. Cada punto del mapa es una familia sintética (10 niños).
7. **Línea base ("hoy").** Orden de llegada: un orden aleatorio con semilla, y cada familia toma su primera
   opción con cupo disponible.
8. **Palancas.**
   - *Colegio nuevo:* +1.200 cupos (el dataset no trae cupos) en uno de 5 proyectos reales de la SED:
     Ciudadela Cafam II (Tibabuyes), Theilard de Chardin (Suba), Indusel (Bosa Occidental), Boita (Timiza)
     y Hacienda Casa Blanca (Arborizadora).
   - *Jornada única:* −10% de capacidad en todas las sedes (configurable).
9. **Zona crítica.** Las 10 UPZ con más niños sin cupo en la línea base: Calandaima, Tibabuyes, El Porvenir,
   Tintal Sur, Ismael Perdomo, Patio Bonito, Engativá, Jerusalem, Diana Turbay y Marruecos. Es la misma en todos los escenarios.
10. **Distancia** en línea recta entre la casa y el colegio.

## Métricas
- % de niños asignados a su 1.ª opción
- % de niños sin cupo en ninguna de sus 3 opciones
- Distancia promedio casa–colegio (km, entre los asignados)
- % de niños vulnerables sin cupo
- % de niños de la zona crítica sin cupo
- % sin cupo por UPZ (para colorear el mapa)

## Resultados principales (datos reales)

| | 1.ª opción | Sin cupo | Distancia | Vulnerables sin cupo | Zona crítica sin cupo |
|---|---|---|---|---|---|
| Hoy (orden de llegada) | 53,3% | 23,2% | 0,64 km | 21,9% | 34,2% |
| Equidad | 55,7% | 23,7% | 0,55 km | 0,7% | 35,3% |
| Equidad + colegio en Tibabuyes | 55,9% | 23,3% | 0,55 km | 0,6% | 33,6% |
| Con jornada única (pesos medios) | 50,0% | 29,2% | 0,55 km | 3,2% | 41,2% |

Lecturas:
- **Las prioridades deciden *quién* queda sin cupo, no *cuántos*.** El total se mantiene en unos 23%.
- **La ubicación del colegio nuevo importa.** Solo Tibabuyes está dentro de la zona crítica, y un colegio
  de 1.200 cupos frente a unos 37.000 niños sin cupo mueve poco el total.
- **Jornada única** cuesta unos 6 puntos más de niños sin cupo si no se amplía la capacidad.
- El 23% sin cupo es mayor que el faltante estructural (11,7%): el resto son niños que no alcanzan cupos
  libres dentro de sus 3 opciones.

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
- **Una sola semilla.** Con otra semilla las cifras cambian décimas de punto, no la dirección de los efectos.

## Reproducir
```bash
python -m engine.build_scenarios        # descarga lo que falte y precalcula los 324 escenarios (~1–3 min)
pytest tests                            # algoritmo, capacidad, estabilidad, semilla y validación de datos
```
Todos los parámetros están en `engine/simulador/config.py`.
