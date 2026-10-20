"""Fuentes de datos intercambiables: sintética o real (Datos Abiertos Bogotá)."""
from dataclasses import dataclass

import geopandas as gpd
import pandas as pd


@dataclass
class Datos:
    """Estructura común que entregan todas las fuentes.

    - upz: GeoDataFrame con columnas codigo, nombre, localidad, geometry
    - localidades: GeoDataFrame con columnas codigo, nombre, geometry
    - sedes: DataFrame con columnas id, dane, nombre, localidad, upz, lon, lat, cupos, calidad
    - demanda_upz: Serie (índice = código UPZ) con solicitudes nuevas por UPZ de residencia
    - escala: solicitudes reales por estudiante simulado
    """
    upz: gpd.GeoDataFrame
    localidades: gpd.GeoDataFrame
    sedes: pd.DataFrame
    demanda_upz: pd.Series
    fuente: str
    # Cuántas solicitudes reales representa cada estudiante simulado (1 en datos sintéticos).
    # Los conteos exportados se expanden con este factor; porcentajes y tiempos no cambian.
    escala: float = 1.0


def cargar(fuente: str, supuestos) -> Datos:
    if fuente == "sintetica":
        from fuentes.sintetica import generar
        return generar(supuestos)
    if fuente == "real":
        from fuentes.real import cargar_real
        return cargar_real(supuestos)
    raise ValueError(f"Fuente desconocida: {fuente!r} (usa 'sintetica' o 'real')")
