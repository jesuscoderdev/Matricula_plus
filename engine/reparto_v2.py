"""
Matrícula+ v2: «¿Y si el cupo no se diera por orden de llegada?». Calcula las cifras del guion v2 y
exporta los datos que lee el sitio (web/public/matricula/datos/). La interfaz no escribe cifras a mano.

Antes   = cada familia pide 3 colegios de su nivel y se atiende por orden de llegada; quien no entra
          queda en el colegio más cercano con cupo libre de su nivel.
Después = reparto óptimo (programación lineal, HiGHS) que minimiza la distancia con puntos de prioridad:
          estrato 1 suma 2 y estrato 2 suma 1; menores de 10 o de 14 a 16 años suman 1; quedar con el
          hermano suma de último. Regla de oro: ninguna localidad termina con más niños lejos que hoy.
«Lejos» = a más de 2 km de su colegio.

Nivel y edad (no hay datos por niño):
  · nuevos de cada nivel en Bogotá: EIL 2025, Tabla 7;
  · cómo se reparte cada nivel en la ciudad: demanda por nivel de cada colegio (SED, 03.2025), por localidad;
  · cupos de cada nivel en cada sede: oferta por nivel (SED, 03.2025);
  · edad: edad teórica del nivel (DANE): preescolar 3–5, primaria 6–10, secundaria 11–14, media 15–16.

Uso (desde la raíz del proyecto; tarda alrededor de un minuto):
    python -m engine.reparto_v2

Salidas (web/public/matricula/datos/):
    resultados.json     cifras de todas las pantallas, por localidad y por nivel, fuentes y contexto
    puntos.json         grupos de 10 niños que quedan lejos hoy o con Matrícula+ (para los mapas)
    localidades.geojson límites de las localidades urbanas (sin Sumapaz)
"""
import json
import time
from datetime import date

import geopandas as gpd
import numpy as np
import pandas as pd
from scipy.optimize import linprog
from scipy.sparse import coo_matrix, vstack

from engine.config import DATA_PROCESSED, RAIZ
from engine.fuentes.real import CARPETA, CUPOS_REGULARES, cargar_oferta_demanda
from engine.simulador import mecanismos as M
from engine.simulador.config import FUENTES, VERIFICACION, ParametrosSimulador
from engine.simulador.datos import cargar_base
from engine.simulador.familias import generar_familias

DIR_WEB = RAIZ / "web" / "public" / "matricula" / "datos"
R = 2.0                                     # km: «lejos» = más de 2 km de casa
NIVELES = ["Preescolar", "Primaria", "Secundaria", "Media"]
COL_OFERTA = ["OPreescola", "OPrimaria", "OSecundari", "OMedia"]
NUEVOS_EIL = np.array([42_794, 36_891, 31_084, 11_981])   # EIL 2025, Tabla 7
EDADES = [(3, 5), (6, 10), (11, 14), (15, 16)]
PESO_ESTRATO, PESO_EDAD, PESO_HERMANO = 2.0, 1.0, 1.0
K_CANDIDATOS = 60                           # colegios más cercanos de su nivel que se consideran por niño

# Fuentes que se suman a las del simulador (FUENTES): nivel, prioridad y deserción
FUENTES_V2 = [
    ("Cupos para nuevos por nivel", "Secretaría de Educación · Estudio de insuficiencia y limitaciones 2025, Tabla 7", "2025",
     "https://www.educacionbogota.edu.co/portal_institucional/sites/default/files/inline-files/2022/bogota-EIL-para-2025.pdf"),
    ("Grupos que hoy se priorizan en la matrícula", "Alcaldía de Bogotá · Proceso de matrícula 2027", "2026",
     "https://bogota.gov.co/mi-ciudad/educacion/inicia-proceso-de-matriculas-2027-para-colegios-oficiales-de-bogota"),
    ("Deserción por grado", "Universidad de los Andes · Apuntes de Gestión y Políticas Públicas n.º 18", "06.2025",
     "https://gobierno.uniandes.edu.co/wp-content/uploads/AGPP-18.pdf"),
    ("Alertas y causas de deserción", "Concejo de Bogotá · 85 mil niños en riesgo de abandonar el colegio", "02.2026",
     "https://concejodebogota.gov.co/85-mil-ninos-en-riesgo-de-abandonar-el-colegio-en-bogota-desercion/cbogota/2026-02-23/124648.php"),
]
# Por qué dar prioridad a los más grandes (cifras publicadas; no salen de la simulación)
DESERCION = {
    "noveno_no_pasa_a_decimo_pct": 18.6,
    "media_se_gradua_pct": 77.1,
    "fuente_grado": "Universidad de los Andes, Apuntes de Gestión y Políticas Públicas n.º 18 (junio 2025), con datos de la SED (2022)",
    "alerta_critica_estudiantes": 85_000,
    "alerta_critica_pct": 12,
    "cambio_residencia_pct": 26.93,
    "fuente_causas": "Concejo de Bogotá (febrero 2026), con datos de la SED 2025",
    "advertencia": ("Que la distancia aumente la deserción es una inferencia a partir de estas cifras, no una medida. "
                    "Los traslados no están en la simulación: la prioridad se aplica a los grandes que llegan como nuevos."),
}
# Grupos que la Secretaría ya prioriza en la primera fase (Alcaldía de Bogotá, matrícula 2027)
PRIORIZADOS_SED = ["niños de preescolar", "niños con hermanos en el colegio", "niños con discapacidad",
                   "niños de comunidades étnicas", "víctimas del conflicto"]


def reparto_entero(x, total):
    """Redondeo de mayor residuo: enteros que suman `total`."""
    x = np.asarray(x, float) * total / x.sum()
    piso = np.floor(x).astype(int)
    falta = total - piso.sum()
    piso[np.argsort(-(x - piso))[:falta]] += 1
    return piso


def ipf(semilla, filas, cols, it=200):
    """Ajuste proporcional iterativo: una matriz parecida a `semilla` con esas sumas por fila y columna."""
    m = semilla.astype(float) + 1e-9
    for _ in range(it):
        m *= (filas / m.sum(1))[:, None]
        m *= (cols / m.sum(0))[None, :]
    return m


def calcular():
    t0 = time.time()
    p = ParametrosSimulador()
    base = cargar_base("real", p, verbose=False)
    fam = generar_familias(base, p)
    epf = p.estudiantes_por_familia
    n, S = fam.n, fam.n_sedes
    D = fam.dist[:, :S].astype(float)
    rng = np.random.default_rng(p.semilla + 7)

    # ---------------- Sedes: cupos de nuevos por nivel (mismo orden que base.sedes)
    oferta, _, _ = cargar_oferta_demanda(base.upz, verbose=False)
    oferta = oferta.copy()
    oferta["cupos_regulares"] = oferta[CUPOS_REGULARES].sum(axis=1)
    sedes_con_nivel = int((oferta[COL_OFERTA].sum(axis=1) > 0).sum())
    cupos_revisados = int(oferta["cupos_regulares"].sum())
    cupos = reparto_entero(oferta["cupos_regulares"].to_numpy(), p.cupos_nuevos_total)
    oferta = oferta[cupos > 0].reset_index(drop=True)
    assert len(oferta) == len(base.sedes) and np.allclose(oferta["lon"], base.sedes["lon"])
    cap = M.capacidades(base.sedes["cupos"].to_numpy(), None, False, p.reduccion_jornada_unica, epf)
    tot_nivel = reparto_entero(NUEVOS_EIL, n)                  # familias por nivel
    semilla_s = oferta[COL_OFERTA].to_numpy(float)
    m = ipf(semilla_s, cap.astype(float), tot_nivel.astype(float))

    # ---------------- Familias: nivel según la demanda por nivel de su localidad
    dem = gpd.read_file(CARPETA / "demanda_032025.geojson")
    dem["DANE12_EST"] = dem["DANE12_EST"].astype(str)
    d_inst = dem.groupby("DANE12_EST")[NIVELES].sum()
    colegios_con_solicitudes = int((d_inst.sum(axis=1) > 0).sum())
    o_inst = oferta.groupby("DANE12_EST")["cupos_regulares"].transform("sum")
    part = (oferta["cupos_regulares"] / o_inst).to_numpy()[:, None]
    dem_sede = d_inst.reindex(oferta["DANE12_EST"]).fillna(0).to_numpy() * part
    dem_loc = pd.DataFrame(dem_sede, columns=NIVELES).groupby(oferta["localidad"].values).sum()
    loc_upz = base.upz.set_index("codigo")["localidad"]
    loc_f = loc_upz.reindex(fam.upz).to_numpy()
    locs = sorted(set(loc_f))
    fam_loc = np.array([(loc_f == L).sum() for L in locs], float)
    semilla_l = dem_loc.reindex(locs).fillna(0).to_numpy() + 1
    ml = ipf(semilla_l, fam_loc, tot_nivel.astype(float))
    nivel = np.empty(n, int)
    for a, L in enumerate(locs):
        idx = rng.permutation(np.flatnonzero(loc_f == L))
        cuantos = reparto_entero(ml[a], len(idx))
        nivel[idx] = np.repeat(np.arange(4), cuantos)
    # Cupos enteros por nivel: el total de cada nivel = familias de ese nivel (hay un cupo por solicitud)
    por_nivel = np.bincount(nivel, minlength=4)
    cap_n = np.zeros((S, 4), int)
    for k in range(4):
        cap_n[:, k] = reparto_entero(np.where(semilla_s[:, k] > 0, m[:, k], 0), por_nivel[k])
    edad = np.array([rng.integers(EDADES[k][0], EDADES[k][1] + 1) for k in nivel])
    pequeno = edad < 10
    # Grandes: 14 a 16 años (≈ noveno, décimo y once), el tramo con más deserción en Bogotá
    grande = edad >= 14
    # Vulnerable = vive en una manzana de estrato 1 o 2 (SDP, estratificación por manzana); estrato 1 primero
    pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy(fam.lon, fam.lat), crs=4326)
    jn = gpd.sjoin(pts, base.manzanas[["estrato", "geometry"]].to_crs(4326), how="left", predicate="within")
    estrato = jn[~jn.index.duplicated()]["estrato"].fillna(3).astype(int).to_numpy()
    vul1 = estrato == 1
    vul = estrato <= 2
    herm = fam.sede_hermano

    # ---------------- ANTES: 3 opciones de su nivel, orden de llegada, luego el más cercano con cupo
    punt = D + fam.ruido[:, :S]
    prefs = np.empty((n, 3), int)
    for i in range(n):
        ok = np.flatnonzero(cap_n[:, nivel[i]] > 0)
        top = ok[np.argsort(punt[i, ok])[:3]]
        if herm[i] >= 0 and cap_n[herm[i], nivel[i]] > 0 and herm[i] not in top:
            top = np.concatenate([[herm[i]], top[:2]])
        prefs[i] = top
    libres = cap_n.copy()
    asig = np.full(n, -1)
    for i in np.random.default_rng(p.semilla).permutation(n):
        for j in prefs[i]:
            if libres[j, nivel[i]] > 0:
                libres[j, nivel[i]] -= 1; asig[i] = j; break
    en_opciones = asig >= 0
    for i in rng.permutation(np.flatnonzero(asig < 0)):
        ok = np.flatnonzero(libres[:, nivel[i]] > 0)
        j = ok[np.argmin(D[i, ok])]; libres[j, nivel[i]] -= 1; asig[i] = j
    d_antes = D[np.arange(n), asig]

    # ---------------- DESPUÉS: asignación óptima por cercanía y prioridad
    w = 1.0 + PESO_ESTRATO * vul1 + (PESO_ESTRATO / 2) * (vul & ~vul1) + PESO_EDAD * (pequeno | grande)
    filas, cols, costo, fila_cap = [], [], [], []
    for i in range(n):
        ok = np.flatnonzero(cap_n[:, nivel[i]] > 0)
        cand = set(ok[np.argsort(D[i, ok])[:K_CANDIDATOS]].tolist()) | {int(asig[i])}
        for j in cand:
            d = D[i, j]
            c = w[i] * (d + ((20.0 + 3.0 * (d - R)) if d > R else 0.0))   # lejos: castigo fijo + cada km de más
            if herm[i] == j:
                c -= PESO_HERMANO * w[i]
            filas.append(i); cols.append(j); costo.append(c); fila_cap.append(j * 4 + nivel[i])
    filas, cols, costo, fila_cap = map(np.array, (filas, cols, costo, fila_cap))
    mm = len(costo)
    A_eq = coo_matrix((np.ones(mm), (filas, np.arange(mm))), shape=(n, mm))
    A_cap = coo_matrix((np.ones(mm), (fila_cap, np.arange(mm))), shape=(S * 4, mm))
    # Regla de oro: ninguna localidad termina con más niños lejos que hoy
    loc_id = {L: a for a, L in enumerate(locs)}
    lejos_e = D[filas, cols] > R
    fl = np.array([loc_id[loc_f[i]] for i in filas[lejos_e]])
    A_loc = coo_matrix((np.ones(lejos_e.sum()), (fl, np.flatnonzero(lejos_e))), shape=(len(locs), mm))
    lim = np.array([((loc_f == L) & (d_antes > R)).sum() for L in locs])
    res = linprog(costo, A_ub=vstack([A_cap, A_loc]), b_ub=np.concatenate([cap_n.ravel(), lim]),
                  A_eq=A_eq, b_eq=np.ones(n), bounds=(0, 1), method="highs")
    assert res.status == 0, res.message
    x = res.x
    desp = np.full(n, -1)
    desp[filas[x > 0.5]] = cols[x > 0.5]
    assert (desp >= 0).all(), "solución fraccional"
    d_desp = D[np.arange(n), desp]
    segundos = time.time() - t0

    # ---------------- Métricas (en niños)
    def cifra(mask):
        return {"ninos": int(mask.sum() * epf),
                "lejos_antes": int(((d_antes > R) & mask).sum() * epf),
                "lejos_despues": int(((d_desp > R) & mask).sum() * epf),
                "km_antes": round(float(d_antes[mask].mean()), 2) if mask.any() else None,
                "km_despues": round(float(d_desp[mask].mean()), 2) if mask.any() else None}

    lejos_a, lejos_d = d_antes > R, d_desp > R
    con_h = herm >= 0
    # Niños sin ningún cupo de su nivel a menos de R km (aunque estuviera libre): nadie puede acercarlos
    sin_opcion = np.array([not (D[i, cap_n[:, nivel[i]] > 0] <= R).any() for i in range(n)])
    ocupados = np.zeros((S, 4), int)
    np.add.at(ocupados, (desp, nivel), 1)

    def quien_ocupa(i):
        """Prioridad mínima de quienes ocupan los cupos de su nivel a menos de R km."""
        cerca = np.flatnonzero((D[i] <= R) & (cap_n[:, nivel[i]] > 0))
        otros = np.flatnonzero(np.isin(desp, cerca) & (nivel == nivel[i]))
        return w[otros].min() if len(otros) else np.inf

    def explicar(mask):
        """¿Por qué siguen lejos? Sin ningún cupo de su nivel cerca, o con cupos cercanos ocupados."""
        idx = np.flatnonzero(mask & lejos_d)
        con_op = idx[~sin_opcion[idx]]
        libres_cerca = sum(int(((D[i] <= R) & (cap_n[:, nivel[i]] > ocupados[:, nivel[i]])).any()) for i in con_op)
        km = D[con_op, desp[con_op]]
        return {"lejos": int(len(idx) * epf), "sin_cupo_de_su_nivel_a_2km": int(sin_opcion[idx].sum() * epf),
                "con_cupo_cerca_ocupado": int(len(con_op) * epf),
                "con_cupo_libre_cerca": int(libres_cerca * epf),
                "ocupado_por_igual_o_mas_prioridad": int(sum(quien_ocupa(i) >= w[i] - 1e-9 for i in con_op) * epf),
                "km_promedio_ocupado": round(float(km.mean()), 2) if len(km) else None}

    sep = con_h & (desp != herm)
    h_sin_nivel = sep & (cap_n[np.maximum(herm, 0), nivel] == 0)
    grupos = {
        "bogota": np.ones(n, bool), "estrato_1": vul1, "vulnerables": vul, "menores_10": pequeno,
        "grandes": grande, "medianos_10_13": ~pequeno & ~grande, "con_hermano": con_h,
        "vulnerables_menores_10": vul & pequeno, "vulnerables_grandes": vul & grande,
        "vulnerables_con_hermano_menores_10": vul & pequeno & con_h,
    }
    out = {
        "version": date.today().isoformat(),
        "radio_km": R,
        "ninos_por_grupo_simulado": int(epf),
        "grupos": {k: cifra(v) for k, v in grupos.items()},
        "por_nivel": {NIVELES[k]: cifra(nivel == k) for k in range(4)},
        "hermanos": {"total": int(con_h.sum() * epf), "juntos_antes": int(((asig == herm) & con_h).sum() * epf),
                     "juntos_despues": int((con_h & ~sep).sum() * epf), "separados": int(sep.sum() * epf),
                     "colegio_del_hermano_sin_su_nivel": int(h_sin_nivel.sum() * epf),
                     "colegio_del_hermano_lleno": int((sep & ~h_sin_nivel).sum() * epf),
                     "separados_y_lejos": int((sep & lejos_d).sum() * epf)},
        "flujos": {"lejos_a_cerca": int((lejos_a & ~lejos_d).sum() * epf),
                   "siguen_lejos": int((lejos_a & lejos_d).sum() * epf),
                   "cerca_a_lejos": int((~lejos_a & lejos_d).sum() * epf),
                   "cerca_a_lejos_estrato": {str(e): int((~lejos_a & lejos_d & (estrato == e)).sum() * epf) for e in (1, 2)},
                   "cerca_a_lejos_km_promedio": round(float(d_desp[~lejos_a & lejos_d].mean()), 2)},
        "lejos_km": {"promedio_antes": round(float(d_antes[lejos_a].mean()), 2),
                     "promedio_despues": round(float(d_desp[lejos_d].mean()), 2),
                     "max_antes": round(float(d_antes[lejos_a].max()), 2),
                     "max_despues": round(float(d_desp[lejos_d].max()), 2)},
        "por_que_siguen_lejos": {"todos": explicar(np.ones(n, bool)),
                                 "vulnerables_menores_10": explicar(vul & pequeno),
                                 "vulnerables_con_hermano_menores_10": explicar(vul & pequeno & con_h),
                                 "vulnerables_grandes": explicar(vul & grande)},
        "en_sus_opciones_antes": int(en_opciones.sum() * epf),
        "por_localidad": {},
    }
    for L in locs:
        mk = loc_f == L
        c = cifra(mk)
        c["cupos"] = int(base.sedes.loc[base.sedes["localidad"] == L, "cupos"].sum())
        for nombre, lejos in (("lejos_antes_por_nivel", lejos_a), ("lejos_despues_por_nivel", lejos_d), ("ninos_por_nivel", True)):
            c[nombre] = {NIVELES[k]: int((lejos & mk & (nivel == k)).sum() * epf) for k in range(4)}
        out["por_localidad"][L] = c
    out["simulacion"] = {
        "fuentes_publicas": len(FUENTES), "sedes_con_cupos_por_nivel": sedes_con_nivel,
        "colegios_con_solicitudes_por_nivel": colegios_con_solicitudes, "cupos_revisados": cupos_revisados,
        "manzanas_residenciales": int(len(base.manzanas)), "upz": int(base.upz.shape[0]), "localidades": len(locs),
        "sedes_con_cupos_de_nuevos": int(S), "grupos": int(n), "ninos": int(n * epf),
        "nuevos_oficial": int(p.demanda_nuevos_total), "distancias_calculadas": int(n * S),
        "combinaciones_nino_colegio": int(mm), "restricciones": int(n + S * 4 + len(locs)),
        "segundos": round(segundos),
        "por_nivel_ninos": {NIVELES[k]: int((nivel == k).sum() * epf) for k in range(4)},
        "edades_por_nivel": {NIVELES[k]: list(EDADES[k]) for k in range(4)},
        "puntos": {"estrato_1": PESO_ESTRATO, "estrato_2": PESO_ESTRATO / 2, "edad": PESO_EDAD, "hermano": PESO_HERMANO},
        "pct_hermano": p.pct_hermano, "vecinos_hermano": p.vecinos_hermano,
    }
    out["desercion"] = DESERCION
    out["priorizados_sed"] = PRIORIZADOS_SED
    out["fuentes"] = {"datos": [{"dato": d, "fuente": f, "corte": c, "url": u} for d, f, c, u in [*FUENTES, *FUENTES_V2]],
                      "verificacion": VERIFICACION,
                      "privacidad": ("Los niños son recreados: no se usa ningún dato personal (Ley 1581 de 2012). La edad, el grado "
                                     "y la situación de cada niño están en el sistema de matrícula y no son públicos.")}

    # Grupos que quedan lejos en algún momento, para los mapas (cada punto = 10 niños)
    mapa = np.flatnonzero(lejos_a | lejos_d)
    puntos = {
        "lon": [round(float(v), 5) for v in fam.lon[mapa]], "lat": [round(float(v), 5) for v in fam.lat[mapa]],
        "nivel": nivel[mapa].tolist(), "estrato": estrato[mapa].tolist(), "edad": edad[mapa].tolist(),
        "lejos_antes": lejos_a[mapa].astype(int).tolist(), "lejos_despues": lejos_d[mapa].astype(int).tolist(),
        "localidad": [loc_id[L] for L in loc_f[mapa]], "localidades": locs, "niveles": NIVELES,
    }
    return out, puntos


def exportar(out, puntos):
    DIR_WEB.mkdir(parents=True, exist_ok=True)
    escribir = lambda nombre, x: (DIR_WEB / nombre).write_text(json.dumps(x, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    escribir("resultados.json", out)
    escribir("puntos.json", puntos)
    loc = gpd.read_file(DATA_PROCESSED / "localidades.geojson")
    loc = loc[loc["nombre"].isin(puntos["localidades"])][["nombre", "geometry"]]
    loc["geometry"] = loc.geometry.simplify(0.0004, preserve_topology=True)
    (DIR_WEB / "localidades.geojson").write_text(loc.to_json(drop_id=True, to_wgs84=True), encoding="utf8")


if __name__ == "__main__":
    out, puntos = calcular()
    exportar(out, puntos)
    b = out["grupos"]["bogota"]
    print(f"lejos: {b['lejos_antes']:,} → {b['lejos_despues']:,} · {out['simulacion']['segundos']} s · {DIR_WEB}")
