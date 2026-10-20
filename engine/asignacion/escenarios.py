"""
Los dos escenarios que compara la demo, sobre la MISMA población.

A. "Así se asigna hoy": orden de llegada, una sola solicitud por familia.
B. "Con Matrícula+": cupo garantizado (flujo de costo mínimo) + listas ordenadas
   con aceptación diferida + flujo de costo mínimo para los que aún falten.
"""
from dataclasses import dataclass

import numpy as np

from engine.asignacion.aceptacion_diferida import aceptacion_diferida
from engine.asignacion.flujo_minimo import flujo_costo_minimo
from engine.estudiantes import NIVEL_GENERAL, Poblacion


def escenario_hoy(pob: Poblacion, capacidad: np.ndarray, s) -> np.ndarray:
    """
    1. Fase de priorizados primero; dentro de cada fase, orden de llegada aleatorio.
    2. Cada familia pide UNA sede. Si tiene cupo, se asigna.
    3. Si está llena, se asigna la sede más cercana con cupo disponible
       dentro del radio razonable; si no hay ninguna, queda "sin cupo".
    """
    rng = np.random.default_rng(s.semilla + 2)
    priorizado = (pob.sede_hermano >= 0) | (pob.nivel_base < NIVEL_GENERAL)
    llegada = rng.permutation(pob.n)
    orden = llegada[np.argsort(~priorizado[llegada], kind="stable")]

    cupos = capacidad.copy()
    asignacion = np.full(pob.n, -1, dtype=np.int64)
    cercanas = np.argsort(pob.dist, axis=1)       # sedes de la más cercana a la más lejana
    for e in orden:
        pedida = pob.pide_hoy[e]
        if cupos[pedida] > 0:
            asignacion[e] = pedida
            cupos[pedida] -= 1
            continue
        for c in cercanas[e]:
            if pob.dist[e, c] > s.radio_razonable_km:
                break
            if cupos[c] > 0:
                asignacion[e] = c
                cupos[c] -= 1
                break
    return asignacion


@dataclass
class ResultadoMatricula:
    asignacion: np.ndarray
    garantia: np.ndarray          # sede garantizada de cada estudiante (−1 = sin garantía posible)
    prefs: list                   # listas efectivas (preferencias + sede garantizada al final)
    claves: list                  # prioridades efectivas (para verificar estabilidad)
    n_garantizados: int
    n_en_garantia: int            # terminaron justo en su cupo garantizado
    n_flujo_final: int            # ubicados en el último paso


def escenario_matricula(pob: Poblacion, capacidad: np.ndarray, s) -> ResultadoMatricula:
    """
    1. CUPO GARANTIZADO: un flujo de costo mínimo sobre TODOS los estudiantes le
       reserva a cada uno una sede dentro del radio, maximizando cuántos tienen
       garantía y, entre esas soluciones, minimizando el tiempo total de viaje.
    2. La sede garantizada se agrega al final de la lista de la familia (si no
       estaba) y allí el estudiante tiene la máxima prioridad: nunca lo rechazan.
    3. Aceptación diferida con prioridades:
       hermanos > discapacidad/víctimas/étnicos > SISBÉN A/B > resto; desempate
       por cercanía y lotería. Cada familia queda en su garantía o en algo que
       prefiere más.
    4. Si alguien no tenía garantía (no hay cupo en el radio), se intenta ubicar
       con un último flujo sobre los cupos sobrantes.
    """
    n = pob.n
    # Posición de cada sede en la lista de cada familia (0 = no está)
    rango = np.zeros(pob.tiempo.shape, dtype=np.int8)
    for e, lista in enumerate(pob.prefs):
        rango[e, lista] = np.arange(1, len(lista) + 1)
    reserva = flujo_costo_minimo(
        np.arange(n), pob.tiempo, pob.dist, capacidad.copy(), s.radio_optimizacion_km, s.vecinos_flujo,
        rango=rango, costo_rango=s.costo_rango_min, costo_fuera_lista=s.costo_fuera_lista_min,
        umbral_largo_min=s.umbral_viaje_largo_min, penalizacion_largo=s.penalizacion_viaje_largo,
    )
    garantia = np.full(n, -1, dtype=np.int64)
    for e, c in reserva.items():
        garantia[e] = c

    # Clave "garantía": menor que cualquier otra (las claves normales son ≥ 0).
    # Como el flujo respeta la capacidad, los garantizados de una sede siempre caben.
    clave_garantia = lambda e: int(pob.loteria[e]) - n  # noqa: E731
    prefs, claves = [], []
    for e in range(n):
        lista = list(pob.prefs[e])
        g = garantia[e]
        if g >= 0 and g not in lista:
            lista.append(int(g))
        prefs.append(lista)
        claves.append([clave_garantia(e) if c == g else pob.clave_prioridad(e, c) for c in lista])

    asignacion = aceptacion_diferida(prefs, claves, capacidad)

    ocupados = np.bincount(asignacion[asignacion >= 0], minlength=len(capacidad))
    sin_asignar = np.flatnonzero(asignacion < 0)
    extra = flujo_costo_minimo(
        sin_asignar, pob.tiempo, pob.dist, capacidad - ocupados, s.radio_optimizacion_km, s.vecinos_flujo,
    )
    for e, c in extra.items():
        asignacion[e] = c

    return ResultadoMatricula(
        asignacion=asignacion, garantia=garantia, prefs=prefs, claves=claves,
        n_garantizados=int((garantia >= 0).sum()),
        n_en_garantia=int(((asignacion == garantia) & (garantia >= 0)).sum()),
        n_flujo_final=len(extra),
    )
