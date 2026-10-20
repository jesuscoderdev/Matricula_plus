"""Indicadores por escenario: globales, por localidad y por UPZ."""
import numpy as np
import pandas as pd

from estudiantes import Poblacion


def opcion_obtenida(pob: Poblacion, asignacion: np.ndarray) -> np.ndarray:
    """Posición (1..k) de la sede asignada en la lista de la familia; 0 = fuera de su lista o sin cupo."""
    salida = np.zeros(pob.n, dtype=np.int64)
    for e, c in enumerate(asignacion):
        if c >= 0:
            pos = np.flatnonzero(pob.prefs[e] == c)
            if len(pos):
                salida[e] = pos[0] + 1
    return salida


def tabla_estudiantes(pob: Poblacion, asignacion: np.ndarray) -> pd.DataFrame:
    asignado = asignacion >= 0
    idx = np.where(asignado, asignacion, 0)
    filas = np.arange(pob.n)
    return pd.DataFrame({
        "upz": pob.upz,
        "localidad": pob.localidad,
        "asignado": asignado,
        "opcion": opcion_obtenida(pob, asignacion),
        "tiempo": np.where(asignado, pob.tiempo[filas, idx], np.nan),
        "dist": np.where(asignado, pob.dist[filas, idx], np.nan),
    })


def _resumir(df: pd.DataFrame, umbral_largo: float) -> dict:
    n = len(df)
    asignados = int(df["asignado"].sum())
    largos = int((df["tiempo"] > umbral_largo).sum())
    return {
        "estudiantes": n,
        "asignados": asignados,
        "sin_cupo": n - asignados,
        "pct_sin_cupo": round(100 * (n - asignados) / n, 2) if n else 0.0,
        "pct_primera_opcion": round(100 * (df["opcion"] == 1).mean(), 2) if n else 0.0,
        "pct_top3": round(100 * df["opcion"].between(1, 3).mean(), 2) if n else 0.0,
        "tiempo_prom_min": round(float(df["tiempo"].mean()), 1) if asignados else None,
        "distancia_prom_km": round(float(df["dist"].mean()), 2) if asignados else None,
        "viajes_largos": largos,
        "pct_viajes_largos": round(100 * largos / asignados, 2) if asignados else 0.0,
    }


def _ociosos(sedes: pd.DataFrame, ocupados: np.ndarray) -> dict:
    cupos = int(sedes["cupos"].sum())
    usados = int(ocupados.sum())
    return {"cupos": cupos, "ocupados": usados, "cupos_ociosos": cupos - usados}


def calcular_kpis(pob: Poblacion, asignacion: np.ndarray, sedes: pd.DataFrame, s) -> dict:
    df = tabla_estudiantes(pob, asignacion)
    ocupados = np.bincount(asignacion[asignacion >= 0], minlength=len(sedes))
    sedes = sedes.assign(ocupados=ocupados)

    def por(grupo_est: str, grupo_sede: str) -> dict:
        salida = {}
        for clave, sub in df.groupby(grupo_est):
            salida[clave] = _resumir(sub, s.umbral_viaje_largo_min)
        for clave, sub in sedes.groupby(grupo_sede):
            salida.setdefault(clave, _resumir(df.iloc[0:0], s.umbral_viaje_largo_min))
            salida[clave].update(_ociosos(sub, sub["ocupados"].to_numpy()))
        for v in salida.values():
            v.setdefault("cupos", 0); v.setdefault("ocupados", 0); v.setdefault("cupos_ociosos", 0)
        return salida

    global_ = _resumir(df, s.umbral_viaje_largo_min)
    global_.update(_ociosos(sedes, ocupados))
    return {
        "global": global_,
        "por_localidad": por("localidad", "localidad"),
        "por_upz": por("upz", "upz"),
    }
