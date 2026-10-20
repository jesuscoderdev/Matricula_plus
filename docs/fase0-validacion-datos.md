# Fase 0 — Validación de datos (20-10-2026)

Descargados a `data/raw/real/`. Todo viene de datosabiertos.bogota.gov.co y del servicio ArcGIS de Catastro.

## Granularidad de cada dataset

| Dataset | Corte | Granularidad | Lo que trae | Uso en el modelo |
|---|---|---|---|---|
| Oferta de cupos, sector oficial | 03.2025 | **por sede** (747 puntos, 412 instituciones) | cupos por nivel: preescolar, primaria, secundaria, media, aceleración y educación de adultos (`Educacion_`) | capacidad de cada sede, directa |
| Demanda de cupos, sector oficial | 03.2025 | **por institución** (412 puntos) | solicitudes por nivel | se reparte entre las sedes de cada institución según su oferta |
| Colegios (Catastro) | 2026 | por sede (2.211; 773 oficiales, `SECTOR = 2`) | nombre de sede, DANE de sede, UPZ (código) | nombres y emparejamiento |
| Matrícula total, colegios oficiales | 04.2025 | por sede (747) | matrícula total (708.201), discapacidad, grupos étnicos | % de vulnerables por sede (opcional) |
| Matrícula en jornada única | 03.2025 | por sede (379 sedes) | matrícula en jornada única (185.201) | palanca de jornada única (opcional) |
| Colegios oficiales nuevos y en restitución | 05.2026 | 28 proyectos (puntos) | tipo de proyecto, UPZ y estado; **sin cupos** | ubicaciones reales para la palanca "Colegio nuevo" |
| Proyecciones de población por UPZ (SDP/DANE) | 2005–2035 | **por UPZ** (112) y año, en quinquenios de edad | población 5–17 en 2026 ≈ 1.203.277 | **ubicar a las familias donde viven** |
| Densidad de matriculados | 2024 | ráster (GDB/TIFF) | densidad | no hace falta: las proyecciones por UPZ son mejores |
| Polígonos de UPZ | 2024 | 118 polígonos (112 urbanos) | código y nombre | mapa (el dataset oficial de IDECA tiene acceso restringido) |

## Validación contra el Estudio de insuficiencia SED 2025

| Cifra de referencia | Datos | Resultado |
|---|---|---|
| Cupos oficiales 2025: **785.191** | preescolar + primaria + secundaria + media + aceleración = **784.632** | ✅ error **−0,07%** |
| 413 colegios oficiales | **412** instituciones (DANE12) | ✅ −1 |
| Cupos para nuevos: **140.377** | ❌ no hay columna de nuevos/antiguos | no se puede validar directo |
| Demanda de nuevos 2024: **158.957** | demanda total 782.726 (sin separar nuevos) | no se puede validar directo |

⚠️ `OTotal` de la oferta (818.542) **incluye 33.910 cupos de educación de adultos**. El pipeline actual
usa `OTotal`; se corrige para usar 784.632.

## Decisiones que cambian los resultados (necesito tu visto bueno)

1. **¿Simular solo nuevos o el total?** Los datasets no separan nuevos de antiguos.
   - **A (recomendada):** simular **nuevos** con las cifras del estudio SED: 158.957 solicitudes y
     140.377 cupos (relación 0,883). La capacidad de nuevos se reparte entre las sedes en proporción a
     su oferta, y la demanda, según su demanda. Muestra la insuficiencia real y es lo que hace `sim.py`.
   - B: simular el total (784.632 cupos frente a 782.726 solicitudes, relación 1,00). Casi no hay déficit.
2. **¿Dónde viven las familias?**
   - **A (recomendada):** por **población de 5 a 17 años por UPZ** (proyección 2026), ajustada para que el
     total por localidad cuadre con la demanda oficial. Así cuenta el desajuste entre dónde viven los niños y dónde están los cupos.
   - B: donde está el colegio que recibió la solicitud. Es lo que se usa hoy y subestima el problema.
3. **Cupos del colegio nuevo:** el dataset no los trae. Propuesta: 1.200 cupos (configurable).
   Ubicaciones *reales* de proyectos de la SED en zonas críticas: Ciudadela Cafam II (Tibabuyes),
   Theilard de Chardin (Suba), Indusel (Bosa Occidental), Boita (Timiza, Kennedy) y Hacienda Casa Blanca (Arborizadora, Ciudad Bolívar).
   El Rincón no tiene proyecto en el dataset.
4. **Jornada única:** −10% de capacidad a todas las sedes (como dice el brief), o solo a las sedes
   que todavía no la tienen (el dataset de matrícula en jornada única lo permite).
