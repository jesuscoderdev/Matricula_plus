"""Parámetros del simulador. Todos los supuestos que cambian resultados viven aquí."""
from dataclasses import asdict, dataclass, field

# Niveles de cada peso de prioridad (bajo, medio, alto).
# Unidades: el puntaje de prioridad se mide en "km equivalentes".
#   cercanía: puntos que se restan por cada km de distancia casa–colegio
#   hermanos: puntos que se suman si tiene un hermano en ese colegio
#   vulnerabilidad: puntos que se suman si la familia es vulnerable
NIVELES = ("bajo", "medio", "alto")
PESOS = {
    "cercania": {"bajo": 0.5, "medio": 1.0, "alto": 2.0},
    "hermanos": {"bajo": 0.0, "medio": 2.5, "alto": 5.0},
    "vulnerabilidad": {"bajo": 0.0, "medio": 1.5, "alto": 3.0},
}

# Presets de prioridad que ve el visitante (el brief pide máximo 3 controles visibles).
# (clave, etiqueta, descripción corta, niveles de cercanía / hermanos / vulnerabilidad)
PRESETS = [
    ("cercania", "Cercanía", "Primero quien vive más cerca", ("alto", "bajo", "bajo")),
    ("familias", "Familias", "Primero quien tiene hermanos ahí", ("medio", "alto", "bajo")),
    ("equidad", "Equidad", "Primero las familias vulnerables", ("medio", "medio", "alto")),
]

# Ubicaciones del colegio nuevo: proyectos REALES de la SED (dataset "Colegios oficiales
# nuevos y en restitución", 05.2026). (clave, etiqueta corta, texto a buscar en el nombre del proyecto)
UBICACIONES_NUEVO = [
    ("tibabuyes", "Tibabuyes (Suba)", "Ciudadela Cafam II"),
    ("suba", "Suba centro", "Theilard"),
    ("bosa", "Bosa Occidental", "Indusel"),
    ("kennedy", "Timiza (Kennedy)", "Boita"),
    ("ciudad_bolivar", "Arborizadora (Ciudad Bolívar)", "Casa Blanca"),
]


@dataclass
class ParametrosSimulador:
    # --- Cifras del Estudio de insuficiencia SED 2025 (solo NUEVOS) ---
    demanda_nuevos_total: int = 158_957   # solicitudes de estudiantes nuevos (2024)
    cupos_nuevos_total: int = 140_377     # cupos para nuevos (2025)
    anio_corte: str = "Oferta y demanda SED 03.2025 · proyección de población 2026"

    # --- Escala: cada familia sintética representa a N estudiantes ---
    estudiantes_por_familia: int = 10

    # --- Atributos de las familias ---
    pct_hermano: float = 0.15             # tiene un hermano en uno de sus colegios cercanos
    vecinos_hermano: int = 5              # el hermano estudia en una de sus 5 sedes más cercanas
    pct_vulnerable: float = 0.30

    # --- Preferencias ---
    n_opciones: int = 3
    ruido_km: float = 1.5                 # ruido uniforme sumado a la distancia al ordenar colegios
    anio_poblacion: int = 2026
    frac_15_19: float = 0.6               # de la cohorte 15-19 cuentan 15, 16 y 17 años

    # --- Palancas ---
    cupos_colegio_nuevo: int = 1_200
    reduccion_jornada_unica: float = 0.10  # capacidad × (1 − 10%) en todas las sedes

    # --- Zona crítica: las N UPZ con más niños sin cupo en la línea base (orden de llegada).
    # Se fija una vez y es la misma en todos los escenarios.
    n_upz_zona_critica: int = 10

    semilla: int = 20261103
    desempate_peso: float = 0.01          # el desempate nunca supera una diferencia real de puntaje

    pesos: dict = field(default_factory=lambda: PESOS)
    ubicaciones_nuevo: list = field(default_factory=lambda: UBICACIONES_NUEVO)

    def como_dict(self) -> dict:
        return asdict(self)
