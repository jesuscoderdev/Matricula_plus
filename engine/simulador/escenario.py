"""
Un escenario = una combinación de palancas. Esta es la función central que usan el
precálculo (`build_scenarios`) y los tests.
"""
from dataclasses import dataclass

import numpy as np

from engine.simulador import mecanismos as M
from engine.simulador.config import ParametrosSimulador
from engine.simulador.datos import Base
from engine.simulador.familias import Familias
from engine.simulador.metricas import calcular


@dataclass(frozen=True)
class Palancas:
    cercania: str = "medio"           # bajo | medio | alto
    hermanos: str = "medio"
    vulnerabilidad: str = "medio"
    colegio_nuevo: str | None = None  # clave de UBICACIONES_NUEVO o None
    jornada_unica: bool = False

    @property
    def id(self) -> str:
        """Identificador estable del escenario (nombre del JSON)."""
        n = {"bajo": "b", "medio": "m", "alto": "a"}
        return (f"c{n[self.cercania]}-h{n[self.hermanos]}-v{n[self.vulnerabilidad]}"
                f"_{self.colegio_nuevo or 'ninguno'}_{'ju' if self.jornada_unica else 'sinju'}")


@dataclass
class Resultado:
    asignacion: np.ndarray
    prefs: np.ndarray
    capacidad: np.ndarray
    claves: np.ndarray | None
    candidato: int | None
    metricas: dict


def indice_candidato(base: Base, clave: str | None) -> int | None:
    if clave is None:
        return None
    return int(np.flatnonzero(base.candidatos["clave"].to_numpy() == clave)[0])


def simular(base: Base, fam: Familias, p: ParametrosSimulador, palancas: Palancas,
            mecanismo: str = "diferida") -> Resultado:
    cand = indice_candidato(base, palancas.colegio_nuevo)
    prefs = fam.preferencias(cand, p.n_opciones)
    cap = M.capacidades(base.sedes["cupos"].to_numpy(), p.cupos_colegio_nuevo if cand is not None else None,
                        palancas.jornada_unica, p.reduccion_jornada_unica, p.estudiantes_por_familia)
    claves = None
    if mecanismo == "orden_llegada":
        asign = M.orden_llegada(prefs, cap, p.semilla)
    else:
        claves = M.claves_prioridad(
            fam, prefs, cand,
            p.pesos["cercania"][palancas.cercania], p.pesos["hermanos"][palancas.hermanos],
            p.pesos["vulnerabilidad"][palancas.vulnerabilidad], p.desempate_peso,
        )
        asign = M.asignacion_diferida(prefs, claves, cap)
    zona = set(base.zona_critica or [])
    met = calcular(fam, prefs, asign, cand, zona, p.estudiantes_por_familia)
    return Resultado(asign, prefs, cap, claves, cand, met)


def definir_zona_critica(base: Base, fam: Familias, p: ParametrosSimulador) -> list:
    """Las N UPZ con más niños sin cupo en la línea base (orden de llegada, sin palancas)."""
    r = simular(base, fam, p, Palancas(), mecanismo="orden_llegada")
    sin = r.asignacion < 0
    upz, conteo = np.unique(fam.upz[sin], return_counts=True)
    orden = np.argsort(-conteo, kind="stable")
    return [str(u) for u in upz[orden][:p.n_upz_zona_critica]]
