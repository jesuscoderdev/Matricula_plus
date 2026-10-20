"""
Aceptación diferida (Gale-Shapley) con propuesta de los estudiantes.

Es el mecanismo del Sistema de Admisión Escolar (SAE) de Chile:
1. Cada estudiante libre postula a la siguiente sede de su lista.
2. La sede retiene "tentativamente" a los mejores según su prioridad hasta
   llenar su capacidad y rechaza al resto.
3. Los rechazados postulan a su siguiente opción. Termina cuando nadie más postula.

Propiedades: el resultado es ESTABLE (no existe un par estudiante–sede que se
prefieran mutuamente sobre su asignación) y es a prueba de estrategia para las
familias: decir la verdad sobre sus preferencias es lo mejor que pueden hacer.
"""
import heapq
from collections import deque

import numpy as np


def aceptacion_diferida(prefs, claves, capacidad) -> np.ndarray:
    """
    prefs[s]     : sedes en orden de preferencia del estudiante s.
    claves[s][k] : prioridad de s en la sede prefs[s][k] (menor = más prioridad;
                   debe ser única por sede para que no haya empates).
    capacidad[c] : cupos de la sede c.

    Devuelve un arreglo con la sede asignada a cada estudiante (−1 = sin asignar).
    """
    n = len(prefs)
    capacidad = np.asarray(capacidad)
    siguiente = np.zeros(n, dtype=np.int64)              # próxima opción a la que postula cada uno
    retenidos = [[] for _ in range(len(capacidad))]      # max-heap por sede: (−clave, estudiante)
    libres = deque(range(n))

    while libres:
        s = libres.popleft()
        if siguiente[s] >= len(prefs[s]):
            continue                                     # agotó su lista
        k = siguiente[s]
        c = prefs[s][k]
        clave = claves[s][k]
        siguiente[s] += 1
        heap = retenidos[c]
        if capacidad[c] <= 0:
            libres.append(s)
        elif len(heap) < capacidad[c]:
            heapq.heappush(heap, (-clave, s))
        elif clave < -heap[0][0]:
            # La sede prefiere a s sobre el peor que tenía retenido
            _, rechazado = heapq.heapreplace(heap, (-clave, s))
            libres.append(rechazado)
        else:
            libres.append(s)

    asignacion = np.full(n, -1, dtype=np.int64)
    for c, heap in enumerate(retenidos):
        for _, s in heap:
            asignacion[s] = c
    return asignacion


def pares_bloqueantes(prefs, claves, capacidad, asignacion) -> list:
    """
    Lista de pares (estudiante, sede) que bloquean la estabilidad:
    el estudiante prefiere esa sede a la suya Y la sede tiene un cupo libre o
    retiene a alguien con peor prioridad que él. Una asignación estable devuelve [].
    """
    capacidad = np.asarray(capacidad)
    # Clave de prioridad que cada estudiante asignado tiene en su sede
    ocupados = np.zeros(len(capacidad), dtype=np.int64)
    peor_clave = np.full(len(capacidad), -np.inf)
    for s, c in enumerate(asignacion):
        if c < 0:
            continue
        ocupados[c] += 1
        k = list(prefs[s]).index(c) if c in prefs[s] else None
        if k is not None:
            peor_clave[c] = max(peor_clave[c], claves[s][k])
        else:
            # Asignado fuera de su lista (paso de optimización): para la sede
            # cuenta como la peor prioridad posible.
            peor_clave[c] = np.inf

    bloqueantes = []
    for s in range(len(prefs)):
        actual = asignacion[s]
        for k, c in enumerate(prefs[s]):
            if c == actual:
                break                                    # el resto lo prefiere menos
            if ocupados[c] < capacidad[c] or claves[s][k] < peor_clave[c]:
                bloqueantes.append((s, int(c)))
    return bloqueantes
