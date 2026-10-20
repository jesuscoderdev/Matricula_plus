"""
Carga de datos reales (Datos Abiertos Bogotá / IDECA / SED / Catastro).

Datasets (se descargan solos a data/raw/real/ si no están):
  - Oferta de cupos, sector oficial (03.2025): un punto por SEDE con cupos por nivel (OTotal).
  - Demanda de cupos, sector oficial (03.2025): un punto por INSTITUCIÓN (DANE12_EST) con solicitudes (DTotal).
  - Colegios (Catastro, MapServer infraestructuraeducativa/0): sedes con nombre, DANE de sede y sector.
  - UPZ: polígonos del dataset "Tasa de aprobación escolar en colegios oficiales por UPZ" (SED 2024),
    porque el dataset oficial de límites de UPZ tiene acceso restringido en el portal.
  - Localidades (IDECA): límites oficiales; se recortan al área urbana y se excluye Sumapaz.

Supuestos al convertir a la estructura común:
  - La demanda viene por institución: se reparte entre sus sedes en proporción a la oferta de cada sede.
  - La demanda de cada sede se atribuye a la UPZ donde está la sede (no hay datos de residencia).
  - Oferta y demanda se escalan con el mismo factor a la muestra de `n_estudiantes` solicitudes.
  - La calidad (tipo Saber 11) sigue siendo simulada: estos datasets no la incluyen.
"""
import unicodedata

import geopandas as gpd
import numpy as np
import pandas as pd

from config import DATA_RAW
from fuentes import Datos
from fuentes.sintetica import LOCALIDADES

CARPETA = DATA_RAW / "real"

URLS = {
    "oferta_032025.geojson": "https://datosabiertos.bogota.gov.co/dataset/de12785a-edec-4fe1-b721-da31f213fca1/resource/b167c2db-30a9-4618-908a-64482f794c4d/download/ofertacupos_032025.geojson",
    "demanda_032025.geojson": "https://datosabiertos.bogota.gov.co/dataset/dffe1a92-12db-4571-8808-96a8e4964815/resource/9a1b247a-a74a-4729-b3a3-c2aa4d114ce1/download/demandacupos_032025.geojson",
    "upz_aprobacion_2024.geojson": "https://datosabiertos.bogota.gov.co/dataset/6a8b409c-3bdc-4cd6-a436-38c43801d5b0/resource/d0d29c00-8e6f-4c76-85b5-efea36c0f1ae/download/taprobacionofupz2024.geojson",
    "localidades.geojson": "https://datosabiertos.bogota.gov.co/dataset/856cb657-8ca3-4ee8-857f-37211173b1f8/resource/497b8756-0927-4aee-8da9-ca4e32ca3a8a/download/loca.json",
}
URL_COLEGIOS = ("https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/educacion/"
                "infraestructuraeducativa/MapServer/0/query")
SECTOR_OFICIAL = 2
COD_SUMAPAZ = "20"
DISTANCIA_MAX_SEDE_M = 300    # para emparejar un punto de oferta con su sede en la capa de colegios


# ---------------------------------------------------------------- descarga
def descargar(forzar: bool = False):
    """Descarga los datasets que falten a data/raw/real/."""
    import requests

    CARPETA.mkdir(parents=True, exist_ok=True)
    for nombre, url in URLS.items():
        ruta = CARPETA / nombre
        if ruta.exists() and not forzar:
            continue
        print(f"  descargando {nombre}…")
        r = requests.get(url, timeout=180)
        r.raise_for_status()
        ruta.write_bytes(r.content)

    ruta = CARPETA / "colegios.geojson"
    if not ruta.exists() or forzar:
        print("  descargando colegios (Catastro, paginado)…")
        partes, offset = [], 0
        while True:
            r = requests.get(URL_COLEGIOS, timeout=180, params={
                "where": "1=1", "outFields": "*", "outSR": 4326, "f": "geojson",
                "resultOffset": offset, "resultRecordCount": 2000, "orderByFields": "OBJECTID",
            })
            r.raise_for_status()
            feats = r.json().get("features", [])
            if not feats:
                break
            partes += feats
            offset += len(feats)
            if len(feats) < 2000:
                break
        gdf = gpd.GeoDataFrame.from_features(partes, crs="EPSG:4326").drop_duplicates("OBJECTID")
        gdf.to_file(ruta, driver="GeoJSON")


# ---------------------------------------------------------------- nombres
def _normalizar(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return "".join(ch for ch in sin_tildes.upper() if ch.isalnum())


MINUSCULAS = {"de", "del", "la", "las", "los", "el", "y", "e", "en"}
NOMBRES_CONOCIDOS = {_normalizar(n): n for l in LOCALIDADES for n in l[5]}
NOMBRE_LOCALIDAD = {l[0]: l[1] for l in LOCALIDADES}


def _titulo(texto: str) -> str:
    """'COLEGIO JOSE ASUNCION SILVA (IED)' → 'Colegio Jose Asuncion Silva (IED)'."""
    palabras = []
    for i, p in enumerate(texto.strip().split()):
        limpia = p.strip("()").upper()
        if limpia in {"IED", "CED", "IE", "II", "III", "IV", "SAE"} or (len(limpia) <= 3 and limpia.isalpha() and limpia in {"I", "V"}):
            palabras.append(p.upper())
        elif i > 0 and p.lower() in MINUSCULAS:
            palabras.append(p.lower())
        else:
            palabras.append(p[:1].upper() + p[1:].lower())
    return " ".join(palabras)


def _nombre_upz(nombre: str) -> str:
    """Restaura tildes con la lista de UPZ conocida; si no está, título simple."""
    return NOMBRES_CONOCIDOS.get(_normalizar(nombre), _titulo(nombre))


def _reparto_entero(valores: np.ndarray, total: int) -> np.ndarray:
    """Redondea `valores` a enteros que suman exactamente `total` (mayor residuo)."""
    base = np.floor(valores).astype(int)
    faltan = total - base.sum()
    if faltan > 0:
        base[np.argsort(-(valores - base))[:faltan]] += 1
    return base


# ---------------------------------------------------------------- carga
def cargar_real(s) -> Datos:
    descargar()
    rng = np.random.default_rng(s.semilla)

    # --- UPZ urbanas (las UPR rurales tienen código numérico) ---
    upz = gpd.read_file(CARPETA / "upz_aprobacion_2024.geojson").to_crs(4326)
    upz = upz[upz["COD_UPZ"].astype(str).str.startswith("UPZ")].copy()
    # Algunas UPZ vienen en varios polígonos: una fila por código
    upz["geometry"] = upz.geometry.make_valid()
    upz = upz.dissolve(by="COD_UPZ", as_index=False, aggfunc="first")
    loc_raw = gpd.read_file(CARPETA / "localidades.geojson").to_crs(4326)
    loc_raw = loc_raw[loc_raw["LocCodigo"].astype(str) != COD_SUMAPAZ]

    puntos = upz.copy()
    puntos["geometry"] = upz.representative_point()
    j = gpd.sjoin(puntos, loc_raw[["LocCodigo", "geometry"]], how="left", predicate="within")
    upz["cod_localidad"] = j["LocCodigo"].astype(str).values
    upz = upz[upz["cod_localidad"].isin(NOMBRE_LOCALIDAD)]
    upz = gpd.GeoDataFrame({
        "codigo": upz["COD_UPZ"].astype(str).values,
        "nombre": [_nombre_upz(n) for n in upz["NOMBRE_UPZ"]],
        "localidad": [NOMBRE_LOCALIDAD[c] for c in upz["cod_localidad"]],
        "cod_localidad": upz["cod_localidad"].values,
    }, geometry=upz.geometry.make_valid().values, crs="EPSG:4326")

    # --- Localidades recortadas al área urbana (unión de sus UPZ) ---
    localidades = upz.dissolve(by="cod_localidad", as_index=False)[["cod_localidad", "geometry"]]
    localidades = gpd.GeoDataFrame({
        "codigo": localidades["cod_localidad"].values,
        "nombre": [NOMBRE_LOCALIDAD[c] for c in localidades["cod_localidad"]],
    }, geometry=localidades.geometry.values, crs="EPSG:4326").sort_values("codigo").reset_index(drop=True)

    # --- Oferta: un punto por sede ---
    oferta = gpd.read_file(CARPETA / "oferta_032025.geojson").to_crs(4326)
    oferta["DANE12_EST"] = oferta["DANE12_EST"].astype(str)
    oferta = oferta[oferta["OTotal"] > 0].reset_index(drop=True)

    # Nombre y DANE de la sede: punto más cercano de la misma institución en la capa de colegios
    colegios = gpd.read_file(CARPETA / "colegios.geojson")
    colegios = colegios[(colegios["SECTOR"] == SECTOR_OFICIAL) & ~colegios.geometry.is_empty & colegios.geometry.notna()]
    colegios["DANE12_EST"] = colegios["DANE12_EST"].astype(str)
    o_m, c_m = oferta.to_crs(3116), colegios.to_crs(3116)
    cerca = gpd.sjoin_nearest(o_m[["DANE12_EST", "geometry"]], c_m[["DANE12_EST", "DANE12_SED", "NOMBRE_SED", "geometry"]],
                              how="left", max_distance=DISTANCIA_MAX_SEDE_M, distance_col="dist_m")
    cerca = cerca[~cerca.index.duplicated(keep="first")]
    misma = cerca["DANE12_EST_left"] == cerca["DANE12_EST_right"]
    oferta["dane_sede"] = np.where(misma, cerca["DANE12_SED"].astype(str), oferta["DANE12_EST"])
    oferta["nombre_sede"] = np.where(misma, cerca["NOMBRE_SED"].fillna(""), "")

    # UPZ de cada sede (las que caen fuera de las UPZ urbanas, p. ej. rurales, se descartan)
    oferta = gpd.sjoin(oferta, upz[["codigo", "localidad", "geometry"]], how="left", predicate="within")
    oferta = oferta[~oferta.index.duplicated(keep="first")]
    fuera = oferta["codigo"].isna()
    if fuera.any():
        print(f"  {int(fuera.sum())} sedes fuera de las UPZ urbanas (rurales) se descartan "
              f"({int(oferta.loc[fuera, 'OTotal'].sum()):,} cupos)")
    oferta = oferta[~fuera].reset_index(drop=True)

    # --- Demanda por institución → repartida entre sus sedes según su oferta ---
    demanda = gpd.read_file(CARPETA / "demanda_032025.geojson")
    demanda["DANE12_EST"] = demanda["DANE12_EST"].astype(str)
    d_inst = demanda.groupby("DANE12_EST")["DTotal"].sum()
    o_inst = oferta.groupby("DANE12_EST")["OTotal"].transform("sum")
    oferta["demanda"] = oferta["DANE12_EST"].map(d_inst).fillna(0) * oferta["OTotal"] / o_inst
    sin_oferta = set(d_inst.index) - set(oferta["DANE12_EST"])
    demanda_perdida = float(d_inst.reindex(list(sin_oferta)).sum()) if sin_oferta else 0.0

    # --- Escalado a la muestra de solicitudes ---
    total_dem = oferta["demanda"].sum()
    factor = s.n_estudiantes / total_dem
    dem_upz_real = oferta.groupby("codigo")["demanda"].sum().reindex(upz["codigo"]).fillna(0.0)
    demanda_upz = pd.Series(_reparto_entero(dem_upz_real.to_numpy() * factor, s.n_estudiantes), index=upz["codigo"].values)
    total_cupos = int(round(oferta["OTotal"].sum() * factor))
    cupos = _reparto_entero(oferta["OTotal"].to_numpy() * factor, total_cupos)

    nombres = [
        f"{_titulo(est)} - {_titulo(sed)}" if sed and _normalizar(sed) not in _normalizar(est) else _titulo(est)
        for est, sed in zip(oferta["NOMBRE_EST"], oferta["nombre_sede"])
    ]
    sedes = pd.DataFrame({
        "dane": oferta["dane_sede"].values,
        "nombre": nombres,
        "localidad": oferta["localidad"].values,
        "upz": oferta["codigo"].values,
        "lon": oferta.geometry.x.values,
        "lat": oferta.geometry.y.values,
        "cupos": cupos,
    })
    sedes = sedes[sedes["cupos"] > 0].reset_index(drop=True)
    sedes.insert(0, "id", np.arange(len(sedes)))
    # Calidad simulada (estos datasets no traen Saber 11)
    sedes["calidad"] = np.clip(rng.normal(252, 16, len(sedes)) + (sedes["lat"].to_numpy() - 4.62) * 120, 200, 320).round(1)

    _imprimir_resumen(oferta, d_inst, demanda_perdida, upz, sedes, factor)

    return Datos(
        upz=upz, localidades=localidades, sedes=sedes,
        demanda_upz=demanda_upz.astype(int), fuente="real", escala=1.0 / factor,
    )


def _imprimir_resumen(oferta, d_inst, demanda_perdida, upz, sedes, factor):
    print("  ── Datos reales (SED 03.2025) ──")
    print(f"  Oferta:  {len(oferta):,} sedes · {int(oferta['OTotal'].sum()):,} cupos "
          f"(preescolar {int(oferta['OPreescola'].sum()):,} · primaria {int(oferta['OPrimaria'].sum()):,} · "
          f"secundaria {int(oferta['OSecundari'].sum()):,} · media {int(oferta['OMedia'].sum()):,})")
    print(f"  Demanda: {len(d_inst):,} instituciones · {int(d_inst.sum()):,} solicitudes"
          + (f" ({int(demanda_perdida):,} sin sede urbana con oferta, descartadas)" if demanda_perdida else ""))
    print(f"  UPZ urbanas: {len(upz)} · sedes con cupos tras escalar: {len(sedes)} · factor de escala ×{factor:.4f}")
    bal = (oferta.groupby("localidad")["OTotal"].sum() - oferta.groupby("localidad")["demanda"].sum()).sort_values()
    print("  Balance real por localidad (cupos − solicitudes): "
          + ", ".join(f"{k} {int(v):+,}" for k, v in bal.items()))
