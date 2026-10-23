# Matrícula+ · ¿Dónde cabe cada niño?

Demostrador interactivo de Proliferante para el stand GovTech del 3 y 4 de noviembre de 2026:
un simulador de asignación de cupos en colegios oficiales de Bogotá, construido con datos abiertos.

Muestra el **método Proliferante**: datos abiertos → modelo → simulación → decisión → aprendizaje.
El visitante lo entiende y lo usa en unos 60 segundos y termina en un QR para agendar una cita.

Un **atlas interactivo** en 5 capítulos, con un solo mapa que cambia de escena:

1. **Problema, en vivo:** el visitante elige su localidad y ve **cómo se asigna hoy**: las familias llegan una por una,
   los colegios se llenan, quien llega tarde no cabe y la SED **reubica** a quien puede en el colegio con cupo más cercano
   (en Bogotá, 37.460 niños nuevos quedan fuera de sus opciones).
2. **Acción:** decide las reglas (prioridad **Equilibrada** / Cercanía / Familias / Equidad, pesos finos en PC), un
   **colegio nuevo** según la localidad (los proyectos reales de la SED que le ayudan y «el mejor lugar» que sugiere la
   simulación, cada uno con cuántos niños ayuda) **o en cualquier punto del mapa**, jornada única y cuántos colegios
   puede pedir cada familia (3–5). Con ▶ Asignar ve la **asignación diferida por rondas**, la **optimización de cupos**
   (para que quepan más niños en sus opciones, sin separar hermanos) y la reubicación, con pausa, ronda a ronda y velocidad. Al tocar una familia se ve su historia (hoy vs Matrícula+); al tocar un colegio, sus cupos.
3. **Resultado:** la localidad, Bogotá y la **zona crítica de la SED** (Tibabuyes y El Rincón), con una frase de lectura,
   dónde queda cada niño (1.ª opción / otra / reubicado / sin cupo) y las métricas con su cambio.
4. **Supuestos editables:** % de vulnerables y de hermanos, cupos del colegio nuevo, distancia de reubicación, costo de
   la jornada única y umbral de viaje largo. Todo se vuelve a simular en el navegador (~40 ms por simulación).
5. **Método** Proliferante + Proli + QR para agendar una cita.

Además: **Simula una familia** (dónde vive, cuántos niños, vulnerable, hermano, sus colegios y cuándo llega → dónde queda
hoy y con Matrícula+, y por qué), **Explorar** UPZ por UPZ y **Agendar**. Los supuestos van siempre en el pie.

El navegador corre la misma asignación diferida que Python y da exactamente el mismo resultado (`npm run verificar`:
48 escenarios + base); después aplica la optimización de cupos, que verifica por su cuenta (nadie pierde su cupo, no se
separan hermanos, nunca queda por debajo de la diferida ni del orden de llegada). Ver [docs/supuestos.md](docs/supuestos.md).

Recorrido de respaldo para el stand (60 s): [docs/recorrido-60s.gif](docs/recorrido-60s.gif)

Supuestos, fuentes y limitaciones: [docs/supuestos.md](docs/supuestos.md) · Validación de datos:
[docs/fase0-validacion-datos.md](docs/fase0-validacion-datos.md) · Lo que falta: [PENDIENTES.md](PENDIENTES.md)

## Estructura

```
data/raw/            datasets descargados (no se versionan)
data/processed/      salidas: simulador/upz.geojson, colegios.geojson, familias.parquet
engine/              Python: carga de datos, familias sintéticas, algoritmo, métricas
  simulador/         motor del simulador de palancas
  build_scenarios.py precálculo de los 324 escenarios
scenarios/           JSON precalculados (uno por combinación) + indice.json + todos.json
tests/               pytest
web/                 app Vite + React + deck.gl (PWA), y demo-offline.html (doble clic)
totem/               lanzador del tótem en Windows
docs/                supuestos, validación de datos, prototipo de referencia (sim.py)
```

## 1. Instalar

Requiere **Python 3.11+** y **Node 20+**.

```bash
python -m venv .venv
.venv\Scripts\activate                 # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
cd web && npm install && cd ..
```

## 2. Descargar los datos y precalcular

```bash
python -m engine.build_scenarios       # descarga lo que falte a data/raw/real/ y precalcula todo (~1–3 min)
python -m engine.build_scenarios --fuente sintetica   # sin internet: datos sintéticos con las mismas proporciones
pytest tests                           # 314 tests
cd web && npm run verificar            # el motor del navegador da lo mismo que Python (48 escenarios + base)
```

Si la descarga falla, `build_scenarios` usa automáticamente el modo sintético para no bloquear el trabajo.
Genera `scenarios/` y lo copia a `web/public/simulador/`.

## 3. Abrir el demo

| Forma | Comando | Para qué |
|---|---|---|
| **Doble clic** | `web/demo-offline.html` | Un solo archivo con todo adentro: no necesita servidor ni internet. Se genera con `cd web && npm run build:archivo` |
| Servidor local | `cd web && npm run build && npm run preview` → http://localhost:4173 | PWA instalable y offline después de la primera carga |
| `python -m http.server` | `cd web/dist && python -m http.server 4173` | Igual que el anterior, sin Node en el equipo del stand |
| Desarrollo | `cd web && npm run dev` | Con recarga en caliente |

### Modos (parámetro en la URL)

| URL | Para qué |
|---|---|
| `?modo=stand` | **Tótem táctil** vertical 1080×1920. Toca la portada para empezar; vuelve a la portada tras **30 s** sin interacción |
| `?modo=auto` | **Tótem sin interacción:** recorre portada + 5 capítulos solo (unos 67 s), con otra localidad y otras palancas en cada vuelta |
| sin parámetro | Se adapta a la pantalla: **PC** si es ancha (relato a la izquierda, mapa a la derecha) o **celular** (mapa arriba, relato abajo). Empieza en la **portada** |
| `?modo=escritorio` / `?modo=celular` | Fuerza la vista de PC o de celular |
| `_previa-stand.html` | Herramienta de desarrollo: muestra el tótem a 1080×1920 escalado a la ventana |

**Reinicio oculto:** mantener presionado el logo **Matrícula+** durante 3 segundos.

**Modo presentación (PC):** `←` `→` (o el control remoto de diapositivas, `RePág`/`AvPág`) cambian de capítulo,
`Espacio` asigna en Acción, `Inicio` vuelve a la portada y `F` pone pantalla completa.

Los mapas se pueden **arrastrar y hacer zoom** (rueda del mouse, pellizco o doble clic), salvo en `?modo=auto`.
El botón **⤢ Centrar** los devuelve a la vista inicial.

### En el celular
- **Mismo Wi-Fi que el PC:** `npm run preview` muestra una dirección *Network* (por ejemplo `http://192.168.1.40:4173`);
  ábrela en el navegador del celular. Si no carga, permite Node.js en el Firewall de Windows (redes privadas).
- **Para el evento (QR):** publica `web/dist` en un hosting con HTTPS (Netlify, Vercel o GitHub Pages) y genera el QR
  con esa URL. Con HTTPS la app se puede *agregar a la pantalla principal* y funciona sin conexión después de la primera visita.

### Tótem en Windows (kiosco)
```bat
totem\lanzar-totem.bat            :: táctil, desde demo-offline.html (sin servidor)
totem\lanzar-totem.bat auto       :: recorrido automático
```
El comando base es `chrome --kiosk --app=file:///…/web/demo-offline.html?modo=stand`, o con servidor
`chrome --kiosk --app=http://localhost:4173/?modo=stand`. Para salir: `Alt+F4`.
Pon Windows en orientación vertical y desactiva la suspensión de pantalla.

**Android:** abre `demo-offline.html` o la URL del servidor en un navegador de kiosco (por ejemplo Fully Kiosk
Browser) con pantalla completa, orientación vertical y pantalla siempre encendida.

## Configuración
- `web/src/config.ts`: nombre, **QR** (`QR_IMAGEN`, p. ej. `./qr-cita.png` en `web/public/`), WhatsApp/Calendly para
  la cita, tiempos del kiosco y del modo auto, y colores.
- `web/src/estilos.css`: identidad del Manual de marca de Proliferante. Navy `#162B2A` (base; fondo del modo oscuro),
  verde `#7BC689` (foco), índigo `#5A44DD` (acción: botones e interactivos), azul claro `#C7D7EC` (respiro) y pizarra
  `#505B7D` (soporte de textos); papel blanco. En los datos: índigo (en sus opciones), pizarra
  (reubicados) y verde (sin cupo cercano). Tipografías **MuseoModerno** (titulares y logo Matrícula+), **Poppins** (interfaz, cuerpo y
  cifras) y **Caveat Brush** (acento emocional, una frase por sección: clase `.acento`), incluidas localmente.
- `engine/simulador/config.py`: totales de nuevos, % de hermanos y vulnerables, pesos de prioridad, presets,
  ubicaciones y cupos del colegio nuevo, reducción por jornada única, zona crítica y semilla.
- **Proli**, la mascota (`web/src/assets/proli.webp`), aparece en la portada del tótem, en el método y en Agendar; el
  logo oficial de Proliferante (`web/src/assets/logo-proliferante.webp`) va en la portada.
- Con `QR_IMAGEN` vacío no se pide ningún archivo, así no hay errores en consola.

## Seguridad y carga
- **Sitio 100% estático:** sin servidor, sin base de datos, sin claves ni datos personales (familias sintéticas).
  El formulario de cita no envía nada: arma un mensaje que el visitante manda desde su propio WhatsApp.
- **Cabeceras** en `web/vercel.json`: CSP estricta (solo recursos propios, sin `eval`, sin iframes de terceros),
  HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (sin cámara, micrófono ni ubicación),
  COOP/CORP. `npm run preview` aplica las mismas (sin HSTS, porque va por http) para probarlas en local.
- `npm audit --omit=dev`: 0 vulnerabilidades. `web/.vercelignore` deja fuera `demo-offline.html` y los builds locales.
- **Carga:** un esqueleto con la forma de la app aparece desde el primer instante (en `index.html`, antes del
  JavaScript) y se mantiene mientras cargan los datos; si fallan, muestra el error y **Reintentar**. El logo hace
  de cargador: se encoge a **M+** y se abre cada vez que algo se recalcula o cambia de capítulo, y alterna
  Matrícula+ ↔ M+ cada 5,3 s (`SEGUNDOS_ANIMACION_LOGO`).

## Criterios del brief

| Criterio | Estado |
|---|---|
| Capacidad cuadra con la SED (785.191, error < 1%) | ✅ 784.632 (−0,07%), con un test |
| Ningún colegio supera su capacidad · cero pares bloqueantes · misma semilla = mismo resultado · casos a mano | ✅ tests y verificación de estabilidad de la asignación diferida en los 324 escenarios (la optimización posterior no es estable: ver docs/supuestos.md) |
| Precálculo en < 10 min | ✅ ~1–3 min |
| Respuesta del frontend < 200 ms | ✅ ~40 ms por simulación completa (medido); se corren dos (hoy y la política) |
| Funciona sin conexión | ✅ servidor apagado + service worker, y `demo-offline.html` desde `file://` |
| 2 h sin errores en consola · recarga < 30 s | ver `PENDIENTES.md` |

## Recorrido narrativo anterior
`python -m engine.run` regenera el modelo de la primera versión ("hoy vs Matrícula+ con cupo garantizado",
`engine/asignacion/`). Ya no lo usa la app web y queda como referencia.
