# Matrícula+ · ¿Dónde cabe cada niño?

Demostrador interactivo de Proliferante para el stand GovTech del 3 y 4 de noviembre de 2026:
un simulador de asignación de cupos en colegios oficiales de Bogotá, construido con datos abiertos.

Muestra el **método Proliferante**: datos abiertos → modelo → simulación → decisión → aprendizaje.
El visitante lo entiende y lo usa en unos 60 segundos y termina en un QR para agendar una cita.

- **Problema, en vivo:** el visitante toca su localidad y ve **cómo se asigna hoy**: las familias llegan una por una,
  los colegios se llenan y quien llega tarde se queda sin cupo (en Bogotá, 36.810 niños nuevos).
- **El proceso, en vivo:** con su política, ve la **asignación diferida por rondas** en su localidad: todas piden a la vez,
  cada colegio se queda con las de más prioridad y las rechazadas piden su siguiente opción, hasta que nadie cambia.
  El navegador corre el mismo algoritmo que Python (~10 ms) y da exactamente el mismo resultado (`npm run verificar`).
- **Acción:** 3 palancas: a quién priorizar (Cercanía / Familias / Equidad), dónde construir un colegio nuevo
  (5 proyectos reales de la SED) y jornada única.
- **Resultado:** 5 métricas con su cambio frente a hoy, y el mapa de UPZ recoloreado al instante.
- **Supuestos** siempre a la vista, y **método + QR** al cierre.

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
cd web && npm run verificar            # el motor del navegador da lo mismo que Python (36 escenarios + base)
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
| `?modo=stand` | **Tótem táctil** vertical 1080×1920, sin scroll. Vuelve al inicio tras **30 s** sin interacción |
| `?modo=auto` | **Tótem sin interacción:** recorre los 5 pasos solo (unos 60 s) y mueve las palancas con otra combinación en cada vuelta |
| sin parámetro | **Celular / tablet:** pestañas Simulador · Mi localidad (mapa y detalle por UPZ) · Agendar |
| `_previa-stand.html` | Herramienta de desarrollo: muestra el tótem a 1080×1920 escalado a la ventana |

**Reinicio oculto:** mantener presionado el logo **Matrícula+** durante 3 segundos.

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
- `web/src/estilos.css`: paleta (`--azul-oscuro #14213D`, `--fondo #F6F4EE`, `--naranja #B4561A`,
  `--naranja-claro #E8893D`, `--azul #2F6FB5`). Tipografías Space Grotesk y Public Sans incluidas localmente.
- `engine/simulador/config.py`: totales de nuevos, % de hermanos y vulnerables, pesos de prioridad, presets,
  ubicaciones y cupos del colegio nuevo, reducción por jornada única, zona crítica y semilla.
- **Proli**, la mascota de Proliferante (`web/src/assets/proli.webp`), aparece en la espera, en el método y en Agendar.
- Logo: pon el archivo en `web/public/` y su ruta en `LOGO_IMAGEN` (`web/src/config.ts`). Vacío = nombre en texto.
  Con `QR_IMAGEN` y `LOGO_IMAGEN` vacíos no se pide ningún archivo, así no hay errores en consola.

## Criterios del brief

| Criterio | Estado |
|---|---|
| Capacidad cuadra con la SED (785.191, error < 1%) | ✅ 784.632 (−0,07%), con un test |
| Ningún colegio supera su capacidad · cero pares bloqueantes · misma semilla = mismo resultado · casos a mano | ✅ tests, más la verificación de estabilidad en los 324 escenarios |
| Precálculo en < 10 min | ✅ ~1–3 min |
| Respuesta del frontend < 200 ms | ✅ ~40 ms (medido) |
| Funciona sin conexión | ✅ servidor apagado + service worker, y `demo-offline.html` desde `file://` |
| 2 h sin errores en consola · recarga < 30 s | ver `PENDIENTES.md` |

## Recorrido narrativo anterior
`python -m engine.run` regenera el modelo de la primera versión ("hoy vs Matrícula+ con cupo garantizado",
`engine/asignacion/`). Ya no lo usa la app web y queda como referencia.
