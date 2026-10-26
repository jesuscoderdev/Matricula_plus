"""
Mecanismos de asignación del simulador.

- Asignación diferida (Gale-Shapley, propuesta de los estudiantes) con el puntaje de prioridad
      puntaje(i, j) = −w_cercanía·distancia(i, j) + w_hermanos·[hermano en j] + w_vuln·[vulnerable]
                      + desempate determinístico (con semilla)
  Reutiliza `engine.asignacion.aceptacion_diferida`, que es estable y está probada.
- Línea base, orden de llegada: orden aleatorio con semilla y cada familia toma su primera
  opción con cupo disponible.
"""
import numpy as np

from engine.asignacion.aceptacion_diferida import aceptacion_diferida
from engine.simulador.familias import DECIMALES, Familias


def capacidades(cupos_sedes: np.ndarray, cupos_nuevo: int | None, jornada_unica: bool,
                reduccion: float, estudiantes_por_familia: int) -> np.ndarray:
    """Capacidad en FAMILIAS de las sedes activas (el colegio nuevo, si existe, va al final).

    Se redondea por mayor residuo para que el total de familias cuadre con el total de cupos: con
    floor por sede se perdían hasta 9 cupos en cada una (3.117 en la ciudad). Misma fórmula y mismo
    orden de operaciones que `capacidades` en web/src/motor.ts.
    """
    enteros = np.asarray(cupos_sedes, dtype=np.int64)
    if cupos_nuevo is not None:
        enteros = np.append(enteros, cupos_nuevo)
    factor = (1 - reduccion) if jornada_unica else 1.0
    x = enteros.astype(float) * factor / estudiantes_por_familia
    cap = np.floor(x).astype(np.int64)
    total = int(np.floor(int(enteros.sum()) * factor / estudiantes_por_familia + 0.5))
    faltan = total - int(cap.sum())
    if faltan > 0:
        orden = np.argsort(-(x - cap), kind="stable")   # mayor residuo primero; empate, menor índice
        cap[orden[:faltan]] += 1
    return cap


def claves_prioridad(fam: Familias, prefs: np.ndarray, candidato: int | None,
                     w_cercania: float, w_hermanos: float, w_vuln: float, peso_desempate: float) -> np.ndarray:
    """Clave de cada (familia, opción): menor = más prioridad (es −puntaje)."""
    cols = fam.columnas(candidato)
    d = np.round(fam.dist[np.arange(len(prefs))[:, None], cols[prefs]].astype(np.float64), DECIMALES)
    hermano = prefs == fam.sede_hermano[:, None]       # el colegio nuevo nunca es la sede del hermano
    puntaje = (-w_cercania * d + w_hermanos * hermano + w_vuln * fam.vulnerable[:, None]
               + peso_desempate * fam.desempate[:, None])
    return -puntaje


def asignacion_diferida(prefs: np.ndarray, claves: np.ndarray, capacidad: np.ndarray) -> np.ndarray:
    return aceptacion_diferida(prefs.tolist(), claves.tolist(), capacidad)


def orden_llegada(prefs: np.ndarray, capacidad: np.ndarray, semilla: int) -> np.ndarray:
    rng = np.random.default_rng(semilla)
    libres = capacidad.copy()
    asignacion = np.full(len(prefs), -1, dtype=np.int64)
    for i in rng.permutation(len(prefs)):
        for j in prefs[i]:
            if libres[j] > 0:
                libres[j] -= 1
                asignacion[i] = j
                break
    return asignacion
