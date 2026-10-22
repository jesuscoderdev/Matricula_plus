"""
Familias sintéticas (sin datos personales).

Cada familia representa a `estudiantes_por_familia` estudiantes nuevos, vive en un punto
aleatorio de una manzana residencial de su UPZ (elegida con probabilidad proporcional a su número
de predios según Catastro; si la UPZ no tiene manzanas residenciales, en un punto aleatorio de
la UPZ) y tiene dos atributos: `vulnerable` y, a veces, un hermano en una de sus sedes cercanas. Las distancias y el ruido de preferencias se calculan UNA vez para todas las
sedes y todas las ubicaciones candidatas del colegio nuevo, así cada escenario usa los mismos
números aleatorios (comparación justa y reproducible).
"""
from dataclasses import dataclass, field

import numpy as np

from engine.fuentes.real import _reparto_entero
from engine.fuentes.sintetica import _puntos_en
from engine.geo import matriz_distancias
from engine.simulador.config import ParametrosSimulador
from engine.simulador.datos import Base

# La web vuelve a correr el algoritmo en el navegador: distancias y desempates se redondean a
# 4 decimales en ambos lados, así JavaScript y Python dan exactamente la misma asignación.
DECIMALES = 4


@dataclass
class Familias:
    lon: np.ndarray
    lat: np.ndarray
    upz: np.ndarray
    vulnerable: np.ndarray       # bool
    sede_hermano: np.ndarray     # índice de sede existente, −1 si no tiene
    desempate: np.ndarray        # número fijo por familia en [0, 1)
    dist: np.ndarray             # familias × (sedes + candidatos), km en línea recta
    ruido: np.ndarray            # mismo tamaño que dist
    n_sedes: int                 # columnas de sedes existentes (después vienen los candidatos)
    # Números aleatorios que definen los atributos (la web los usa para cambiar los porcentajes en vivo)
    u_vulnerable: np.ndarray = None   # vulnerable = u < % vulnerables
    u_hermano: np.ndarray = None      # tiene hermano = u < % con hermano
    hermano_elegida: np.ndarray = None  # sede donde estudiaría el hermano (una de sus 5 más cercanas)
    # Las preferencias solo dependen del colegio nuevo: se calculan una vez por ubicación
    _cache: dict = field(default_factory=dict, repr=False)

    @property
    def n(self) -> int:
        return len(self.lon)

    def columnas(self, candidato: int | None) -> np.ndarray:
        """Columnas activas de `dist`: sedes existentes + (opcional) el candidato elegido."""
        cols = np.arange(self.n_sedes)
        return cols if candidato is None else np.append(cols, self.n_sedes + candidato)

    def preferencias(self, candidato: int | None, n_opciones: int) -> np.ndarray:
        """
        Hasta `n_opciones` sedes por familia, ordenadas por distancia + ruido.
        Si tiene hermano y su sede no quedó en la lista, entra de primera (como sim.py).
        Índices sobre las columnas activas (el colegio nuevo, si existe, es el último índice).
        """
        if (candidato, n_opciones) in self._cache:
            return self._cache[(candidato, n_opciones)].copy()
        cols = self.columnas(candidato)
        puntaje = self.dist[:, cols] + self.ruido[:, cols]
        k = min(n_opciones, len(cols))
        top = np.argpartition(puntaje, k - 1, axis=1)[:, :k]
        orden = np.take_along_axis(puntaje, top, axis=1).argsort(axis=1)
        prefs = np.take_along_axis(top, orden, axis=1)
        con_hermano = np.flatnonzero(self.sede_hermano >= 0)
        for i in con_hermano:
            h = self.sede_hermano[i]
            if h not in prefs[i]:
                prefs[i] = np.concatenate([[h], prefs[i][:k - 1]])
        self._cache[(candidato, n_opciones)] = prefs
        return prefs.copy()


def _puntos_en_manzanas(manzanas, n: int, rng) -> np.ndarray:
    """
    n puntos: cada uno en una manzana elegida con probabilidad proporcional a su peso (predios) y,
    dentro de ella, en un punto aleatorio uniforme. El orden de los puntos sigue el orden de los sorteos.
    """
    peso = manzanas["peso"].to_numpy()
    elegidas = rng.choice(len(manzanas), size=n, p=peso / peso.sum())
    pts = np.empty((n, 2))
    geoms = manzanas.geometry.to_numpy()
    for k in np.unique(elegidas):
        donde = np.flatnonzero(elegidas == k)
        pts[donde] = _puntos_en(geoms[k], len(donde), rng)
    return pts


def generar_familias(base: Base, p: ParametrosSimulador) -> Familias:
    rng = np.random.default_rng(p.semilla)
    n_total = int(round(p.demanda_nuevos_total / p.estudiantes_por_familia))
    por_upz = _reparto_entero(base.demanda_upz.to_numpy() / p.estudiantes_por_familia, n_total)

    geom = base.upz.set_index("codigo").geometry
    manzanas = dict(tuple(base.manzanas.groupby("upz"))) if base.manzanas is not None else {}
    lon, lat, upz = [], [], []
    sin_manzanas = 0
    for codigo, n in zip(base.demanda_upz.index, por_upz):
        if n == 0:
            continue
        if codigo in manzanas:
            pts = _puntos_en_manzanas(manzanas[codigo], int(n), rng)
        else:
            pts = _puntos_en(geom[codigo], int(n), rng)
            sin_manzanas += int(n)
        lon.append(pts[:, 0]); lat.append(pts[:, 1]); upz += [codigo] * int(n)
    lon, lat = np.concatenate(lon), np.concatenate(lat)
    n = len(lon)
    if base.manzanas is not None:
        print(f"  Familias en manzanas residenciales: {n - sin_manzanas:,} de {n:,}"
              + (f" ({sin_manzanas:,} en UPZ sin manzanas residenciales: punto aleatorio de la UPZ)" if sin_manzanas else ""))

    destinos_lon = np.concatenate([base.sedes["lon"].to_numpy(), base.candidatos["lon"].to_numpy()])
    destinos_lat = np.concatenate([base.sedes["lat"].to_numpy(), base.candidatos["lat"].to_numpy()])
    dist = matriz_distancias(lon, lat, destinos_lon, destinos_lat)
    ruido = rng.uniform(0, p.ruido_km, dist.shape).astype(np.float32)

    # Redondeados a 6 decimales: la web compara con los mismos números
    u_vulnerable = np.round(rng.random(n), 6)
    u_hermano = np.round(rng.random(n), 6)
    vulnerable = u_vulnerable < p.pct_vulnerable
    tiene_hermano = u_hermano < p.pct_hermano
    n_sedes = len(base.sedes)
    vecinas = np.argpartition(dist[:, :n_sedes], p.vecinos_hermano - 1, axis=1)[:, :p.vecinos_hermano]
    elegida = vecinas[np.arange(n), rng.integers(0, p.vecinos_hermano, n)]
    sede_hermano = np.where(tiene_hermano, elegida, -1)

    return Familias(lon=lon, lat=lat, upz=np.array(upz), vulnerable=vulnerable,
                    sede_hermano=sede_hermano, desempate=np.round(rng.random(n), DECIMALES), dist=dist, ruido=ruido,
                    n_sedes=n_sedes, u_vulnerable=u_vulnerable, u_hermano=u_hermano, hermano_elegida=elegida)
