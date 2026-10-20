"""
Tests del algoritmo de aceptación diferida y del paso de optimización.

La propiedad central es la ESTABILIDAD: no debe existir un par estudiante–sede
que se prefieran mutuamente sobre su asignación actual.
"""
import itertools

import numpy as np
import pytest

from asignacion.aceptacion_diferida import aceptacion_diferida, pares_bloqueantes
from asignacion.flujo_minimo import flujo_costo_minimo


def instancia_aleatoria(rng, n_est, n_sedes, max_lista=4):
    """Preferencias y prioridades aleatorias (prioridades únicas por sede)."""
    prefs = [list(rng.choice(n_sedes, rng.integers(1, max_lista + 1), replace=False)) for _ in range(n_est)]
    prioridad = [rng.permutation(n_est) for _ in range(n_sedes)]   # prioridad[c][s] (menor = mejor)
    claves = [[int(prioridad[c][s]) for c in prefs[s]] for s in range(n_est)]
    capacidad = rng.integers(0, 4, n_sedes)
    return prefs, claves, capacidad


@pytest.mark.parametrize("semilla", range(200))
def test_estable_en_instancias_aleatorias(semilla):
    rng = np.random.default_rng(semilla)
    prefs, claves, cap = instancia_aleatoria(rng, n_est=40, n_sedes=8)
    asig = aceptacion_diferida(prefs, claves, cap)
    assert pares_bloqueantes(prefs, claves, cap, asig) == []


@pytest.mark.parametrize("semilla", range(50))
def test_respeta_capacidad_y_listas(semilla):
    rng = np.random.default_rng(1000 + semilla)
    prefs, claves, cap = instancia_aleatoria(rng, n_est=60, n_sedes=10)
    asig = aceptacion_diferida(prefs, claves, cap)
    ocupados = np.bincount(asig[asig >= 0], minlength=len(cap))
    assert (ocupados <= cap).all()
    for s, c in enumerate(asig):
        assert c == -1 or c in prefs[s], "nadie queda en una sede que no pidió"


def test_ejemplo_clasico():
    # 3 estudiantes, 2 sedes con 1 cupo cada una.
    # Todos prefieren la sede 0; la sede 0 prioriza a 2 > 0 > 1; la sede 1 prioriza 0 > 1 > 2.
    prefs = [[0, 1], [0, 1], [0, 1]]
    prioridad = {0: [1, 2, 0], 1: [0, 1, 2]}     # prioridad[c][s]
    claves = [[prioridad[c][s] for c in prefs[s]] for s in range(3)]
    asig = aceptacion_diferida(prefs, claves, [1, 1])
    assert list(asig) == [1, -1, 0]
    assert pares_bloqueantes(prefs, claves, [1, 1], asig) == []


def test_detecta_par_bloqueante():
    # Asignación inestable a propósito: el estudiante 0 prefiere la sede 0 y tiene
    # mejor prioridad que el estudiante 1, que está ahí.
    prefs = [[0, 1], [0, 1]]
    claves = [[0, 0], [1, 1]]
    asig = np.array([1, 0])
    assert pares_bloqueantes(prefs, claves, [1, 1], asig) == [(0, 0)]


def test_hermano_tiene_prioridad():
    # El estudiante 2 tiene un hermano en la sede 0: su clave es la mejor ahí.
    from estudiantes import NIVEL_GENERAL, NIVEL_HERMANO
    n = 3
    prefs = [[0], [0], [0]]
    claves = [[NIVEL_GENERAL * n + 0], [NIVEL_GENERAL * n + 1], [NIVEL_HERMANO * n + 2]]
    asig = aceptacion_diferida(prefs, claves, [1])
    assert list(asig) == [-1, -1, 0]


def _matchings_estables(prefs, claves, cap):
    """Enumera por fuerza bruta todas las asignaciones estables (instancias diminutas)."""
    n = len(prefs)
    opciones = [list(p) + [-1] for p in prefs]
    for asig in itertools.product(*opciones):
        asig = np.array(asig)
        ocupados = np.bincount(asig[asig >= 0], minlength=len(cap))
        if (ocupados <= cap).all() and not pares_bloqueantes(prefs, claves, cap, asig):
            yield asig


@pytest.mark.parametrize("semilla", range(40))
def test_optima_para_estudiantes(semilla):
    """Con propuesta de estudiantes, cada uno queda al menos tan bien como en cualquier asignación estable."""
    rng = np.random.default_rng(5000 + semilla)
    prefs, claves, cap = instancia_aleatoria(rng, n_est=5, n_sedes=3, max_lista=3)
    asig = aceptacion_diferida(prefs, claves, cap)

    def rango(s, c):
        return len(prefs[s]) if c < 0 else list(prefs[s]).index(c)

    estables = list(_matchings_estables(prefs, claves, cap))
    assert any((m == asig).all() for m in estables)
    for m in estables:
        for s in range(len(prefs)):
            assert rango(s, asig[s]) <= rango(s, m[s])


def test_flujo_minimiza_tiempo_total():
    # 2 estudiantes, 2 sedes con 1 cupo. Asignación greedy (0→A) costaría 1 + 10;
    # la óptima es 0→B, 1→A con costo 2 + 2.
    tiempo = np.array([[1.0, 2.0], [2.0, 10.0]], dtype=np.float32)
    dist = np.ones_like(tiempo)
    res = flujo_costo_minimo([0, 1], tiempo, dist, np.array([1, 1]), radio_km=5, vecinos=2)
    assert res == {0: 1, 1: 0}


def test_flujo_respeta_radio_y_capacidad():
    tiempo = np.array([[5.0, 6.0], [5.0, 6.0], [5.0, 6.0]], dtype=np.float32)
    dist = np.array([[1.0, 99.0], [1.0, 99.0], [1.0, 99.0]], dtype=np.float32)
    res = flujo_costo_minimo([0, 1, 2], tiempo, dist, np.array([2, 5]), radio_km=5, vecinos=2)
    assert len(res) == 2 and set(res.values()) == {0}   # la sede 1 está fuera del radio


def test_pipeline_completo_estable():
    """Integración: población sintética pequeña → escenario Matrícula+ estable."""
    from config import Supuestos
    from estudiantes import generar_poblacion
    from fuentes.sintetica import generar
    from asignacion.escenarios import escenario_hoy, escenario_matricula

    s = Supuestos(n_estudiantes=3000, n_sedes_objetivo=60)
    datos = generar(s, guardar_crudos=False)
    cap = datos.sedes["cupos"].to_numpy()
    pob = generar_poblacion(datos, s)
    res = escenario_matricula(pob, cap, s)
    asig = res.asignacion
    assert pares_bloqueantes(res.prefs, res.claves, cap, asig) == []
    # Nadie con cupo garantizado queda sin cupo, y nadie termina peor que su garantía
    con_garantia = res.garantia >= 0
    assert (asig[con_garantia] >= 0).all()
    for e in np.flatnonzero(con_garantia):
        assert res.prefs[e].index(asig[e]) <= res.prefs[e].index(res.garantia[e])
    for a in (asig, escenario_hoy(pob, cap, s)):
        assert (np.bincount(a[a >= 0], minlength=len(cap)) <= cap).all()
