"""Utilidades geográficas: distancias y aproximación de tiempo de viaje."""
import numpy as np

from config import Supuestos

# Kilómetros por grado en la latitud de Bogotá (~4.6° N)
KM_POR_GRADO_LAT = 110.57
KM_POR_GRADO_LON = 111.32 * np.cos(np.radians(4.6))


def distancia_km(lon1, lat1, lon2, lat2):
    """Distancia en línea recta (equirectangular; error despreciable a escala urbana).

    Acepta escalares o arreglos con broadcasting de numpy.
    """
    dx = (np.asarray(lon2) - np.asarray(lon1)) * KM_POR_GRADO_LON
    dy = (np.asarray(lat2) - np.asarray(lat1)) * KM_POR_GRADO_LAT
    return np.sqrt(dx * dx + dy * dy)


def matriz_distancias(lon_a, lat_a, lon_b, lat_b) -> np.ndarray:
    """Matriz (len(a) × len(b)) de distancias en km, en float32 para ahorrar memoria."""
    dx = (lon_b[None, :].astype(np.float32) - lon_a[:, None].astype(np.float32)) * np.float32(KM_POR_GRADO_LON)
    dy = (lat_b[None, :].astype(np.float32) - lat_a[:, None].astype(np.float32)) * np.float32(KM_POR_GRADO_LAT)
    return np.sqrt(dx * dx + dy * dy)


def tiempo_viaje_min(dist_km, s: Supuestos):
    """Tiempo de viaje puerta a puerta en minutos.

    Supuesto: distancia en red = línea recta × factor de tortuosidad. La familia
    elige lo más rápido entre caminar y transporte público (con tiempo de espera).
    """
    d_red = np.asarray(dist_km) * s.factor_tortuosidad
    caminando = d_red / s.velocidad_caminando_kmh * 60.0
    transporte = d_red / s.velocidad_transporte_kmh * 60.0 + s.espera_transporte_min
    return np.minimum(caminando, transporte)
