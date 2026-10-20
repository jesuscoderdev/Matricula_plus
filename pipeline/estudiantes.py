"""
Población SINTÉTICA de estudiantes (los microdatos de SIMAT son privados).

Cada estudiante:
- vive en un punto aleatorio dentro de su UPZ (la demanda por UPZ sale de los datos);
- tiene una categoría de priorización (hermanos, discapacidad, víctimas, étnicos, SISBÉN A/B);
- tiene una lista ordenada de 3 a 5 sedes según tiempo de viaje + calidad + gustos;
- tiene un número de lotería (desempate) con semilla fija.
"""
from dataclasses import dataclass

import numpy as np

from fuentes import Datos
from fuentes.sintetica import _puntos_en
from geo import matriz_distancias, tiempo_viaje_min

# Niveles de prioridad (menor = más prioridad). El nivel 0 (hermanos) es
# específico de la sede donde estudia el hermano; en otras sedes cuenta el nivel base.
NIVEL_HERMANO = 0
NIVEL_VULNERABLE = 1   # discapacidad, víctimas del conflicto, grupos étnicos
NIVEL_SISBEN = 2       # SISBÉN A/B
NIVEL_GENERAL = 3

CATEGORIAS = ["hermano", "discapacidad", "victima", "etnico", "sisben", "general"]


@dataclass
class Poblacion:
    lon: np.ndarray
    lat: np.ndarray
    upz: np.ndarray            # código de UPZ de residencia
    localidad: np.ndarray
    categoria: np.ndarray      # índice en CATEGORIAS
    nivel_base: np.ndarray     # nivel de prioridad fuera de la sede del hermano
    sede_hermano: np.ndarray   # -1 si no aplica
    loteria: np.ndarray        # rango de lotería único (0 = mejor)
    prefs: list                # lista de arreglos de índices de sede, en orden de preferencia
    pide_hoy: np.ndarray       # sede que solicitaría con el sistema actual (una sola)
    dist: np.ndarray           # matriz estudiantes × sedes (km, float32)
    tiempo: np.ndarray         # matriz estudiantes × sedes (min, float32)
    bandas_cercania_km: tuple = ()

    @property
    def n(self) -> int:
        return len(self.lon)

    def clave_prioridad(self, s: int, sede: int) -> int:
        """Clave de prioridad del estudiante s en la sede (menor = mejor).

        Orden: nivel (hermano > vulnerable > SISBÉN > resto), luego banda de
        cercanía a la sede, luego lotería. Se codifica en un solo entero.
        """
        nivel = NIVEL_HERMANO if self.sede_hermano[s] == sede else self.nivel_base[s]
        banda = int(np.searchsorted(self.bandas_cercania_km, self.dist[s, sede]))
        n_bandas = len(self.bandas_cercania_km) + 1
        return (int(nivel) * n_bandas + banda) * self.n + int(self.loteria[s])

    def claves_de_prefs(self) -> list:
        return [[self.clave_prioridad(s, c) for c in self.prefs[s]] for s in range(self.n)]


def generar_poblacion(datos: Datos, s) -> Poblacion:
    rng = np.random.default_rng(s.semilla + 1)
    sedes = datos.sedes

    # --- Ubicación: puntos aleatorios dentro de cada UPZ según su demanda ---
    lon, lat, upz, loc = [], [], [], []
    for fila in datos.upz.itertuples():
        n = int(datos.demanda_upz.get(fila.codigo, 0))
        if n == 0:
            continue
        pts = _puntos_en(fila.geometry, n, rng)
        lon.append(pts[:, 0]); lat.append(pts[:, 1])
        upz += [fila.codigo] * n; loc += [fila.localidad] * n
    lon = np.concatenate(lon); lat = np.concatenate(lat)
    n = len(lon)

    dist = matriz_distancias(lon, lat, sedes["lon"].to_numpy(), sedes["lat"].to_numpy())
    tiempo = tiempo_viaje_min(dist, s).astype(np.float32)

    # --- Categorías de priorización (mutuamente excluyentes, en orden de prioridad) ---
    u = rng.random(n)
    cortes = np.cumsum([s.pct_hermanos, s.pct_discapacidad, s.pct_victimas, s.pct_etnicos, s.pct_sisben_ab])
    categoria = np.searchsorted(cortes, u, side="right")  # 0..5
    nivel_base = np.select(
        [categoria == 0, categoria <= 3, categoria == 4],
        [NIVEL_GENERAL, NIVEL_VULNERABLE, NIVEL_SISBEN],
        NIVEL_GENERAL,
    )
    # Un estudiante con hermano no tiene otra prioridad fuera de esa sede (simplificación)

    # --- Preferencias: utilidad = −tiempo + calidad + gusto individual ---
    calidad_z = ((sedes["calidad"] - sedes["calidad"].mean()) / sedes["calidad"].std()).to_numpy()
    k_cand = min(s.n_candidatas, len(sedes))
    candidatas = np.argpartition(tiempo, k_cand - 1, axis=1)[:, :k_cand]
    t_cand = np.take_along_axis(tiempo, candidatas, axis=1)
    utilidad = (-s.peso_tiempo * t_cand / 10.0
                + s.peso_calidad * calidad_z[candidatas]
                + rng.gumbel(0, s.ruido_preferencias, t_cand.shape))
    orden = np.argsort(-utilidad, axis=1)
    k_opciones = rng.integers(s.min_opciones, s.max_opciones + 1, n)

    mas_cercana = np.argmin(dist, axis=1)
    cercanas3 = np.argsort(t_cand, axis=1)[:, :3]

    sede_hermano = np.full(n, -1)
    prefs = []
    for i in range(n):
        lista = list(candidatas[i, orden[i, :k_opciones[i]]])
        if categoria[i] == 0:
            # El hermano estudia en una de las 3 sedes más cercanas; la familia la pone de primera
            h = int(candidatas[i, cercanas3[i, rng.integers(3)]])
            sede_hermano[i] = h
            if h in lista:
                lista.remove(h)
            lista = [h] + lista[: k_opciones[i] - 1]
        prefs.append(np.array(lista, dtype=np.int32))

    # --- Solicitud única del sistema actual ---
    # Con un solo colegio, parte de las familias pide "a la segura" el más cercano.
    pide_hoy = np.array([p[0] for p in prefs])
    a_la_segura = (rng.random(n) < s.pct_pide_mas_cercano_hoy) & (sede_hermano < 0)
    pide_hoy[a_la_segura] = mas_cercana[a_la_segura]

    loteria = rng.permutation(n)

    return Poblacion(
        lon=lon, lat=lat, upz=np.array(upz), localidad=np.array(loc),
        categoria=categoria, nivel_base=nivel_base, sede_hermano=sede_hermano,
        loteria=loteria, prefs=prefs, pide_hoy=pide_hoy, dist=dist, tiempo=tiempo,
        bandas_cercania_km=tuple(s.bandas_cercania_km),
    )
