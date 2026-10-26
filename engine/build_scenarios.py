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
from engine.simulador.config import FUENTES, NIVELES, PRESETS, VERIFICACION, ParametrosSimulador
from engine.simulador.datos import cargar_base, insuficiencia_upz
from engine.simulador.escenario import Palancas, definir_zona_critica, simular
from engine.simulador.familias import DECIMALES, generar_familias

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


MAX_OPCIONES_WEB = 5   # la web deja elegir de 3 a 5 colegios por familia


def _f32(a) -> str:
    """Floats de 32 bits con el mínimo de dígitos que los identifica (la web usa Math.fround)."""
    return ",".join(np.format_float_positional(np.float32(x), unique=True, trim="-") for x in np.ravel(a))


def exportar_familias_web(base, fam, p) -> str:
    """
    Familias para que el navegador corra TODO el modelo en vivo (y deje editar los supuestos):
      - las 5 sedes existentes con menor puntaje (distancia + ruido) de cada familia, con su puntaje
        en float32 exacto y su distancia redondeada; con eso la web arma listas de 3 a 5 colegios
        idénticas a las de Python;
      - para cada colegio nuevo, las familias que podrían incluirlo en su lista, con su puntaje;
      - los números aleatorios de los atributos (vulnerable, hermano) y el orden de llegada.
    Devuelve el JSON como texto (los float32 se escriben a mano para no perder exactitud).
    """
    n, S, K = fam.n, fam.n_sedes, MAX_OPCIONES_WEB
    pos_upz = {c: i for i, c in enumerate(base.upz["codigo"])}
    puntaje = fam.dist[:, :S] + fam.ruido[:, :S]                       # float32, como en preferencias()
    top = np.argpartition(puntaje, K - 1, axis=1)[:, :K]
    orden = np.take_along_axis(puntaje, top, axis=1).argsort(axis=1, kind="stable")
    top = np.take_along_axis(top, orden, axis=1)
    top_p = np.take_along_axis(puntaje, top, axis=1)
    filas = np.arange(n)[:, None]
    top_d = np.round(fam.dist[filas, top].astype(np.float64), DECIMALES)
    d_herm = np.round(fam.dist[np.arange(n), fam.hermano_elegida].astype(np.float64), DECIMALES)

    candidatos = {}
    for k, clave in enumerate(base.candidatos["clave"]):
        col = S + k
        pc = fam.dist[:, col] + fam.ruido[:, col]
        cerca = np.flatnonzero(pc < top_p[:, -1])                      # podría entrar en el top 5
        candidatos[clave] = ('{"familias":' + json.dumps(cerca.tolist())
                             + ',"puntaje":[' + _f32(pc[cerca]) + ']'
                             + ',"dist":' + json.dumps(np.round(fam.dist[cerca, col].astype(np.float64), DECIMALES).tolist()) + '}')

    partes = {
        "n": json.dumps(int(n)), "n_sedes": json.dumps(int(S)), "max_opciones": json.dumps(K),
        "estudiantes_por_familia": json.dumps(p.estudiantes_por_familia),
        "lon": json.dumps(np.round(fam.lon, 5).tolist()), "lat": json.dumps(np.round(fam.lat, 5).tolist()),
        "upz": json.dumps([pos_upz[u] for u in fam.upz]),
        "u_vulnerable": json.dumps(fam.u_vulnerable.tolist()), "u_hermano": json.dumps(fam.u_hermano.tolist()),
        "hermano_elegida": json.dumps(fam.hermano_elegida.tolist()), "hermano_dist": json.dumps(d_herm.tolist()),
        "desempate": json.dumps(fam.desempate.tolist()),
        "top": json.dumps(top.ravel().tolist()), "top_puntaje": "[" + _f32(top_p) + "]",
        "top_dist": json.dumps(top_d.ravel().tolist()),
        "candidatos": "{" + ",".join(f'"{c}":{v}' for c, v in candidatos.items()) + "}",
        # Mismo orden aleatorio que usa la línea base (mecanismos.orden_llegada)
        "llegada": json.dumps(np.random.default_rng(p.semilla).permutation(n).tolist()),
    }
    return "{" + ",".join(f'"{k}":{v}' for k, v in partes.items()) + "}"


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
        "presets": [{"clave": c, "etiqueta": e, "descripcion": d,
                     "escenario": Palancas(*niveles).id.split("_")[0]}
                    for c, e, d, niveles in PRESETS],
        "colegio_nuevo": [{"clave": c.clave, "etiqueta": c.etiqueta, "proyecto": c.proyecto,
                           "upz": c.upz, "upz_nombre": c.upz_nombre, "localidad": c.localidad,
                           "lon": round(c.lon, 5), "lat": round(c.lat, 5), "cupos": p.cupos_colegio_nuevo}
                          for c in base.candidatos.itertuples()],
        "zona_critica": [{"codigo": c, "nombre": nombres[c]} for c in base.zona_critica],
        "zona_critica_fuente": ("Insuficiencia muy alta según el Estudio de insuficiencia SED 2025"
                                if p.zona_critica_nombres else "UPZ con más niños sin cupo en la línea base"),
        "upz": list(base.upz["codigo"]),
        # Capítulo «De dónde salen los datos»
        "fuentes": {
            "datos": [{"dato": d, "fuente": f, "corte": c, "url": u} for d, f, c, u in FUENTES],
            "verificacion": VERIFICACION,
            "privacidad": "Las familias son sintéticas: no se usa ningún dato personal (Ley 1581 de 2012). Las direcciones y "
                          "opciones reales de quienes piden cupo están en el sistema de matrícula y no son públicas.",
        },
        "base": {k: m_base[k] for k in METRICAS + ["estudiantes", "sin_cupo"]},
        "base_por_upz": [m_base["por_upz"].get(c, 0.0) for c in base.upz["codigo"]],
        "supuestos": {
            "familias": f"Familias sintéticas, sin datos personales: 1 familia = {p.estudiantes_por_familia} estudiantes nuevos "
                        f"({miles(fam.n)} familias), repartidas según la población de 5 a 17 años por UPZ"
                        + (" y ubicadas en manzanas residenciales (estratificación SDP)." if base.manzanas is not None else "."),
            "corte": p.anio_corte,
            "cupos": f"Se simulan {miles(p.demanda_nuevos_total)} solicitudes de nuevos (la demanda de nuevos de 2024 "
                     f"del Estudio de insuficiencia SED 2025) y {miles(p.cupos_nuevos_total)} cupos de nuevos "
                     f"({str(p.cupos_por_solicitud).replace('.', ',')} por solicitud en toda la ciudad: supuesto, porque "
                     "en el total hay cupos y faltan donde viven los niños), repartidos según la oferta de cada sede "
                     f"(SED 03.2025). Dato oficial: la SED reporta un déficit de {miles(p.deficit_sed)} cupos en 2024 "
                     f"y {p.upz_insuficientes_sed} UPZ con insuficiencia.",
            "distancia": "Distancia en línea recta casa–colegio.",
            "opciones": f"Cada familia pide hasta {p.n_opciones} colegios; 'sin cupo' = no quedó en ninguno.",
            "jornada_unica": f"Jornada única: −{int(p.reduccion_jornada_unica * 100)}% de capacidad en todas las sedes.",
            "colegio_nuevo": f"Colegio nuevo: +{miles(p.cupos_colegio_nuevo)} cupos en un proyecto real de la SED.",
        },
        "parametros": {k: v for k, v in p.como_dict().items() if k not in ("pesos", "ubicaciones_nuevo")},
        "pesos_presets": {c: {"cercania": p.pesos["cercania"][n[0]], "hermanos": p.pesos["hermanos"][n[1]],
                              "vulnerabilidad": p.pesos["vulnerabilidad"][n[2]]} for c, _, _, n in PRESETS},
    }
    _guardar(DIR_ESCENARIOS / "indice.json", indice, indent=1)
    _guardar(DIR_ESCENARIOS / "todos.json", {"indice": indice, "escenarios": todos})
    (DIR_ESCENARIOS / "familias.json").write_text(exportar_familias_web(base, fam, p), encoding="utf-8")

    if not args.sin_copiar_web and (RAIZ / "web").exists():
        DIR_WEB.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DIR_ESCENARIOS / "todos.json", DIR_WEB / "todos.json")
        shutil.copy2(DIR_ESCENARIOS / "familias.json", DIR_WEB / "familias.json")
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
