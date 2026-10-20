"""Métricas del simulador (globales y % sin cupo por UPZ)."""
import numpy as np
import pandas as pd

from engine.simulador.familias import Familias


def calcular(fam: Familias, prefs: np.ndarray, asignacion: np.ndarray, candidato: int | None,
             zona_critica: set, estudiantes_por_familia: int) -> dict:
    asignado = asignacion >= 0
    cols = fam.columnas(candidato)
    filas = np.flatnonzero(asignado)
    dist = fam.dist[filas, cols[asignacion[filas]]]
    en_zona = np.isin(fam.upz, list(zona_critica))

    def pct(mascara_sin, universo):
        return round(100.0 * mascara_sin[universo].mean(), 2) if universo.any() else 0.0

    sin = ~asignado
    todos = np.ones(fam.n, dtype=bool)
    por_upz = pd.DataFrame({"upz": fam.upz, "sin": sin}).groupby("upz")["sin"].agg(["mean", "sum", "size"])
    return {
        "pct_primera_opcion": round(100.0 * (asignacion == prefs[:, 0]).mean(), 2),
        "pct_sin_cupo": pct(sin, todos),
        "distancia_prom_km": round(float(dist.mean()), 3) if len(dist) else None,
        "pct_vulnerables_sin_cupo": pct(sin, fam.vulnerable),
        "pct_sin_cupo_zona_critica": pct(sin, en_zona),
        # Conteos en ESTUDIANTES (familias × estudiantes por familia)
        "estudiantes": int(fam.n * estudiantes_por_familia),
        "sin_cupo": int(sin.sum() * estudiantes_por_familia),
        "por_upz": {u: round(100.0 * r["mean"], 1) for u, r in por_upz.iterrows()},
    }
