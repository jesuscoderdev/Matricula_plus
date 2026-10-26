"""
Tests del simulador de palancas (criterios de aprobado del brief):
  - ningún colegio supera su capacidad
  - cero pares bloqueantes (estabilidad)
  - mismo resultado con la misma semilla
  - casos pequeños hechos a mano con resultado conocido
  - la capacidad total de los datos reales cuadra con la SED (< 1%)
"""
from dataclasses import replace

import numpy as np
import pytest

from engine.asignacion.aceptacion_diferida import pares_bloqueantes
from engine.simulador import mecanismos as M
from engine.simulador.config import ParametrosSimulador
from engine.simulador.datos import cargar_base
from engine.simulador.escenario import Palancas, definir_zona_critica, simular
from engine.simulador.familias import generar_familias


# ---------------------------------------------------------------- casos a mano
def test_diferida_caso_a_mano():
    # 3 familias, 2 colegios con 1 cupo. Todas prefieren el colegio 0.
    # Claves (menor = más prioridad): en el colegio 0 gana la familia 2; en el 1, la familia 0.
    prefs = np.array([[0, 1], [0, 1], [0, 1]])
    claves = np.array([[0.5, 0.1], [0.7, 0.2], [0.3, 0.9]])
    asig = M.asignacion_diferida(prefs, claves, np.array([1, 1]))
    assert list(asig) == [1, -1, 0]


def test_diferida_respeta_hermano_y_vulnerabilidad():
    # Un solo cupo. Familia 0 vive más cerca; familia 1 tiene hermano; familia 2 es vulnerable.
    class F:  # familias mínimas para claves_prioridad
        dist = np.array([[0.2], [1.0], [1.0]], dtype=np.float32)
        sede_hermano = np.array([-1, 0, -1])
        vulnerable = np.array([False, False, True])
        desempate = np.array([0.1, 0.2, 0.3])
        def columnas(self, c): return np.array([0])
    prefs = np.array([[0], [0], [0]])
    def ganador(wc, wh, wv):
        cl = M.claves_prioridad(F(), prefs, None, wc, wh, wv, 0.01)
        return int(np.flatnonzero(M.asignacion_diferida(prefs, cl, np.array([1])) == 0)[0])
    assert ganador(1.0, 0.0, 0.0) == 0      # solo cercanía: gana el más cercano
    assert ganador(1.0, 5.0, 0.0) == 1      # hermanos pesan más
    assert ganador(1.0, 0.0, 3.0) == 2      # vulnerabilidad pesa más


def test_orden_llegada_caso_a_mano():
    prefs = np.array([[0, 1, 2]] * 4)
    asig = M.orden_llegada(prefs, np.array([2, 1, 0]), semilla=1)
    assert sorted(asig.tolist()) == [-1, 0, 0, 1]      # 2 al colegio 0, 1 al 1, uno sin cupo
    # Con cupo de sobra, todos quedan en su primera opción
    assert (M.orden_llegada(prefs, np.array([10, 10, 10]), semilla=1) == 0).all()


def test_capacidades_jornada_y_colegio_nuevo():
    cap = M.capacidades(np.array([100, 55]), cupos_nuevo=None, jornada_unica=False, reduccion=0.1, estudiantes_por_familia=10)
    assert list(cap) == [10, 6]                         # 155 cupos → 16 familias (mayor residuo, no floor)
    cap = M.capacidades(np.array([100, 55]), cupos_nuevo=1200, jornada_unica=True, reduccion=0.1, estudiantes_por_familia=10)
    assert list(cap) == [9, 5, 108]                     # −10% (1.219,5 → 122 familias) y el colegio nuevo al final


def test_capacidades_no_pierden_cupos():
    rng = np.random.default_rng(7)
    cupos = rng.integers(1, 3000, size=700)
    for ju in (False, True):
        f = 0.9 if ju else 1.0
        cap = M.capacidades(cupos, cupos_nuevo=None, jornada_unica=ju, reduccion=0.1, estudiantes_por_familia=10)
        assert cap.sum() == int(np.floor(cupos.sum() * f / 10 + 0.5))
        assert (np.abs(cap - cupos * f / 10) < 1).all()   # cada sede, a menos de una familia de su cupo


# ---------------------------------------------------------------- sobre datos sintéticos
@pytest.fixture(scope="module")
def entorno():
    p = ParametrosSimulador(demanda_nuevos_total=20_000, cupos_nuevos_total=17_660)
    base = cargar_base("sintetica", p)
    fam = generar_familias(base, p)
    base.zona_critica = definir_zona_critica(base, fam, p)
    return p, base, fam


ESCENARIOS = [
    Palancas(),
    Palancas("alto", "bajo", "bajo"),
    Palancas("bajo", "alto", "alto", colegio_nuevo="tibabuyes"),
    Palancas("medio", "medio", "alto", colegio_nuevo="bosa", jornada_unica=True),
    Palancas("alto", "alto", "bajo", jornada_unica=True),
]


@pytest.mark.parametrize("palancas", ESCENARIOS, ids=lambda x: x.id)
def test_capacidad_y_estabilidad(entorno, palancas):
    p, base, fam = entorno
    r = simular(base, fam, p, palancas)
    ocupados = np.bincount(r.asignacion[r.asignacion >= 0], minlength=len(r.capacidad))
    assert (ocupados <= r.capacidad).all()
    assert pares_bloqueantes(r.prefs.tolist(), r.claves.tolist(), r.capacidad, r.asignacion) == []
    for i, j in enumerate(r.asignacion):
        assert j == -1 or j in r.prefs[i]


@pytest.mark.parametrize("palancas", ESCENARIOS[:3], ids=lambda x: x.id)
def test_orden_llegada_respeta_capacidad(entorno, palancas):
    p, base, fam = entorno
    r = simular(base, fam, p, palancas, mecanismo="orden_llegada")
    assert (np.bincount(r.asignacion[r.asignacion >= 0], minlength=len(r.capacidad)) <= r.capacidad).all()


def test_reproducible_con_la_misma_semilla(entorno):
    p, base, _ = entorno
    a = simular(base, generar_familias(base, p), p, ESCENARIOS[2])
    b = simular(base, generar_familias(base, p), p, ESCENARIOS[2])
    assert (a.asignacion == b.asignacion).all() and a.metricas == b.metricas
    c = simular(base, generar_familias(base, replace(p, semilla=7)), p, ESCENARIOS[2])
    assert not np.array_equal(a.asignacion, c.asignacion)


def test_palancas_mueven_las_metricas_en_la_direccion_esperada(entorno):
    p, base, fam = entorno
    m = lambda **k: simular(base, fam, p, Palancas(**k)).metricas  # noqa: E731
    assert m(vulnerabilidad="alto")["pct_vulnerables_sin_cupo"] < m(vulnerabilidad="bajo")["pct_vulnerables_sin_cupo"]
    assert m(jornada_unica=True)["pct_sin_cupo"] > m()["pct_sin_cupo"]
    assert m(colegio_nuevo="tibabuyes")["pct_sin_cupo"] <= m()["pct_sin_cupo"]
    assert m(cercania="alto")["distancia_prom_km"] <= m(cercania="bajo")["distancia_prom_km"]


def test_hermano_entra_en_la_lista(entorno):
    p, _, fam = entorno
    prefs = fam.preferencias(None, p.n_opciones)
    con_hermano = np.flatnonzero(fam.sede_hermano >= 0)
    assert len(con_hermano) > 0
    assert all(fam.sede_hermano[i] in prefs[i] for i in con_hermano)


def test_metricas_en_rango(entorno):
    p, base, fam = entorno
    m = simular(base, fam, p, Palancas()).metricas
    for k in ("pct_primera_opcion", "pct_sin_cupo", "pct_vulnerables_sin_cupo", "pct_sin_cupo_zona_critica"):
        assert 0 <= m[k] <= 100
    assert 1 <= len(base.zona_critica) <= len(p.zona_critica_nombres)
    assert set(m["por_upz"]) <= set(base.upz["codigo"])


# ---------------------------------------------------------------- datos reales
def test_capacidad_real_cuadra_con_sed():
    """Cupos regulares 03.2025 vs 785.191 del Estudio de insuficiencia SED 2025 (error < 1%)."""
    from engine.fuentes.real import CARPETA, CUPOS_REGULARES
    ruta = CARPETA / "oferta_032025.geojson"
    if not ruta.exists():
        pytest.skip("datos reales no descargados (python -m engine.build_scenarios --fuente real)")
    import geopandas as gpd
    total = gpd.read_file(ruta)[CUPOS_REGULARES].sum().sum()
    assert abs(total / 785_191 - 1) < 0.01


def test_identificadores_de_escenario_unicos():
    """Las 324 combinaciones de palancas tienen nombres de archivo distintos."""
    import itertools
    from engine.simulador.config import NIVELES, UBICACIONES_NUEVO
    ids = {Palancas(c, h, v, n, j).id for c, h, v, n, j in itertools.product(
        NIVELES, NIVELES, NIVELES, [None] + [u[0] for u in UBICACIONES_NUEVO], [False, True])}
    assert len(ids) == 3 * 3 * 3 * 6 * 2 == 324
