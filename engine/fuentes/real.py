"""
Carga de datos reales (Datos Abiertos Bogotá / IDECA / SED / Catastro).

Datasets (se descargan solos a data/raw/real/ si no están):
  - Oferta de cupos, sector oficial (03.2025): un punto por SEDE con cupos por nivel (se usan los
    regulares: preescolar a media + aceleración; `OTotal` incluye educación de adultos).
  - Demanda de cupos, sector oficial (03.2025): un punto por INSTITUCIÓN (DANE12_EST) con solicitudes (DTotal).
  - Colegios (Catastro, MapServer infraestructuraeducativa/0): sedes con nombre, DANE de sede, sector y
    coordenada (es la que se usa para cada sede: ver `cargar_oferta_demanda`).
  - Matrícula total, sector oficial (04.2025): mismos 747 puntos que la oferta, en el mismo orden, pero con el
    DANE de SEDE (DANE12_SED); sirve para emparejar cada punto de oferta con su sede en Catastro.
  - Estratificación socioeconómica por manzana (SDP, Decreto 532 de 2025): manzanas con estrato 1 a 6 =
    manzanas residenciales; ahí viven las familias sintéticas (estrato 0 = sin uso residencial).
  - Densidad predial por manzana (Catastro, MapServer catastro/densidadpredialmz/0, año 2026): número de
    predios de cada manzana; es el peso para repartir las familias entre las manzanas residenciales.
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

from engine.config import DATA_RAW
from engine.fuentes import Datos
from engine.fuentes.sintetica import LOCALIDADES

CARPETA = DATA_RAW / "real"

URLS = {
    "oferta_032025.geojson": "https://datosabiertos.bogota.gov.co/dataset/de12785a-edec-4fe1-b721-da31f213fca1/resource/b167c2db-30a9-4618-908a-64482f794c4d/download/ofertacupos_032025.geojson",
    "demanda_032025.geojson": "https://datosabiertos.bogota.gov.co/dataset/dffe1a92-12db-4571-8808-96a8e4964815/resource/9a1b247a-a74a-4729-b3a3-c2aa4d114ce1/download/demandacupos_032025.geojson",
    "upz_aprobacion_2024.geojson": "https://datosabiertos.bogota.gov.co/dataset/6a8b409c-3bdc-4cd6-a436-38c43801d5b0/resource/d0d29c00-8e6f-4c76-85b5-efea36c0f1ae/download/taprobacionofupz2024.geojson",
    "localidades.geojson": "https://datosabiertos.bogota.gov.co/dataset/856cb657-8ca3-4ee8-857f-37211173b1f8/resource/497b8756-0927-4aee-8da9-ca4e32ca3a8a/download/loca.json",
    "proyeccion_upz.ods": "https://datosabiertos.bogota.gov.co/dataset/0f1fb76a-1595-43d5-9257-0abcc3db908a/resource/96583ea9-9c0b-40c3-9797-156d173eb734/download/202503_upz_proyeccion_retroproyeccion_poblacion_2005_2035.ods",
    "colegios_nuevos_052026.geojson": "https://datosabiertos.bogota.gov.co/dataset/5f1dd10a-2c5a-4e6c-84cc-eb5beade9ac6/resource/017f306f-5bd6-4def-ad2e-272b91042745/download/colegiosnuevos_restitucion_052026.geojson",
    "matricula_total_042025.geojson": "https://datosabiertos.bogota.gov.co/dataset/02e88fbc-5081-443f-ac5e-4071191c8703/resource/a712dfb0-7fdb-4828-8b8f-916d3f29e34c/download/matriculatotal_042025.geojson",
    "jornada_unica_032025.geojson": "https://datosabiertos.bogota.gov.co/dataset/4e1dea84-98b9-4b56-9eef-49b02e0b2a75/resource/07ad78d2-2c67-47a1-ba45-024aa4f830aa/download/matriculajunica03_2025.geojson",
    # Estratificación por manzana (SDP, corte 29.10.2025). Shapefile comprimido (13,7 MB; el GeoJSON pesa 83 MB)
    "manzana_estratificacion.zip": "https://datosabiertos.bogota.gov.co/dataset/55467552-0af4-4524-a390-a2956035744e/resource/63dfac38-e729-4c7c-9935-fece39f176ea/download/manzanaestratificacion.zip",
}
URL_COLEGIOS = ("https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/educacion/"
                "infraestructuraeducativa/MapServer/0/query")
URL_PREDIOS_MZ = ("https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/catastro/"
                  "densidadpredialmz/MapServer/0/query")
ANIO_PREDIOS = 2026
SECTOR_OFICIAL = 2
COD_SUMAPAZ = "20"
# Sedes donde la coordenada de la SED cuadra mejor con su dirección que la de Catastro (ver docs/supuestos.md,
# "Ubicación de los colegios"): en esas se deja el punto de la SED. En las demás se usa el de Catastro.
PREFERIR_PUNTO_SED = {
    "111001100056",   # Colegio Jaime Hernando Garzón Forero (IED), sede principal (Catastro: TV 85 A; SED: TV 93 A)
    "111001010910",   # Colegio Nacional Nicolás Esguerra (IED)
}
ESTRATOS_RESIDENCIALES = range(1, 7)   # estrato 0 = manzana sin uso residencial (parques, industria, etc.)


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

    ruta = CARPETA / f"predios_manzana_{ANIO_PREDIOS}.csv"
    if not ruta.exists() or forzar:
        print(f"  descargando predios por manzana {ANIO_PREDIOS} (Catastro, paginado, sin geometría)…")
        filas, offset = [], 0
        while True:
            r = requests.get(URL_PREDIOS_MZ, timeout=180, params={
                "where": f"ANO = DATE '{ANIO_PREDIOS}-01-01'", "outFields": "MANCODIGO,N_PREDIOS",
                "returnGeometry": "false", "f": "json",
                "resultOffset": offset, "resultRecordCount": 2000, "orderByFields": "OBJECTID",
            })
            r.raise_for_status()
            feats = r.json().get("features", [])
            filas += [f["attributes"] for f in feats]
            offset += len(feats)
            if len(feats) < 2000:
                break
        pd.DataFrame(filas).to_csv(ruta, index=False)


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


def _nombre_sede(est: str, sed: str) -> str:
    """
    'COLEGIO X (IED)' + 'SEDE A - LOS ALPES' → 'Colegio X (IED) - Sede A - los Alpes'. Si la sede repite el
    nombre de la institución ('COLEGIO X (IED) - SEDE PRINCIPAL'), solo se agrega lo que sigue ('Sede Principal').
    """
    if not sed or _normalizar(sed) in _normalizar(est):
        return _titulo(est)
    if _normalizar(est) in _normalizar(sed):
        resto = sed.split(" - ", 1)[1] if " - " in sed else ""
        return f"{_titulo(est)} - {_titulo(resto)}" if resto else _titulo(est)
    return f"{_titulo(est)} - {_titulo(sed)}"


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
# Columnas de cupos REGULARES. `OTotal` también incluye educación de adultos (`Educacion_`),
# que no compite por cupo escolar: sin ella el total cuadra con la SED (784.632 vs 785.191).
CUPOS_REGULARES = ["OPreescola", "OPrimaria", "OSecundari", "OMedia", "Aceleracio"]


def cargar_geografia():
    """UPZ urbanas y localidades (sin Sumapaz, recortadas al área urbana)."""
    upz = gpd.read_file(CARPETA / "upz_aprobacion_2024.geojson").to_crs(4326)
    # Las UPR rurales tienen código numérico; solo se usan las UPZ urbanas
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

    localidades = upz.dissolve(by="cod_localidad", as_index=False)[["cod_localidad", "geometry"]]
    localidades = gpd.GeoDataFrame({
        "codigo": localidades["cod_localidad"].values,
        "nombre": [NOMBRE_LOCALIDAD[c] for c in localidades["cod_localidad"]],
    }, geometry=localidades.geometry.values, crs="EPSG:4326").sort_values("codigo").reset_index(drop=True)
    return upz, localidades


def cargar_oferta_demanda(upz, verbose=True):
    """
    Sedes oficiales urbanas con su capacidad regular y la demanda de su institución
    repartida entre sus sedes en proporción a la oferta. Devuelve (oferta, d_inst, demanda_perdida).
    """
    oferta = gpd.read_file(CARPETA / "oferta_032025.geojson").to_crs(4326)
    oferta["DANE12_EST"] = oferta["DANE12_EST"].astype(str)
    oferta["cupos_regulares"] = oferta[CUPOS_REGULARES].sum(axis=1)

    # DANE de la sede: el dataset de matrícula (SED 04.2025) trae los mismos puntos en el mismo orden,
    # con DANE12_SED. Se comprueba punto a punto antes de usarlo.
    matricula = gpd.read_file(CARPETA / "matricula_total_042025.geojson").to_crs(4326)
    alineados = (len(matricula) == len(oferta)
                 and (matricula["DANE12_EST"].astype(str).to_numpy() == oferta["DANE12_EST"].to_numpy()).all()
                 and (oferta.to_crs(3116).distance(matricula.to_crs(3116)) < 1).all())
    if not alineados:
        raise ValueError("Oferta y matrícula de la SED ya no traen los mismos puntos en el mismo orden: "
                         "revisar el emparejamiento de sedes")
    oferta["dane_sede"] = matricula["DANE12_SED"].astype(str).to_numpy()
    oferta = oferta[oferta["cupos_regulares"] > 0].reset_index(drop=True)

    # Nombre y coordenada de la sede: la capa de Colegios de Catastro, emparejada por DANE de sede.
    colegios = gpd.read_file(CARPETA / "colegios.geojson")
    colegios = colegios[(colegios["SECTOR"] == SECTOR_OFICIAL) & ~colegios.geometry.is_empty & colegios.geometry.notna()]
    colegios = colegios.assign(DANE12_SED=colegios["DANE12_SED"].astype(str)).drop_duplicates("DANE12_SED").set_index("DANE12_SED")
    en_catastro = oferta["dane_sede"].isin(colegios.index)
    oferta["nombre_sede"] = oferta["dane_sede"].map(colegios["NOMBRE_SED"]).fillna("")
    punto_cat = gpd.GeoSeries(oferta["dane_sede"].map(colegios.geometry), crs=colegios.crs).to_crs(4326)
    dist_m = oferta.to_crs(3116).distance(punto_cat.to_crs(3116))
    usar_cat = en_catastro & ~oferta["dane_sede"].isin(PREFERIR_PUNTO_SED)
    if verbose:
        q = dist_m[en_catastro].quantile([0.5, 0.9])
        print(f"  Sedes SED vs Catastro (mismo DANE de sede, {int(en_catastro.sum())}/{len(oferta)}): "
              f"mediana {q[0.5]:.1f} m · p90 {q[0.9]:.1f} m · máx {dist_m.max():,.0f} m · "
              f"{int((dist_m > 10).sum())} a más de 10 m · se usa Catastro en {int(usar_cat.sum())}")
    oferta.loc[usar_cat, "geometry"] = punto_cat[usar_cat].values
    oferta["nombre"] = [_nombre_sede(est, sed) for est, sed in zip(oferta["NOMBRE_EST"], oferta["nombre_sede"])]

    # UPZ de cada sede (las que caen fuera de las UPZ urbanas, p. ej. rurales, se descartan)
    oferta = gpd.sjoin(oferta, upz[["codigo", "localidad", "geometry"]], how="left", predicate="within")
    oferta = oferta[~oferta.index.duplicated(keep="first")]
    fuera = oferta["codigo"].isna()
    if fuera.any() and verbose:
        print(f"  {int(fuera.sum())} sedes fuera de las UPZ urbanas (rurales) se descartan "
              f"({int(oferta.loc[fuera, 'cupos_regulares'].sum()):,} cupos)")
    oferta = oferta[~fuera].reset_index(drop=True)
    oferta["lon"], oferta["lat"] = oferta.geometry.x, oferta.geometry.y

    # Demanda por institución → repartida entre sus sedes según su oferta
    demanda = gpd.read_file(CARPETA / "demanda_032025.geojson")
    demanda["DANE12_EST"] = demanda["DANE12_EST"].astype(str)
    d_inst = demanda.groupby("DANE12_EST")["DTotal"].sum()
    o_inst = oferta.groupby("DANE12_EST")["cupos_regulares"].transform("sum")
    oferta["demanda"] = oferta["DANE12_EST"].map(d_inst).fillna(0) * oferta["cupos_regulares"] / o_inst
    sin_oferta = set(d_inst.index) - set(oferta["DANE12_EST"])
    demanda_perdida = float(d_inst.reindex(list(sin_oferta)).sum()) if sin_oferta else 0.0
    return oferta, d_inst, demanda_perdida


def poblacion_escolar_upz(upz, anio: int = 2026, frac_15_19: float = 0.6) -> pd.Series:
    """
    Población en edad escolar (≈ 5 a 17 años) por UPZ, de las proyecciones SDP/DANE.
    Los quinquenios 5-9 y 10-14 cuentan completos; de 15-19 se toma `frac_15_19` (15, 16 y 17 años).
    """
    x = pd.read_excel(CARPETA / "proyeccion_upz.ods", engine="odf", sheet_name="Hoja1", header=4)
    x = x[x["AÑO"] == anio]
    cols = [c for c in x.columns if str(c).endswith(("_5-9", "_10-14"))]
    cols_15 = [c for c in x.columns if str(c).endswith("_15-19")]
    x = x.assign(edad_escolar=x[cols].sum(axis=1) + frac_15_19 * x[cols_15].sum(axis=1))
    # "009" → "UPZ9" (mismo código que los polígonos)
    x["codigo"] = "UPZ" + x["Código UPZ"].astype(str).str.lstrip("0")
    pob = x.groupby("codigo")["edad_escolar"].sum()
    return pob.reindex(upz["codigo"]).fillna(0.0)


def colegios_nuevos(upz) -> gpd.GeoDataFrame:
    """Proyectos de colegios nuevos y en restitución de la SED (sin cupos en el dataset)."""
    n = gpd.read_file(CARPETA / "colegios_nuevos_052026.geojson").to_crs(4326)
    n = gpd.sjoin(n, upz[["codigo", "nombre", "localidad", "geometry"]], how="left", predicate="within")
    return n.rename(columns={"NOMBRE_PROYECTO": "proyecto", "TIPO_PROYECTO": "tipo", "nombre": "upz_nombre"})


def manzanas_residenciales(upz) -> gpd.GeoDataFrame:
    """
    Manzanas con uso residencial (estrato 1 a 6 en la estratificación de la SDP), la UPZ urbana donde
    queda cada una (por su punto interior) y su peso para ubicar familias: el número de predios de la
    manzana según Catastro (en propiedad horizontal cada apartamento es un predio, así que se acerca al
    número de viviendas). Las manzanas sin dato de predios usan su área por la densidad predial
    residencial de su UPZ. Columnas: upz, estrato, predios, area_m2, peso, geometry (EPSG:4326).
    """
    m = gpd.read_file(CARPETA / "manzana_estratificacion.zip")      # proyección plana local (metros)
    m = m[m["ESTRATO"].isin(ESTRATOS_RESIDENCIALES) & m.geometry.notna() & ~m.geometry.is_empty].copy()
    m["geometry"] = m.geometry.make_valid()
    m["area_m2"] = m.geometry.area
    m = m[m["area_m2"] > 0].to_crs(4326)
    # Código de manzana: SDP usa 8 dígitos (sector 6 + manzana 2); Catastro, 9 (sector 6 + manzana 3)
    predios = pd.read_csv(CARPETA / f"predios_manzana_{ANIO_PREDIOS}.csv", dtype={"MANCODIGO": str})
    predios = predios.groupby("MANCODIGO")["N_PREDIOS"].max()
    codigo = m["CODIGO_MAN"].astype(str).str.zfill(8)
    m["predios"] = (codigo.str[:6] + "0" + codigo.str[6:]).map(predios)

    puntos = m[["geometry"]].copy()
    puntos["geometry"] = m.representative_point()
    j = gpd.sjoin(puntos, upz[["codigo", "geometry"]], how="inner", predicate="within")
    j = j[~j.index.duplicated(keep="first")]
    m = m.loc[j.index].assign(upz=j["codigo"].to_numpy())

    con = m["predios"].notna()
    dens_upz = m[con].groupby("upz")["predios"].sum() / m[con].groupby("upz")["area_m2"].sum()
    dens = m["upz"].map(dens_upz).fillna(m.loc[con, "predios"].sum() / m.loc[con, "area_m2"].sum())
    m["peso"] = m["predios"].where(con, m["area_m2"] * dens)
    return gpd.GeoDataFrame(m[["upz", "ESTRATO", "predios", "area_m2", "peso"]].rename(columns={"ESTRATO": "estrato"}),
                            geometry=m.geometry.values, crs="EPSG:4326").reset_index(drop=True)


def cargar_real(s) -> Datos:
    descargar()
    rng = np.random.default_rng(s.semilla)
    upz, localidades = cargar_geografia()
    oferta, d_inst, demanda_perdida = cargar_oferta_demanda(upz)

    # --- Escalado a la muestra de solicitudes ---
    total_dem = oferta["demanda"].sum()
    factor = s.n_estudiantes / total_dem
    dem_upz_real = oferta.groupby("codigo")["demanda"].sum().reindex(upz["codigo"]).fillna(0.0)
    demanda_upz = pd.Series(_reparto_entero(dem_upz_real.to_numpy() * factor, s.n_estudiantes), index=upz["codigo"].values)
    total_cupos = int(round(oferta["cupos_regulares"].sum() * factor))
    cupos = _reparto_entero(oferta["cupos_regulares"].to_numpy() * factor, total_cupos)

    sedes = pd.DataFrame({
        "dane": oferta["dane_sede"].values,
        "nombre": oferta["nombre"].values,
        "localidad": oferta["localidad"].values,
        "upz": oferta["codigo"].values,
        "lon": oferta["lon"].values,
        "lat": oferta["lat"].values,
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
    print(f"  Oferta:  {len(oferta):,} sedes · {int(oferta['cupos_regulares'].sum()):,} cupos regulares "
          f"(preescolar {int(oferta['OPreescola'].sum()):,} · primaria {int(oferta['OPrimaria'].sum()):,} · "
          f"secundaria {int(oferta['OSecundari'].sum()):,} · media {int(oferta['OMedia'].sum()):,})")
    print(f"  Demanda: {len(d_inst):,} instituciones · {int(d_inst.sum()):,} solicitudes"
          + (f" ({int(demanda_perdida):,} sin sede urbana con oferta, descartadas)" if demanda_perdida else ""))
    print(f"  UPZ urbanas: {len(upz)} · sedes con cupos tras escalar: {len(sedes)} · factor de escala ×{factor:.4f}")
    bal = (oferta.groupby("localidad")["cupos_regulares"].sum() - oferta.groupby("localidad")["demanda"].sum()).sort_values()
    print("  Balance real por localidad (cupos − solicitudes): "
          + ", ".join(f"{k} {int(v):+,}" for k, v in bal.items()))
