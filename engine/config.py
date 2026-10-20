"""
Configuración y supuestos del modelo.

Todos los supuestos que afectan los resultados viven aquí para que sean
fáciles de auditar y de mostrar en el README / en la pantalla "¿Cómo lo hicimos?".
"""
from dataclasses import dataclass, field, asdict
from pathlib import Path

# Nombre de la app (se exporta en resumen.json; el front tiene su propia constante)
APP_NAME = "Matrícula+"

# Rutas del proyecto
RAIZ = Path(__file__).resolve().parents[1]
DATA_RAW = RAIZ / "data" / "raw"
DATA_PROCESSED = RAIZ / "data" / "processed"
WEB_DATA = RAIZ / "web" / "public" / "data"


@dataclass
class Supuestos:
    # --- Población simulada ---
    n_estudiantes: int = 30_000          # solicitudes nuevas simuladas
    n_sedes_objetivo: int = 400          # sedes oficiales (solo datos sintéticos)
    holgura_global_cupos: float = 1.04   # cupos totales / solicitudes (hay cupos, pero mal ubicados)

    # % de población priorizada (se aplican sobre el total de estudiantes)
    pct_hermanos: float = 0.12           # tiene hermano matriculado en una sede cercana
    pct_discapacidad: float = 0.03
    pct_victimas: float = 0.06
    pct_etnicos: float = 0.02
    pct_sisben_ab: float = 0.35

    # --- Tiempo de viaje (aproximación documentada) ---
    # distancia en red = distancia en línea recta × factor de tortuosidad
    factor_tortuosidad: float = 1.35
    velocidad_caminando_kmh: float = 4.5
    velocidad_transporte_kmh: float = 13.0   # bus/SITP puerta a puerta en hora pico
    espera_transporte_min: float = 8.0
    umbral_viaje_largo_min: float = 40.0     # "viaje largo" para el KPI

    # --- Preferencias de las familias ---
    n_candidatas: int = 25               # sedes más cercanas consideradas al armar la lista
    min_opciones: int = 3
    max_opciones: int = 5
    # Las familias valoran mucho la cercanía: 1 desviación estándar de calidad ≈ 3 min de viaje
    peso_tiempo: float = 2.0             # utilidad por cada 10 min de viaje (negativa)
    peso_calidad: float = 0.6            # utilidad por desviación estándar de calidad (Saber 11 simulado)
    ruido_preferencias: float = 0.5      # escala del ruido Gumbel (gustos individuales)

    # --- Escenario A: así se asigna hoy ---
    # Con un solo colegio por solicitud, una parte de las familias pide "a la segura"
    # el más cercano en vez de su verdadero favorito (comportamiento estratégico).
    pct_pide_mas_cercano_hoy: float = 0.5
    # Más allá de este radio la familia queda "sin cupo". 8 km en línea recta ≈ 55 min en bus.
    radio_razonable_km: float = 8.0

    # --- Prioridad de las sedes ---
    # Dentro de cada nivel de prioridad, la sede prefiere a quien vive más cerca
    # (criterio de cercanía de la SED). Bandas en km; el desempate final es la lotería.
    bandas_cercania_km: tuple = (1.0, 2.5)

    # --- Escenario B: con Matrícula+ ---
    # Mismo radio que hoy: la mejora sale del algoritmo, no de mandar niños más lejos.
    radio_optimizacion_km: float = 8.0
    vecinos_flujo: int = 60              # arcos por estudiante en el flujo de costo mínimo
    # Cada minuto por encima de 40 "cuesta" 7 minutos: el flujo evita los viajes largos
    penalizacion_viaje_largo: float = 6.0
    # Cupo garantizado: el flujo respeta las listas. Bajar una posición "cuesta" 8 min
    # y un colegio fuera de la lista, 45 min (solo se usa si no hay otra forma de dar cupo).
    costo_rango_min: float = 8.0
    costo_fuera_lista_min: float = 45.0

    # --- Exportación ---
    n_muestra_animacion: int = 4_000     # estudiantes (los mismos en ambos escenarios)

    semilla: int = 20251103

    def como_dict(self) -> dict:
        return asdict(self)
