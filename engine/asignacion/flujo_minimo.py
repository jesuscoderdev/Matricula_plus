"""
Optimización de red por flujo de costo mínimo.

    fuente → estudiante (cap 1) → sede (cap 1, costo) → sumidero (cap = cupos libres)
                        └──────→ "sin cupo" (costo muy alto) ──→ sumidero

El arco "sin cupo" garantiza que el problema siempre sea factible; como su costo
es muy alto, el solver primero maximiza cuántos niños reciben cupo y, entre esas
soluciones, minimiza el costo total.

Costo de asignar el estudiante e a la sede c (en minutos equivalentes):
    tiempo de viaje
  + costo_rango × (posición de c en la lista de e − 1)     si c está en su lista
  + costo_fuera_lista                                       si no está
  + penalización por los minutos que pasen del umbral de viaje largo (opcional)
"""
import numpy as np

COSTO_SIN_CUPO = 1_000_000   # en décimas de minuto


def flujo_costo_minimo(estudiantes, tiempo, dist, cupos_libres, radio_km, vecinos,
                       rango=None, costo_rango=0.0, costo_fuera_lista=0.0,
                       umbral_largo_min=None, penalizacion_largo=0.0) -> dict:
    """
    estudiantes : índices de estudiantes a ubicar.
    tiempo, dist: matrices estudiantes × sedes (min, km).
    cupos_libres: cupos que le quedan a cada sede.
    rango       : matriz estudiantes × sedes con la posición (1..k) de la sede en la
                  lista de la familia, 0 si no está. None = no considerar preferencias.
    Devuelve {estudiante: sede} solo para los que logran cupo.
    """
    estudiantes = np.asarray(estudiantes)
    con_cupo = np.flatnonzero(cupos_libres > 0)
    if len(estudiantes) == 0 or len(con_cupo) == 0:
        return {}

    # Arcos candidatos: las `vecinos` sedes con cupo más cercanas + las de su lista, dentro del radio
    k = min(vecinos, len(con_cupo))
    sub_t = tiempo[np.ix_(estudiantes, con_cupo)]
    sub_d = dist[np.ix_(estudiantes, con_cupo)]
    candidato = np.zeros(sub_t.shape, dtype=bool)
    cerca = np.argpartition(sub_t, k - 1, axis=1)[:, :k]
    np.put_along_axis(candidato, cerca, True, axis=1)
    sub_r = None
    if rango is not None:
        sub_r = rango[np.ix_(estudiantes, con_cupo)]
        candidato |= sub_r > 0
    candidato &= sub_d <= radio_km
    filas, cols = np.nonzero(candidato)

    t = sub_t[filas, cols].astype(np.float64)
    costo = t.copy()
    if sub_r is not None:
        r = sub_r[filas, cols]
        costo += np.where(r > 0, costo_rango * (r - 1), costo_fuera_lista)
    if umbral_largo_min is not None:
        costo += penalizacion_largo * np.maximum(0.0, t - umbral_largo_min)
    costos = np.round(costo * 10).astype(np.int64)

    try:
        return _resolver_ortools(estudiantes, con_cupo, cupos_libres, filas, cols, costos)
    except ImportError:
        return _resolver_networkx(estudiantes, con_cupo, cupos_libres, filas, cols, costos)


def _resolver_ortools(estudiantes, con_cupo, cupos_libres, filas, cols, costos):
    from ortools.graph.python import min_cost_flow

    n_e, n_c = len(estudiantes), len(con_cupo)
    # Nodos: 0 = fuente, 1..n_e = estudiantes, luego sedes, luego sumidero
    FUENTE, SUMIDERO = 0, 1 + n_e + n_c
    nodo_e = 1 + np.arange(n_e)
    nodo_c = 1 + n_e + np.arange(n_c)

    inicio = np.concatenate([np.full(n_e, FUENTE), nodo_e[filas], nodo_c, nodo_e])
    fin = np.concatenate([nodo_e, nodo_c[cols], np.full(n_c, SUMIDERO), np.full(n_e, SUMIDERO)])
    cap = np.concatenate([np.ones(n_e), np.ones(len(filas)), cupos_libres[con_cupo], np.ones(n_e)]).astype(np.int64)
    costo = np.concatenate([np.zeros(n_e), costos, np.zeros(n_c), np.full(n_e, COSTO_SIN_CUPO)]).astype(np.int64)

    smcf = min_cost_flow.SimpleMinCostFlow()
    arcos = smcf.add_arcs_with_capacity_and_unit_cost(inicio, fin, cap, costo)
    oferta = np.zeros(SUMIDERO + 1, dtype=np.int64)
    oferta[FUENTE], oferta[SUMIDERO] = n_e, -n_e
    smcf.set_nodes_supplies(np.arange(SUMIDERO + 1), oferta)
    if smcf.solve() != smcf.OPTIMAL:
        raise RuntimeError("El flujo de costo mínimo no encontró solución óptima")

    flujos = smcf.flows(arcos[n_e:n_e + len(filas)])
    usados = flujos > 0
    return {int(estudiantes[f]): int(con_cupo[c]) for f, c in zip(filas[usados], cols[usados])}


def _resolver_networkx(estudiantes, con_cupo, cupos_libres, filas, cols, costos):
    """Respaldo si OR-Tools no está instalado (más lento, mismo resultado)."""
    import networkx as nx

    G = nx.DiGraph()
    n_e = len(estudiantes)
    G.add_node("F", demand=-n_e)
    G.add_node("S", demand=n_e)
    for i in range(n_e):
        G.add_edge("F", ("e", i), capacity=1, weight=0)
        G.add_edge(("e", i), "S", capacity=1, weight=COSTO_SIN_CUPO)
    for f, c, w in zip(filas, cols, costos):
        G.add_edge(("e", int(f)), ("c", int(c)), capacity=1, weight=int(w))
    for j, c in enumerate(con_cupo):
        G.add_edge(("c", j), "S", capacity=int(cupos_libres[c]), weight=0)
    flujo = nx.min_cost_flow(G)
    salida = {}
    for i in range(n_e):
        for destino, f in flujo[("e", i)].items():
            if f > 0 and destino != "S":
                salida[int(estudiantes[i])] = int(con_cupo[destino[1]])
    return salida
