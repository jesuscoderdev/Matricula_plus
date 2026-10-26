"""
Base de datos del simulador: UPZ, sedes con cupos de NUEVOS, demanda de nuevos por UPZ
de residencia, ubicaciones candidatas del colegio nuevo y zona crítica.

Decisiones de modelado (aprobadas en la fase 0):
  - Se simulan solo NUEVOS: tantas solicitudes como la demanda de nuevos de 2024 del Estudio de
    insuficiencia SED 2025 (158.957) y `cupos_por_solicitud` cupos por solicitud en toda la ciudad
    (1,0 por defecto: hay cupos en el agregado, faltan donde viven los niños). Los cupos de nuevos
    se reparten entre sedes en proporción a su oferta regular (03.2025).
  - Las familias viven según la población de 5 a 17 años por UPZ (proyección SDP/DANE 2026),
    ajustada para que el total por localidad cuadre con la participación de cada localidad en
    la demanda oficial. Dentro de su UPZ, cada familia vive en una manzana residencial (estrato 1 a 6
    de la estratificación de la SDP), elegida con probabilidad proporcional a su número de predios
    (Catastro).
"""
from dataclasses import dataclass

import geopandas as gpd
import numpy as np
import pandas as pd

from engine.fuentes.real import _reparto_entero
from engine.simulador.config import ParametrosSimulador


@dataclass
class Base:
    upz: gpd.GeoDataFrame          # codigo, nombre, localidad, geometry
    localidades: gpd.GeoDataFrame  # codigo, nombre, geometry
    sedes: pd.DataFrame            # id, nombre, upz, localidad, lon, lat, cupos (estudiantes nuevos)
    demanda_upz: pd.Series         # solicitudes de nuevos por UPZ de residencia (estudiantes)
    candidatos: pd.DataFrame       # clave, etiqueta, proyecto, upz, upz_nombre, localidad, lon, lat
    fuente: str
    zona_critica: list = None      # códigos de UPZ; se define con la línea base (ver escenario.py)
    manzanas: gpd.GeoDataFrame = None  # manzanas residenciales: upz, peso, geometry (None = punto en la UPZ)


def cargar_base(fuente: str, p: ParametrosSimulador, verbose: bool = True) -> Base:
    return _base_real(p, verbose) if fuente == "real" else _base_sintetica(p)


# ---------------------------------------------------------------- real
def _base_real(p, verbose):
    from engine.fuentes.real import (cargar_geografia, cargar_oferta_demanda, colegios_nuevos,
                                     descargar, manzanas_residenciales, poblacion_escolar_upz)
    descargar()
    upz, localidades = cargar_geografia()
    oferta, _, _ = cargar_oferta_demanda(upz, verbose=verbose)

    # Cupos de nuevos por sede: proporcionales a su oferta regular, sumando p.cupos_nuevos_total
    cupos = _reparto_entero(oferta["cupos_regulares"].to_numpy() * p.cupos_nuevos_total
                            / oferta["cupos_regulares"].sum(), p.cupos_nuevos_total)
    sedes = pd.DataFrame({
        "nombre": oferta["nombre"].values, "upz": oferta["codigo"].values,
        "localidad": oferta["localidad"].values, "lon": oferta["lon"].values,
        "lat": oferta["lat"].values, "cupos": cupos,
    })
    sedes = sedes[sedes["cupos"] > 0].reset_index(drop=True)
    sedes.insert(0, "id", np.arange(len(sedes)))

    # Demanda de nuevos por UPZ de residencia
    pob = poblacion_escolar_upz(upz, p.anio_poblacion, p.frac_15_19)
    part_loc = oferta.groupby("localidad")["demanda"].sum()
    part_loc = part_loc / part_loc.sum()                      # participación de cada localidad
    dem = pd.Series(0.0, index=upz["codigo"].values)
    for loc, sub in upz.groupby("localidad"):
        pob_loc = pob.reindex(sub["codigo"]).fillna(0.0)
        if pob_loc.sum() > 0:
            dem[sub["codigo"].values] = part_loc.get(loc, 0.0) * pob_loc.to_numpy() / pob_loc.sum()
    demanda_upz = pd.Series(_reparto_entero(dem.to_numpy() / dem.sum() * p.demanda_nuevos_total,
                                            p.demanda_nuevos_total), index=dem.index)

    # Ubicaciones candidatas del colegio nuevo (proyectos reales de la SED)
    nuevos = colegios_nuevos(upz)
    filas = []
    for clave, etiqueta, buscar in p.ubicaciones_nuevo:
        m = nuevos[nuevos["proyecto"].str.contains(buscar, case=False, na=False)]
        if m.empty:
            raise ValueError(f"No se encontró el proyecto '{buscar}' en colegios nuevos de la SED")
        r = m.iloc[0]
        filas.append({"clave": clave, "etiqueta": etiqueta, "proyecto": r["proyecto"], "upz": r["codigo"],
                      "upz_nombre": r["upz_nombre"], "localidad": r["localidad"],
                      "lon": r.geometry.x, "lat": r.geometry.y})
    return Base(upz=upz[["codigo", "nombre", "localidad", "geometry"]], localidades=localidades,
                sedes=sedes, demanda_upz=demanda_upz, candidatos=pd.DataFrame(filas), fuente="real",
                manzanas=manzanas_residenciales(upz))


# ---------------------------------------------------------------- sintética
def _base_sintetica(p):
    """Ciudad sintética con los mismos totales de nuevos que los parámetros (cupos_nuevos_total)."""
    from engine.config import Supuestos
    from engine.fuentes.sintetica import generar

    d = generar(Supuestos(n_estudiantes=p.demanda_nuevos_total, semilla=p.semilla), guardar_crudos=False)
    sedes = d.sedes[["id", "nombre", "upz", "localidad", "lon", "lat"]].copy()
    sedes["cupos"] = _reparto_entero(d.sedes["cupos"].to_numpy() * p.cupos_nuevos_total
                                     / d.sedes["cupos"].sum(), p.cupos_nuevos_total)
    # Candidatos: un punto dentro de UPZ críticas con el mismo nombre que en la ciudad real
    upz_por_nombre = d.upz.set_index("nombre")
    sustitutos = {"tibabuyes": "Tibabuyes", "suba": "El Rincón", "bosa": "Bosa Occidental",
                  "kennedy": "Patio Bonito", "ciudad_bolivar": "Arborizadora"}
    filas = []
    for clave, etiqueta, _ in p.ubicaciones_nuevo:
        u = upz_por_nombre.loc[sustitutos[clave]]
        pt = u.geometry.representative_point()
        filas.append({"clave": clave, "etiqueta": etiqueta, "proyecto": f"Colegio nuevo (sintético) {u.name}",
                      "upz": u["codigo"], "upz_nombre": u.name, "localidad": u["localidad"],
                      "lon": pt.x, "lat": pt.y})
    return Base(upz=d.upz[["codigo", "nombre", "localidad", "geometry"]], localidades=d.localidades,
                sedes=sedes, demanda_upz=d.demanda_upz.astype(int), candidatos=pd.DataFrame(filas),
                fuente="sintetica")


# ---------------------------------------------------------------- insuficiencia
def insuficiencia_upz(base: Base) -> pd.DataFrame:
    """Cupos de nuevos, demanda de residentes y relación cupos/demanda por UPZ."""
    cupos_upz = base.sedes.groupby("upz")["cupos"].sum().reindex(base.upz["codigo"]).fillna(0).astype(int)
    dem = base.demanda_upz.reindex(base.upz["codigo"]).fillna(0).astype(int)
    return pd.DataFrame({
        "codigo": base.upz["codigo"].values, "nombre": base.upz["nombre"].values,
        "localidad": base.upz["localidad"].values, "cupos": cupos_upz.values, "demanda": dem.values,
        "cupos_por_solicitud": np.round(cupos_upz.values / np.maximum(dem.values, 1), 3),
    })
