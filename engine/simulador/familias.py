"""
Familias sintéticas (sin datos personales).

Cada familia representa a `estudiantes_por_familia` estudiantes nuevos, vive en un punto
aleatorio de su UPZ y tiene dos atributos: `vulnerable` y, a veces, un hermano en una de sus
sedes cercanas. Las distancias y el ruido de preferencias se calculan UNA vez para todas las
sedes y todas las ubicaciones candidatas del colegio nuevo, así cada escenario usa los mismos
números aleatorios (comparación justa y reproducible).
"""
from dataclasses import dataclass

import numpy as np

from engine.fuentes.real import _reparto_entero
from engine.fuentes.sintetica import _puntos_en
from engine.geo import matriz_distancias
from engine.simulador.config import ParametrosSimulador
from engine.simulador.datos import Base


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
        return prefs


def generar_familias(base: Base, p: ParametrosSimulador) -> Familias:
    rng = np.random.default_rng(p.semilla)
    n_total = int(round(p.demanda_nuevos_total / p.estudiantes_por_familia))
    por_upz = _reparto_entero(base.demanda_upz.to_numpy() / p.estudiantes_por_familia, n_total)

    geom = base.upz.set_index("codigo").geometry
    lon, lat, upz = [], [], []
    for codigo, n in zip(base.demanda_upz.index, por_upz):
        if n == 0:
            continue
        pts = _puntos_en(geom[codigo], int(n), rng)
        lon.append(pts[:, 0]); lat.append(pts[:, 1]); upz += [codigo] * int(n)
    lon, lat = np.concatenate(lon), np.concatenate(lat)
    n = len(lon)

    destinos_lon = np.concatenate([base.sedes["lon"].to_numpy(), base.candidatos["lon"].to_numpy()])
    destinos_lat = np.concatenate([base.sedes["lat"].to_numpy(), base.candidatos["lat"].to_numpy()])
    dist = matriz_distancias(lon, lat, destinos_lon, destinos_lat)
    ruido = rng.uniform(0, p.ruido_km, dist.shape).astype(np.float32)

    vulnerable = rng.random(n) < p.pct_vulnerable
    tiene_hermano = rng.random(n) < p.pct_hermano
    n_sedes = len(base.sedes)
    vecinas = np.argpartition(dist[:, :n_sedes], p.vecinos_hermano - 1, axis=1)[:, :p.vecinos_hermano]
    elegida = vecinas[np.arange(n), rng.integers(0, p.vecinos_hermano, n)]
    sede_hermano = np.where(tiene_hermano, elegida, -1)

    return Familias(lon=lon, lat=lat, upz=np.array(upz), vulnerable=vulnerable,
                    sede_hermano=sede_hermano, desempate=rng.random(n), dist=dist, ruido=ruido,
                    n_sedes=n_sedes)
