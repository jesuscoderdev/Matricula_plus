"""
Precálculo de TODOS los escenarios del simulador "¿Dónde cabe cada niño?".

Combinaciones: 3 niveles × 3 pesos de prioridad (27) × colegio nuevo (5 ubicaciones + ninguno)
× jornada única (sí/no) = 324 escenarios, más la línea base (orden de llegada, sin palancas).
El frontend solo lee estos JSON; nada se simula en vivo.

Uso (desde la raíz del proyecto):
    python -m engine.build_scenarios                 # datos reales (por defecto)
    python -m engine.build_scenarios --fuente sintetica
    python -m engine.build_scenarios --sin-copiar-web

Salidas:
    scenarios/<id>.json                  un archivo por combinación (métricas, delta vs base, % sin cupo por UPZ)
    scenarios/base.json                  línea base
    scenarios/indice.json                palancas, ubicaciones, zona crítica y supuestos
    scenarios/todos.json                 todo junto, compacto (lo que carga la app de una vez)
    data/processed/simulador/upz.geojson, colegios.geojson, familias.parquet
"""
import argparse
import itertools
import json
import shutil
import time
from datetime import date

import numpy as np
import pandas as pd
import shapely

from engine.asignacion.aceptacion_diferida import pares_bloqueantes
from engine.config import APP_NAME, DATA_PROCESSED, RAIZ
from engine.simulador.config import NIVELES, ParametrosSimulador
from engine.simulador.datos import cargar_base, insuficiencia_upz
from engine.simulador.escenario import Palancas, definir_zona_critica, simular
from engine.simulador.familias import generar_familias

DIR_ESCENARIOS = RAIZ / "scenarios"
DIR_SIM = DATA_PROCESSED / "simulador"
DIR_WEB = RAIZ / "web" / "public" / "simulador"

METRICAS = ["pct_primera_opcion", "pct_sin_cupo", "distancia_prom_km",
            "pct_vulnerables_sin_cupo", "pct_sin_cupo_zona_critica"]


def _guardar(ruta, datos, indent=None):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))


def _limpiar(m: dict) -> dict:
    """Convierte numpy → tipos nativos para JSON."""
    return {k: (float(v) if isinstance(v, (np.floating,)) else int(v) if isinstance(v, np.integer) else v)
            for k, v in m.items()}


def miles(n: int) -> str:
    """15896 → '15.896' (separador de miles en español)."""
    return f"{n:,}".replace(",", ".")


def _delta(m: dict, base: dict) -> dict:
    return {k: round(m[k] - base[k], 3 if k == "distancia_prom_km" else 2) for k in METRICAS}


def exportar_capas(base, fam, p, m_base):
    """upz.geojson, colegios.geojson y familias.parquet para el mapa y para auditoría."""
    DIR_SIM.mkdir(parents=True, exist_ok=True)
    ins = insuficiencia_upz(base)
    upz = base.upz.merge(ins.drop(columns=["nombre", "localidad"]), on="codigo")
    upz["zona_critica"] = upz["codigo"].isin(base.zona_critica)
    upz["pct_sin_cupo_base"] = upz["codigo"].map(m_base["por_upz"]).fillna(0.0)
    upz["geometry"] = shapely.set_precision(shapely.simplify(upz.geometry.values, 0.0003, preserve_topology=True), 1e-5)
    upz.to_file(DIR_SIM / "upz.geojson", driver="GeoJSON")

    sedes = base.sedes.assign(tipo="sede", clave=None)[["id", "nombre", "upz", "localidad", "lon", "lat", "cupos", "tipo", "clave"]]
    cand = base.candidatos.assign(id=-1, tipo="colegio_nuevo", cupos=p.cupos_colegio_nuevo)
    cand = cand.rename(columns={"proyecto": "nombre"})[["id", "nombre", "upz", "localidad", "lon", "lat", "cupos", "tipo", "clave"]]
    col = pd.concat([sedes, cand], ignore_index=True)
    import geopandas as gpd
    gpd.GeoDataFrame(col, geometry=gpd.points_from_xy(col.lon.round(5), col.lat.round(5)), crs="EPSG:4326") \
        .drop(columns=["lon", "lat"]).to_file(DIR_SIM / "colegios.geojson", driver="GeoJSON")

    pd.DataFrame({"lon": fam.lon.round(5), "lat": fam.lat.round(5), "upz": fam.upz,
                  "vulnerable": fam.vulnerable, "sede_hermano": fam.sede_hermano}) \
        .to_parquet(DIR_SIM / "familias.parquet", index=False)


def main():
    ap = argparse.ArgumentParser(description=f"Precálculo de escenarios del simulador de {APP_NAME}")
    ap.add_argument("--fuente", choices=["real", "sintetica"], default="real")
    ap.add_argument("--sin-copiar-web", action="store_true")
    ap.add_argument("--sin-verificar", action="store_true", help="omite la verificación de estabilidad (más rápido)")
    args = ap.parse_args()

    t0 = time.time()
    paso = lambda msg: print(f"[{time.time() - t0:6.1f}s] {msg}", flush=True)  # noqa: E731
    p = ParametrosSimulador()

    paso(f"Cargando datos ({args.fuente})…")
    try:
        base = cargar_base(args.fuente, p)
    except Exception as e:  # sin internet / dataset caído: no bloquear el desarrollo
        if args.fuente != "real":
            raise
        print(f"  ⚠ No se pudieron cargar los datos reales ({e}). Se usa el modo sintético.")
        base = cargar_base("sintetica", p)
    paso(f"  {len(base.sedes)} sedes · {int(base.sedes.cupos.sum()):,} cupos de nuevos · "
         f"{int(base.demanda_upz.sum()):,} solicitudes")

    fam = generar_familias(base, p)
    base.zona_critica = definir_zona_critica(base, fam, p)
    nombres = base.upz.set_index("codigo")["nombre"]
    paso(f"  {fam.n:,} familias (1 = {p.estudiantes_por_familia} estudiantes) · zona crítica: "
         + ", ".join(nombres[c] for c in base.zona_critica))

    # --- Línea base ---
    r_base = simular(base, fam, p, Palancas(), mecanismo="orden_llegada")
    m_base = _limpiar(r_base.metricas)
    _guardar(DIR_ESCENARIOS / "base.json", {"id": "base", "mecanismo": "orden_llegada", **m_base})
    exportar_capas(base, fam, p, m_base)

    # --- Todas las combinaciones ---
    combinaciones = list(itertools.product(
        NIVELES, NIVELES, NIVELES, [None] + list(base.candidatos["clave"]), [False, True]))
    paso(f"Precalculando {len(combinaciones)} escenarios…")
    todos = {}
    for k, (wc, wh, wv, nuevo, ju) in enumerate(combinaciones, 1):
        pal = Palancas(wc, wh, wv, nuevo, ju)
        r = simular(base, fam, p, pal)
        if not args.sin_verificar:
            if pares_bloqueantes(r.prefs.tolist(), r.claves.tolist(), r.capacidad, r.asignacion):
                raise AssertionError(f"Escenario {pal.id}: asignación inestable")
        m = _limpiar(r.metricas)
        por_upz = m.pop("por_upz")
        esc = {"id": pal.id,
               "palancas": {"cercania": wc, "hermanos": wh, "vulnerabilidad": wv,
                            "colegio_nuevo": nuevo, "jornada_unica": ju},
               "metricas": m, "delta_vs_base": _delta(m, m_base), "por_upz": por_upz}
        _guardar(DIR_ESCENARIOS / f"{pal.id}.json", esc)
        # Versión compacta para la app: métricas en el orden de METRICAS y % por UPZ en el orden de indice.upz
        todos[pal.id] = {"m": [m[x] for x in METRICAS], "s": m["sin_cupo"],
                         "u": [por_upz.get(c, 0.0) for c in base.upz["codigo"]]}
        if k % 54 == 0:
            paso(f"  {k}/{len(combinaciones)}")

    indice = {
        "app": APP_NAME, "generado": date.today().isoformat(), "fuente": base.fuente,
        "metricas": METRICAS,
        "niveles": list(NIVELES),
        "pesos": p.pesos,
        "colegio_nuevo": [{"clave": c.clave, "etiqueta": c.etiqueta, "proyecto": c.proyecto,
                           "upz": c.upz, "upz_nombre": c.upz_nombre, "localidad": c.localidad,
                           "lon": round(c.lon, 5), "lat": round(c.lat, 5), "cupos": p.cupos_colegio_nuevo}
                          for c in base.candidatos.itertuples()],
        "zona_critica": [{"codigo": c, "nombre": nombres[c]} for c in base.zona_critica],
        "upz": list(base.upz["codigo"]),
        "base": {k: m_base[k] for k in METRICAS + ["estudiantes", "sin_cupo"]},
        "base_por_upz": [m_base["por_upz"].get(c, 0.0) for c in base.upz["codigo"]],
        "supuestos": {
            "familias": f"Familias sintéticas, sin datos personales: 1 familia = {p.estudiantes_por_familia} estudiantes nuevos "
                        f"({miles(fam.n)} familias), ubicadas según la población de 5 a 17 años por UPZ.",
            "corte": p.anio_corte,
            "cupos": f"{miles(p.demanda_nuevos_total)} solicitudes y {miles(p.cupos_nuevos_total)} cupos de nuevos "
                     "(Estudio de insuficiencia SED 2025).",
            "distancia": "Distancia en línea recta casa–colegio.",
            "opciones": f"Cada familia pide hasta {p.n_opciones} colegios; 'sin cupo' = no quedó en ninguno.",
            "jornada_unica": f"Jornada única: −{int(p.reduccion_jornada_unica * 100)}% de capacidad en todas las sedes.",
            "colegio_nuevo": f"Colegio nuevo: +{miles(p.cupos_colegio_nuevo)} cupos en un proyecto real de la SED.",
        },
        "parametros": {k: v for k, v in p.como_dict().items() if k not in ("pesos", "ubicaciones_nuevo")},
    }
    _guardar(DIR_ESCENARIOS / "indice.json", indice, indent=1)
    _guardar(DIR_ESCENARIOS / "todos.json", {"indice": indice, "escenarios": todos})

    if not args.sin_copiar_web and (RAIZ / "web").exists():
        DIR_WEB.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DIR_ESCENARIOS / "todos.json", DIR_WEB / "todos.json")
        for f in ("upz.geojson", "colegios.geojson"):
            shutil.copy2(DIR_SIM / f, DIR_WEB / f)

    # --- Resumen ---
    df = pd.DataFrame([{"id": i, **dict(zip(METRICAS, e["m"]))} for i, e in todos.items()])
    print()
    print(f"Línea base (orden de llegada): " + " · ".join(f"{k} {m_base[k]}" for k in METRICAS))
    for k, mejor in [("pct_sin_cupo_zona_critica", "min"), ("pct_vulnerables_sin_cupo", "min"), ("pct_primera_opcion", "max")]:
        fila = df.loc[df[k].idxmin() if mejor == "min" else df[k].idxmax()]
        print(f"Mejor {k:28} {fila[k]:6.2f}  ({fila['id']})")
    tam = (DIR_ESCENARIOS / "todos.json").stat().st_size / 1024
    paso(f"Listo: {len(todos)} escenarios en {DIR_ESCENARIOS} · todos.json {tam:.0f} KB")


if __name__ == "__main__":
    main()
