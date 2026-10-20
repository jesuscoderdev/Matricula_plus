"""Exportación de los JSON que consume el frontend (/data/processed)."""
import json
import shutil
from datetime import date

import numpy as np
import shapely

from engine.config import APP_NAME, DATA_PROCESSED, WEB_DATA
from engine.estudiantes import CATEGORIAS
from engine.kpis import opcion_obtenida

DECIMALES = 5            # ~1 m de precisión, suficiente para el mapa
TOLERANCIA_SIMPLIFICAR = 0.0004


def _redondear(obj):
    """Redondea recursivamente coordenadas y flotantes para achicar los JSON."""
    if isinstance(obj, float):
        return round(obj, DECIMALES)
    if isinstance(obj, (np.floating,)):
        return round(float(obj), DECIMALES)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, dict):
        return {k: _redondear(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_redondear(v) for v in obj]
    return obj


def _guardar(nombre: str, datos):
    ruta = DATA_PROCESSED / nombre
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(_redondear(datos), f, ensure_ascii=False, separators=(",", ":"))
    return ruta


def _estado(balance_pct: float) -> str:
    if balance_pct <= -0.10:
        return "deficit"
    if balance_pct >= 0.10:
        return "superavit"
    return "equilibrio"


def _geojson(gdf, props):
    gdf = gdf.copy()
    gdf["geometry"] = shapely.simplify(gdf.geometry.values, TOLERANCIA_SIMPLIFICAR, preserve_topology=True)
    fc = json.loads(gdf[props + ["geometry"]].to_json(drop_id=True))
    return fc


CONTEOS_KPI = ("estudiantes", "asignados", "sin_cupo", "viajes_largos", "cupos", "ocupados", "cupos_ociosos")


def _escalar_kpis(kpis: dict, e: float) -> dict:
    """Expande los conteos de la muestra a escala real; porcentajes y tiempos quedan igual."""
    def uno(k):
        return {c: (int(round(v * e)) if c in CONTEOS_KPI else v) for c, v in k.items()}
    return {
        "global": uno(kpis["global"]),
        "por_localidad": {n: uno(k) for n, k in kpis["por_localidad"].items()},
        "por_upz": {n: uno(k) for n, k in kpis["por_upz"].items()},
    }


def exportar(datos, pob, asig_hoy, asig_mat, kpis_hoy, kpis_mat, n_flujo, s, copiar_web=True):
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    sedes = datos.sedes
    e = datos.escala
    kpis_hoy, kpis_mat = _escalar_kpis(kpis_hoy, e), _escalar_kpis(kpis_mat, e)
    esc = lambda x: np.round(np.asarray(x) * e).astype(int)  # noqa: E731
    rng = np.random.default_rng(s.semilla + 3)

    # --- upz.geojson y localidades.geojson: geometría + balance oferta/demanda ---
    upz = datos.upz.copy()
    demanda_muestra = datos.demanda_upz.reindex(upz["codigo"]).fillna(0).astype(int).to_numpy()
    upz["demanda"] = esc(demanda_muestra)
    upz["oferta"] = esc(sedes.groupby("upz")["cupos"].sum().reindex(upz["codigo"]).fillna(0).to_numpy())
    upz["balance"] = upz["oferta"] - upz["demanda"]
    upz["balance_pct"] = np.where(upz["demanda"] > 0, upz["balance"] / upz["demanda"].clip(lower=1), 0.0).round(3)
    upz["estado"] = [_estado(b) if d > 20 else "equilibrio" for b, d in zip(upz["balance_pct"], demanda_muestra)]
    upz["n_sedes"] = sedes.groupby("upz").size().reindex(upz["codigo"]).fillna(0).astype(int).to_numpy()
    for nombre, k in (("hoy", kpis_hoy), ("matricula", kpis_mat)):
        upz[f"sin_cupo_{nombre}"] = [k["por_upz"].get(c, {}).get("sin_cupo", 0) for c in upz["codigo"]]
        upz[f"tiempo_{nombre}"] = [k["por_upz"].get(c, {}).get("tiempo_prom_min") for c in upz["codigo"]]
    props_upz = ["codigo", "nombre", "localidad", "demanda", "oferta", "balance", "balance_pct", "estado",
                 "n_sedes", "sin_cupo_hoy", "sin_cupo_matricula", "tiempo_hoy", "tiempo_matricula"]
    _guardar("upz.geojson", _geojson(upz, props_upz))

    loc = datos.localidades.copy()
    agg = upz.groupby("localidad")[["demanda", "oferta"]].sum()
    loc["demanda"] = agg["demanda"].reindex(loc["nombre"]).fillna(0).astype(int).to_numpy()
    loc["oferta"] = agg["oferta"].reindex(loc["nombre"]).fillna(0).astype(int).to_numpy()
    loc["balance"] = loc["oferta"] - loc["demanda"]
    loc["balance_pct"] = (loc["balance"] / loc["demanda"].clip(lower=1)).round(3)
    loc["estado"] = [_estado(b) for b in loc["balance_pct"]]
    _guardar("localidades.geojson", _geojson(loc, ["codigo", "nombre", "demanda", "oferta", "balance", "balance_pct", "estado"]))

    # --- colegios.json ---
    ocup_hoy = np.bincount(asig_hoy[asig_hoy >= 0], minlength=len(sedes))
    ocup_mat = np.bincount(asig_mat[asig_mat >= 0], minlength=len(sedes))
    colegios = [
        {"id": int(r.id), "dane": r.dane, "nombre": r.nombre, "localidad": r.localidad, "upz": r.upz,
         "lon": float(r.lon), "lat": float(r.lat), "cupos": int(round(r.cupos * e)), "calidad": float(r.calidad),
         "ocupados_hoy": int(round(ocup_hoy[i] * e)), "ocupados_matricula": int(round(ocup_mat[i] * e))}
        for i, r in enumerate(sedes.itertuples())
    ]
    _guardar("colegios.json", colegios)

    # --- Muestra para animación: los MISMOS estudiantes en ambos escenarios ---
    # Muestra aleatoria simple: lo que se ve en el mapa es proporcional a la realidad simulada.
    m = min(s.n_muestra_animacion, pob.n)
    muestra = np.sort(rng.choice(pob.n, m, replace=False))
    factor_expansion = pob.n / m

    origen = {
        "lon": pob.lon[muestra].tolist(), "lat": pob.lat[muestra].tolist(),
        "upz": pob.upz[muestra].tolist(),
        "categoria": [CATEGORIAS[c] for c in pob.categoria[muestra]],
    }

    def escenario(clave, titulo, asig, kpis, extra):
        op = opcion_obtenida(pob, asig)
        t = np.where(asig >= 0, pob.tiempo[np.arange(pob.n), np.where(asig >= 0, asig, 0)], -1)
        return {
            "escenario": clave, "titulo": titulo, **extra,
            "kpis": kpis,
            "muestra": {
                **origen,
                "sede": asig[muestra].tolist(),                       # −1 = sin cupo
                "tiempo_min": np.round(t[muestra], 1).tolist(),
                "opcion": op[muestra].tolist(),                       # 0 = fuera de lista / sin cupo
            },
        }

    _guardar("escenario_hoy.json", escenario("hoy", "Así se asigna hoy", asig_hoy, kpis_hoy, {}))
    _guardar("escenario_matricula.json", escenario(
        "matricula", f"Con {APP_NAME}", asig_mat, kpis_mat, {"ubicados_por_optimizacion": n_flujo}))

    # --- resumen.json: lo que la app muestra en grande ---
    g_hoy, g_mat = kpis_hoy["global"], kpis_mat["global"]
    delta = {
        "sin_cupo": g_mat["sin_cupo"] - g_hoy["sin_cupo"],
        "pct_primera_opcion": round(g_mat["pct_primera_opcion"] - g_hoy["pct_primera_opcion"], 1),
        "pct_top3": round(g_mat["pct_top3"] - g_hoy["pct_top3"], 1),
        "tiempo_prom_min": round(g_mat["tiempo_prom_min"] - g_hoy["tiempo_prom_min"], 1),
        "viajes_largos": g_mat["viajes_largos"] - g_hoy["viajes_largos"],
        "cupos_ociosos": g_mat["cupos_ociosos"] - g_hoy["cupos_ociosos"],
    }
    comparacion_loc = []
    for nombre in sorted(kpis_hoy["por_localidad"]):
        h, m_ = kpis_hoy["por_localidad"][nombre], kpis_mat["por_localidad"][nombre]
        fila_loc = loc.loc[loc["nombre"] == nombre].iloc[0]
        comparacion_loc.append({
            "localidad": nombre, "estado": fila_loc["estado"],
            "demanda": int(fila_loc["demanda"]), "oferta": int(fila_loc["oferta"]),
            "balance": int(fila_loc["balance"]),
            "hoy": h, "matricula": m_,
        })
    # Localidad "foco" para la escena del problema: la que más niños deja sin cupo hoy
    foco = max(comparacion_loc, key=lambda x: x["hoy"]["sin_cupo"])["localidad"]
    mayor_superavit = max(comparacion_loc, key=lambda x: x["balance"])["localidad"]

    resumen = {
        "app": APP_NAME,
        "generado": date.today().isoformat(),
        "fuente": datos.fuente,
        "nota": "Estudiantes simulados a partir de datos de oferta y demanda"
                + (" reales." if datos.fuente == "real" else " sintéticos con estructura real."),
        "factor_expansion_muestra": round(factor_expansion, 3),
        "escala_real": round(e, 4),
        "totales": {
            "estudiantes": int(round(pob.n * e)), "muestra_simulada": pob.n,
            "sedes": len(sedes), "cupos": int(round(sedes["cupos"].sum() * e)),
            "upz": len(upz), "localidades": len(loc),
            "priorizados": int(round(((pob.sede_hermano >= 0) | (pob.nivel_base < 3)).sum() * e)),
        },
        "hoy": g_hoy, "matricula": g_mat, "delta": delta,
        "localidad_foco": foco, "localidad_mayor_superavit": mayor_superavit,
        "localidades": comparacion_loc,
        "upz_mayor_deficit": upz.sort_values("balance")[["codigo", "nombre", "localidad", "balance"]].head(8).to_dict("records"),
        "supuestos": s.como_dict(),
    }
    _guardar("resumen.json", resumen)

    # Copia al front (si ya existe /web)
    if copiar_web and WEB_DATA.parents[1].exists():
        WEB_DATA.mkdir(parents=True, exist_ok=True)
        for archivo in DATA_PROCESSED.glob("*.*json"):
            shutil.copy2(archivo, WEB_DATA / archivo.name)
    return resumen
