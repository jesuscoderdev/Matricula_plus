# Matrícula+ — asignación inteligente de cupos escolares (Bogotá)

Demo de Proliferante: **datos abiertos → modelo → simulación de políticas → impacto medible**.

En Bogotá hay cupos oficiales, pero no donde vive la gente: hay déficit en UPZ como
Tibabuyes, El Rincón, Bosa Occidental, Tintal Sur, Patio Bonito y Garcés Navas, y
superávit en Usme, Tunjuelito y San Cristóbal. Matrícula+ compara la asignación
actual (orden de llegada, un solo colegio) contra una asignación centralizada con
preferencias ordenadas (aceptación diferida, como el SAE de Chile) más una
optimización de red por tiempo de viaje.

> Estado: **las 4 etapas listas**: pipeline + algoritmo + tests, frontend, modos tótem/celular, PWA
> offline y datos reales de la SED. Lo que falta para el evento está en [PENDIENTES.md](PENDIENTES.md).

## Estructura

```
data/raw/            # descargas reales (etapa 4) y copia "cruda" de los sintéticos
data/processed/      # JSON finales que consume el front
engine/              # Python: datos, recorrido narrativo y simulador de palancas
tests/               # pytest
web/                 # app Vite + React + deck.gl (PWA)
totem/               # lanzador del tótem en Windows (Chrome en kiosco)
```

## Cómo correr el pipeline

Requiere Python 3.11+.

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt

python -m engine.run                     # datos sintéticos (por defecto)
python -m engine.run --fuente real       # datos reales (etapa 4)
python -m engine.run --estudiantes 20000 --semilla 7
pytest tests                      # tests del algoritmo
```

`run.py` regenera todo en ~10 s, verifica que la asignación de Matrícula+ sea estable
(si no lo es, falla) e imprime la tabla comparativa. Si existe `web/`, copia los JSON
a `web/public/data/`.

### Archivos generados (`data/processed/`)

| Archivo | Contenido |
|---|---|
| `upz.geojson` | Geometría simplificada de las UPZ + demanda, oferta, balance, estado (déficit/superávit/equilibrio) y niños sin cupo por escenario |
| `localidades.geojson` | Ídem por localidad |
| `colegios.json` | Sedes: código DANE, nombre, ubicación, cupos, calidad simulada y ocupación en cada escenario |
| `escenario_hoy.json` | KPIs (global, por localidad, por UPZ) + muestra de 4.000 asignaciones origen→sede para animar |
| `escenario_matricula.json` | Lo mismo para Matrícula+. La muestra tiene **los mismos estudiantes en el mismo orden** que la de hoy, para animar el "reacomodo" |
| `resumen.json` | Cifras grandes de la app: KPIs globales, deltas, comparación por localidad, localidad foco, supuestos |

En la muestra, `sede = -1` significa sin cupo y `opcion = 0` significa fuera de su lista o sin cupo.
Se sobremuestrean ×3 los niños que hoy quedan sin cupo para que se vean en el mapa;
`resumen.factor_expansion_muestra` permite escalar conteos.

## Cómo correr la app

Requiere Node 20+.

```bash
python -m engine.run          # genera los JSON y los copia a web/public/data
cd web
npm install
npm run dev                     # desarrollo con recarga en caliente
npm run build                   # build estático en web/dist
npm run preview                 # sirve web/dist en http://localhost:4173 (también en la red local)
```

### Modos

| URL | Para qué |
|---|---|
| `http://localhost:4173/` | **Celular** (diseño base 390×844): recorrido + "Mi localidad" (selector, mapa, detalle por UPZ) + "Agendar cita", con barra inferior |
| `http://localhost:4173/?modo=stand` | **Tótem táctil** vertical 1080×1920, sin scroll. Si nadie toca la pantalla en 20 s, vuelve al modo espera |
| `http://localhost:4173/?modo=auto` | **Tótem sin interacción**: el recorrido corre solo en bucle (~50 s por vuelta) y cambia de localidad en cada vuelta |
| `http://localhost:4173/_previa-stand.html` | Herramienta de desarrollo: muestra el tótem a 1080×1920 escalado a la ventana (`?modo=auto`, o `?modo=celular&w=390&h=844`) |

La interfaz se diseña en rem sobre 390×844, y el tamaño raíz se calcula según la pantalla:
a 1080×1920, 1 rem ≈ 36 px y los botones miden unos 125 px de alto.

### Offline (PWA)
`npm run build` genera un service worker que precachea todo: código, fuente Inter, íconos y los
JSON. El mapa es vectorial (GeoJSON con deck.gl), sin tiles externos. Después de la primera
carga la app funciona **sin servidor y sin internet**. Se probó apagando el servidor y recargando
la página. En el celular se puede "Agregar a la pantalla principal".

> El service worker solo se activa en `localhost` o en HTTPS. Si se abre por la IP de la red
> local (`http://192.168.x.x:4173`), la app funciona igual mientras el servidor esté encendido,
> pero sin la caché offline.

### Configuración (`web/src/config.ts`)
`APP_NAME`, `EMPRESA`, `MOSTRAR_QR` (apagado por ahora), `URL_APP` (URL del QR),
`WHATSAPP_CITA` / `CALENDLY_CITA` (botón "Agendar"), `SEGUNDOS_INACTIVIDAD` y los colores
del mapa. Los colores de la interfaz son variables CSS en `web/src/estilos.css` (`--acento`, `--deficit`, …).
El logo va en `web/public/logo-proliferante.svg`; si no está, se muestra el nombre en texto.

## Tótem

**Windows (PC con pantalla vertical):**
```bat
totem\lanzar-totem.bat          :: táctil (?modo=stand)
totem\lanzar-totem.bat auto     :: sin interacción (?modo=auto)
```
El lanzador levanta el servidor local y abre Chrome en kiosco con un perfil propio, sin
diálogos, sin gestos de zoom y sin navegar atrás con el gesto. El comando base es:
```
chrome --kiosk --app=http://localhost:4173/?modo=stand
```
Para salir: `Alt+F4`. Configura Windows en orientación vertical (Configuración → Pantalla →
Orientación) y desactiva la suspensión de pantalla.

**Android (tótems con Android integrado):**
1. Instala un navegador de kiosco, por ejemplo *Fully Kiosk Browser*, o usa Chrome con la fijación de pantalla de Android.
2. Opción A, sin internet: sirve la app desde un portátil en la misma red (`npm run preview`) y abre
   `http://IP-DEL-PORTATIL:4173/?modo=stand`. El portátil debe quedar encendido durante el evento.
3. Opción B, offline real: publica `web/dist` en un hosting con HTTPS, abre la URL una vez con
   internet (el service worker guarda todo) y desde ahí funciona sin conexión.
4. En el navegador de kiosco: pantalla completa, orientación vertical, pantalla siempre encendida,
   y recargar la URL de inicio tras inactividad (la app ya vuelve sola al modo espera a los 20 s).

## El modelo

### Población (siempre sintética)
Los microdatos de SIMAT son privados, así que los estudiantes se simulan: la cantidad
por UPZ sale de la demanda, cada uno vive en un punto aleatorio dentro de su UPZ y se
le asigna una categoría de priorización (12% hermanos, 3% discapacidad, 6% víctimas,
2% étnicos, 35% SISBÉN A/B).

**Preferencias:** cada familia ordena de 3 a 5 de sus 25 sedes más cercanas según
`utilidad = −2 × (tiempo/10 min) + 0,6 × calidad_estandarizada + gusto aleatorio (Gumbel)`.
Una desviación estándar de calidad (Saber 11 simulado) vale unos 3 minutos de viaje.
Las familias con hermano ponen primero la sede del hermano.

### Escenario A — "Así se asigna hoy"
1. Primero se procesan los priorizados y luego el resto; dentro de cada fase, el orden de llegada es aleatorio.
2. Cada familia pide **una** sede: el 50% pide su favorita y el otro 50% pide "a la segura" la más cercana
   (comportamiento estratégico típico cuando solo se puede pedir una).
3. Si esa sede está llena, se le asigna la más cercana con cupo dentro de 8 km; si no hay ninguna, queda **sin cupo**.

### Escenario B — "Con Matrícula+"
1. **Cupo garantizado:** un flujo de costo mínimo sobre toda la población (OR-Tools; networkx si
   no está instalado) le reserva a cada niño una sede dentro de 8 km. Primero maximiza cuántos
   tienen cupo y, entre esas soluciones, minimiza un costo que combina:
   - el tiempo de viaje;
   - 8 min por cada posición que se baje en la lista de la familia;
   - 45 min si la sede no está en su lista;
   - 6 min extra por cada minuto que pase de 40 (para evitar viajes largos).
2. La sede garantizada se agrega al final de la lista de la familia, si no estaba, y allí el niño
   tiene la máxima prioridad, así que nunca lo rechazan.
3. **Aceptación diferida** (Gale-Shapley con propuesta de los estudiantes) sobre esas listas.
   Prioridad en cada sede: hermano en esa sede > discapacidad/víctimas/étnicos > SISBÉN A/B > resto.
   Dentro de cada nivel se desempata por cercanía (bandas de ≤1 km, ≤2,5 km y más lejos) y luego por
   lotería con semilla fija. Cada niño termina en su garantía o en una sede que prefiere más.
4. Si alguien quedó sin garantía porque no hay cupo dentro del radio, se intenta un último flujo con los cupos sobrantes.

**Por qué el cupo garantizado:** sin él, la aceptación diferida "pura" mejora a nivel ciudad,
pero perjudica justo a las zonas en déficit. Los niños de Bosa agotaban sus opciones y quedaban
para el final, cuando los cupos cercanos de Kennedy ya estaban tomados. En la simulación,
Bosa pasaba de 415 a 517 niños sin cupo. Con la garantía nadie queda peor de lo que el sistema puede asegurarle.

La asignación es **estable** respecto a las listas y prioridades efectivas: no existe un
par estudiante–sede que se prefieran mutuamente sobre lo asignado. Los tests lo verifican
con 200 instancias aleatorias, comprueban por fuerza bruta que el resultado es el mejor
estable para los estudiantes y que nadie termina peor que su garantía. Además, `run.py`
lo vuelve a verificar sobre la corrida real.

**Resultado con datos sintéticos** (30.000 solicitudes):

| | Hoy | Matrícula+ |
|---|---|---|
| Niños sin cupo | 1.306 | 0 |
| En su 1ª opción | 49,1% | 54,1% |
| En su top 3 | 64,9% | 76,6% |
| Viajes de más de 40 min | 1.484 | 888 |
| Tiempo promedio | 14,3 min | 16,2 min |

El tiempo promedio sube porque 1.306 niños que hoy quedan sin cupo pasan a tener uno, y
algunos de ellos viven lejos de los cupos libres. Por eso la app muestra los viajes largos y
deja el promedio como dato secundario.

### Supuestos de tiempo de viaje
`distancia en red = línea recta × 1,35`. El tiempo es lo más rápido entre caminar (4,5 km/h)
y transporte público (13 km/h puerta a puerta + 8 min de espera). Un "viaje largo" es
uno de más de 40 min. Todos los supuestos están en `engine/config.py` y se exportan en
`resumen.json → supuestos`.

### KPIs (global, por localidad y por UPZ de residencia)
Niños sin cupo · % en su 1ª opción · % en su top 3 · tiempo y distancia promedio (de los
asignados) · viajes largos · cupos ociosos (por ubicación de la sede).

## Datos sintéticos
`--fuente sintetica` genera 19 localidades y 112 UPZ **con nombres reales y geometría
aproximada** (polígonos de Voronoi dentro de una silueta de la ciudad), unas 400 sedes, oferta
con una holgura global del 4% y el desbalance territorial descrito arriba. También deja una
copia "cruda" en `data/raw/sintetica/` con la forma de los datasets reales.

## Datos reales (`--fuente real`)

```bash
python -m engine.run --fuente real     # descarga lo que falte a data/raw/real/ y regenera todo
```

### Qué trae cada dataset (descargados el 20-10-2026)

| Dataset | Archivo | Granularidad | Campos clave | Totales |
|---|---|---|---|---|
| [Oferta de cupos, sector oficial](https://datosabiertos.bogota.gov.co/dataset/oferta-de-cupos-sector-oficial-bogota-d-c), corte 03.2025 | `oferta_032025.geojson` | 1 punto por **sede** (747), EPSG:3857 | `DANE12_EST` (institución), `NOMBRE_EST`, `COD_LOCA`, `OPreescola`, `OPrimaria`, `OSecundari`, `OMedia`, `OTotal`, `Aceleracio` | 818.542 cupos (412 instituciones) |
| [Demanda de cupos, sector oficial](https://datosabiertos.bogota.gov.co/dataset/demanda-de-cupos-sector-oficial-bogota-d-c), corte 03.2025 | `demanda_032025.geojson` | 1 punto por **institución** (412), EPSG:3857 | `DANE12_EST`, `NOMBRE_EST`, `Preescolar`, `Primaria`, `Secundaria`, `Media`, `DTotal` | 782.726 solicitudes |
| [Colegios (Catastro)](https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/educacion/infraestructuraeducativa/MapServer/0) | `colegios.geojson` | 1 punto por sede, 2.211 en total (`SECTOR = 2` → 773 oficiales) | `DANE12_EST`, `DANE12_SED`, `NOMBRE_SED`, `SECTOR`, `NOM_UPZ` (código), `NOM_UPL` | descarga paginada (máx. 2.000 por consulta) |
| [Tasa de aprobación escolar oficial por UPZ](https://datosabiertos.bogota.gov.co/dataset/tasa-de-aprobacion-escolar-en-colegios-oficiales-por-upz-bogota-d-c) (SED 2024) | `upz_aprobacion_2024.geojson` | 1 polígono por UPZ/UPR (118), EPSG:3857 | `COD_UPZ`, `NOMBRE_UPZ` (+ tasas) | se usan 112 UPZ urbanas |
| [Localidades (IDECA)](https://datosabiertos.bogota.gov.co/dataset/localidad-bogota-d-c) | `localidades.geojson` | 20 polígonos, EPSG:4686 | `LocCodigo`, `LocNombre` | se usan 19 (sin Sumapaz) |

El dataset oficial de **límites de UPZ** del portal tiene acceso restringido, así que la geometría
se toma del dataset de aprobación escolar, que es de la misma SED y está en el mismo sistema de UPZ.

### Cómo se convierten a la estructura del modelo
1. **UPZ:** se quedan solo las urbanas (código `UPZxx`) y se descartan las 5 UPR rurales. Los polígonos
   repetidos se unen por código y la localidad se asigna por ubicación. Los nombres vienen en mayúsculas
   sin tildes y se restauran con la lista oficial.
2. **Localidades:** la unión de sus UPZ urbanas, para que el mapa no se estire hacia la zona rural. Se excluye Sumapaz.
3. **Sedes:** cada punto de oferta se empareja con la sede más cercana de la misma institución
   (≤ 300 m) en la capa de Catastro, para obtener el nombre y el DANE de la sede. Se descartan 48 sedes
   rurales que quedan fuera de las UPZ urbanas (10.715 cupos).
4. **Demanda:** viene por institución y se reparte entre sus sedes en proporción a la oferta de cada
   una. La demanda de cada sede cuenta en la UPZ donde está la sede.
5. **Escala:** se simulan 30.000 solicitudes con la misma proporción entre oferta y demanda, y todos los
   **conteos que muestra la app se expanden a escala real** (×25,9 → 776.068 solicitudes: las 782.726 menos 6.658 de instituciones sin sede urbana). Porcentajes y tiempos no cambian.
6. **Calidad:** sigue simulada, porque estos datasets no traen Saber 11.

### Resultado con datos reales (expandido a 776.068 solicitudes)

| | Hoy | Matrícula+ |
|---|---|---|
| Niños sin cupo | 724 | 0 |
| En su 1ª opción | 45,8% | 56,9% |
| En su top 3 | 63,7% | 90,5% |
| Viajes de más de 40 min | 3.182 | 0 |
| Tiempo promedio | 9,3 min | 8,8 min |

### Hallazgos que cambian la narrativa del brief
- **El déficit real está en Suba** (−4.838 cupos) y, en menor medida, en Usaquén y Chapinero. Por UPZ: Tibabuyes,
  Granjas de Techo, Patio Bonito, Suba, El Rincón, Arborizadora y Verbenal.
- **Bosa, Kennedy y Engativá tienen superávit** a nivel de localidad (+1.731, +4.033 y +5.362), aunque Patio Bonito
  (Kennedy) sí tiene déficit. Usme (+7.684) y San Cristóbal (+6.446) son las de mayor superávit, como decía el brief.
- La frase "En Suba faltan cupos. En Usme sobran." **se cumple** con los datos reales. Las frases del modo espera
  ahora se calculan a partir de los datos.
- **Limitación importante:** la demanda está registrada en el colegio donde se pidió el cupo, no en el lugar
  donde vive el niño. El modelo ubica a los niños cerca de donde pidieron, así que *subestima* el desajuste
  territorial: los viajes son cortos (9 min en promedio) y hay pocos niños sin cupo. Para medirlo bien
  harían falta datos de residencia, por ejemplo la demanda por UPZ de residencia que tiene la SED (no es pública).

## Fuentes de datos reales (etapa 4)
- Oferta de cupos, sector oficial: https://datosabiertos.bogota.gov.co/dataset/oferta-de-cupos-sector-oficial-bogota-d-c
- Demanda de cupos, sector oficial (por sede): https://datosabiertos.bogota.gov.co/dataset/demanda-de-cupos-sector-oficial-bogota-d-c
- Colegios (IDECA/Catastro): https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/educacion/infraestructuraeducativa/MapServer/0
- Límites de UPZ y localidades: IDECA / Datos Abiertos Bogotá
