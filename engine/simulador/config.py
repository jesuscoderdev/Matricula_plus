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
    ("equilibrada", "Equilibrada", "Pesan por igual cercanía, hermanos y vulnerabilidad", ("medio", "medio", "medio")),
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
    # --- Cifras del Estudio de insuficiencia y limitaciones SED 2025 (EIL; solo NUEVOS) ---
    # Ojo: 158.957 es la demanda de nuevos de 2024 (p. 13, corte 30-abr-2024) y 140.377 los cupos
    # proyectados para nuevos en 2025 (pp. 14-15, con adultos y aceleración): no son del mismo
    # proceso, así que su resta NO es un déficit. El déficit que reporta la SED es `deficit_sed`.
    demanda_nuevos_total: int = 158_957   # tamaño de la demanda simulada: nuevos de 2024
    # Cupos de nuevos en toda la ciudad por cada solicitud (supuesto). La evidencia dice que en el
    # agregado hay cupos (2025: 122.907 cupos de nuevos y más de 35.000 libres en enero) y que faltan
    # en zonas puntuales; con 1,0 el faltante sale solo de dónde están los cupos y dónde viven los niños.
    cupos_por_solicitud: float = 1.0
    cupos_nuevos_total: int | None = None  # None = round(demanda × cupos_por_solicitud)
    deficit_sed: int = 16_807             # déficit de cupos de Bogotá en 2024 según la SED (EIL, p. 53)
    upz_insuficientes_sed: int = 17       # UPZ en categorías de insuficiencia: 2 muy, 7 media, 8 leve (EIL, p. 12)
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

    # --- Zona crítica: las UPZ con insuficiencia "muy alta" según el Estudio de insuficiencia SED 2025.
    # Si la lista queda vacía, se usan las N UPZ con más niños sin cupo en la línea base.
    zona_critica_nombres: tuple = ("Tibabuyes", "El Rincón")
    n_upz_zona_critica: int = 10

    semilla: int = 20261103
    desempate_peso: float = 0.01          # el desempate nunca supera una diferencia real de puntaje

    pesos: dict = field(default_factory=lambda: PESOS)
    ubicaciones_nuevo: list = field(default_factory=lambda: UBICACIONES_NUEVO)

    def __post_init__(self):
        if self.cupos_nuevos_total is None:
            self.cupos_nuevos_total = int(round(self.demanda_nuevos_total * self.cupos_por_solicitud))

    def como_dict(self) -> dict:
        return asdict(self)
