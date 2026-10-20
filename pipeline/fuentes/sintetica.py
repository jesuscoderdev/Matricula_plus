"""
Generador de datos sintéticos realistas para Bogotá.

Produce la misma estructura que la fuente real:
- 19 localidades urbanas y 112 UPZ con sus nombres reales. La GEOMETRÍA es
  aproximada: polígonos de Voronoi dentro de una silueta simplificada de la
  ciudad (se reemplaza por los límites reales de IDECA con --fuente real).
- ~400 sedes oficiales con cupos ofertados y una calidad simulada tipo Saber 11.
- Demanda (solicitudes nuevas) por UPZ.

El desbalance está diseñado para reflejar el diagnóstico público de la SED:
déficit en Suba (Tibabuyes, El Rincón), Bosa (Bosa Occidental, Tintal Sur),
Kennedy (Patio Bonito) y Engativá (Garcés Navas); superávit en Usme,
Tunjuelito y San Cristóbal.
"""
import numpy as np
import pandas as pd
import geopandas as gpd
import shapely
from shapely.geometry import Polygon, MultiPoint

from config import DATA_RAW
from fuentes import Datos
from geo import KM_POR_GRADO_LAT, KM_POR_GRADO_LON

# Silueta simplificada del área urbana de Bogotá (lon, lat)
SILUETA = Polygon([
    (-74.020, 4.820), (-74.065, 4.828), (-74.092, 4.792), (-74.125, 4.762),
    (-74.150, 4.727), (-74.178, 4.702), (-74.200, 4.682), (-74.214, 4.652),
    (-74.226, 4.618), (-74.206, 4.594), (-74.182, 4.574), (-74.170, 4.545),
    (-74.160, 4.515), (-74.140, 4.480), (-74.110, 4.468), (-74.090, 4.490),
    (-74.080, 4.530), (-74.064, 4.560), (-74.054, 4.590), (-74.044, 4.625),
    (-74.034, 4.665), (-74.025, 4.700), (-74.019, 4.750),
])

# (código, nombre, lon, lat, perfil, [UPZ])
# perfil: "deficit" | "superavit" | "neutro"
LOCALIDADES = [
    ("01", "Usaquén", -74.036, 4.735, "neutro",
     ["Paseo de los Libertadores", "Verbenal", "La Uribe", "San Cristóbal Norte",
      "Toberín", "Los Cedros", "Usaquén", "Country Club", "Santa Bárbara"]),
    ("02", "Chapinero", -74.054, 4.652, "neutro",
     ["El Refugio", "San Isidro-Patios", "Pardo Rubio", "Chicó Lago", "Chapinero"]),
    ("03", "Santa Fe", -74.066, 4.609, "neutro",
     ["Sagrado Corazón", "La Macarena", "Las Nieves", "Las Cruces", "Lourdes"]),
    ("04", "San Cristóbal", -74.086, 4.560, "superavit",
     ["San Blas", "Sosiego", "20 de Julio", "La Gloria", "Los Libertadores"]),
    ("05", "Usme", -74.112, 4.500, "superavit",
     ["La Flora", "Danubio", "Gran Yomasa", "Comuneros", "Alfonso López",
      "Parque Entrenubes", "Ciudad Usme"]),
    ("06", "Tunjuelito", -74.133, 4.574, "superavit",
     ["Venecia", "Tunjuelito"]),
    ("07", "Bosa", -74.195, 4.612, "deficit",
     ["Apogeo", "Bosa Occidental", "Bosa Central", "El Porvenir", "Tintal Sur"]),
    ("08", "Kennedy", -74.153, 4.633, "deficit",
     ["Américas", "Carvajal", "Kennedy Central", "Timiza", "Tintal Norte",
      "Calandaima", "Corabastos", "Gran Britalia", "Patio Bonito", "Las Margaritas",
      "Bavaria", "Castilla"]),
    ("09", "Fontibón", -74.147, 4.678, "neutro",
     ["Fontibón", "Fontibón San Pablo", "Zona Franca", "Ciudad Salitre Occidental",
      "Granjas de Techo", "Modelia", "Capellanía", "Aeropuerto El Dorado"]),
    ("10", "Engativá", -74.112, 4.705, "deficit",
     ["Las Ferias", "Minuto de Dios", "Boyacá Real", "Santa Cecilia", "Bolivia",
      "Garcés Navas", "Engativá", "Jardín Botánico", "Álamos"]),
    ("11", "Suba", -74.078, 4.752, "deficit",
     ["La Academia", "Guaymaral", "San José de Bavaria", "Britalia", "El Prado",
      "La Alhambra", "Casa Blanca Suba", "Niza", "La Floresta", "Suba",
      "El Rincón", "Tibabuyes"]),
    ("12", "Barrios Unidos", -74.074, 4.669, "neutro",
     ["Los Andes", "Doce de Octubre", "Los Alcázares", "Parque Salitre"]),
    ("13", "Teusaquillo", -74.090, 4.643, "neutro",
     ["Galerías", "Teusaquillo", "Parque Simón Bolívar-CAN", "La Esmeralda",
      "Quinta Paredes", "Ciudad Salitre Oriental"]),
    ("14", "Los Mártires", -74.088, 4.606, "neutro",
     ["Santa Isabel", "La Sabana"]),
    ("15", "Antonio Nariño", -74.104, 4.589, "neutro",
     ["Restrepo", "Ciudad Jardín"]),
    ("16", "Puente Aranda", -74.115, 4.617, "neutro",
     ["Ciudad Montes", "Muzú", "San Rafael", "Zona Industrial", "Puente Aranda"]),
    ("17", "La Candelaria", -74.073, 4.597, "neutro",
     ["La Candelaria"]),
    ("18", "Rafael Uribe Uribe", -74.118, 4.568, "neutro",
     ["Quiroga", "Marco Fidel Suárez", "Marruecos", "Diana Turbay", "San José"]),
    ("19", "Ciudad Bolívar", -74.157, 4.551, "neutro",
     ["El Mochuelo", "Monteblanco", "Arborizadora", "San Francisco", "Lucero",
      "El Tesoro", "Ismael Perdomo", "Jerusalem"]),
]

# UPZ con déficit crítico y la dirección aproximada donde quedan dentro de su
# localidad (dx, dy), para que el mapa sintético se parezca al real.
FOCOS_DEFICIT = {
    "Tibabuyes": (-1.0, 0.2),
    "El Rincón": (-0.5, -0.1),
    "Bosa Occidental": (-1.0, 0.0),
    "Tintal Sur": (0.2, 1.0),
    "Patio Bonito": (-1.0, 0.3),
    "Garcés Navas": (-1.0, 0.0),
}

# UPZ con poca población residente (aeropuerto, zonas industriales, parques, rurales)
BAJA_RESIDENCIAL = {
    "Aeropuerto El Dorado", "Zona Franca", "Zona Industrial", "Parque Simón Bolívar-CAN",
    "Guaymaral", "Parque Entrenubes", "El Mochuelo", "Monteblanco", "Jardín Botánico",
    "Parque Salitre", "Chicó Lago", "El Refugio", "La Academia", "Capellanía",
    "Las Nieves", "Sagrado Corazón", "Country Club", "Santa Bárbara",
}

NOMBRES_COLEGIOS = [
    "Simón Bolívar", "Antonio Nariño", "Francisco de Paula Santander", "Policarpa Salavarrieta",
    "José Asunción Silva", "Gabriel García Márquez", "Manuela Beltrán", "Camilo Torres",
    "Jorge Eliécer Gaitán", "Débora Arango", "Rafael Pombo", "Gerardo Paredes",
    "La Belleza", "Nueva Esperanza", "Las Américas", "El Porvenir", "Los Alpes",
    "Rodrigo Lara Bonilla", "Luis Carlos Galán", "Alfonso López Pumarejo", "Tomás Carrasquilla",
    "Agustín Fernández", "Cundinamarca", "Juan Rey", "Diego Montaña Cuéllar", "Fe y Alegría",
    "Paulo VI", "Juan Pablo II", "Nicolás Esguerra", "Isabel II", "Restrepo Millán",
    "Venecia", "La Palestina", "El Japón", "Grancolombiano", "Saludcoop", "La Toscana",
    "Villa Rica", "San José", "Ciudad de Bogotá", "Carlos Pizarro", "República de Panamá",
    "República de Colombia", "Marco Fidel Suárez", "Liceo Femenino", "Kennedy",
    "Hernando Durán Dussán", "Ofelia Uribe", "Eduardo Umaña", "Germán Arciniegas",
    "Atanasio Girardot", "Nidia Quintero", "Instituto Técnico", "Brasilia", "La Chucua",
    "Gustavo Restrepo", "Aquileo Parra", "Prado Veraniego", "Toberín", "Delia Zapata",
]


def _voronoi_en(poligono, semillas: np.ndarray):
    """Polígonos de Voronoi de `semillas` recortados a `poligono`, en el mismo orden."""
    if len(semillas) == 1:
        return [poligono]
    vor = shapely.voronoi_polygons(MultiPoint(semillas), extend_to=poligono.envelope.buffer(0.05))
    celdas = list(vor.geoms)
    salida = []
    for x, y in semillas:
        p = shapely.Point(x, y)
        celda = next(c for c in celdas if c.contains(p) or c.touches(p))
        salida.append(celda.intersection(poligono))
    return salida


def _puntos_en(poligono, n: int, rng) -> np.ndarray:
    """n puntos aleatorios uniformes dentro de un polígono (muestreo por rechazo)."""
    minx, miny, maxx, maxy = poligono.bounds
    shapely.prepare(poligono)
    puntos = []
    while sum(len(p) for p in puntos) < n:
        xs = rng.uniform(minx, maxx, n * 3)
        ys = rng.uniform(miny, maxy, n * 3)
        dentro = shapely.contains_xy(poligono, xs, ys)
        puntos.append(np.column_stack([xs[dentro], ys[dentro]]))
    return np.vstack(puntos)[:n]


def _lloyd(poligono, k: int, rng, iteraciones: int = 12):
    """Divide un polígono en k celdas compactas (relajación de Lloyd)."""
    semillas = _puntos_en(poligono, k, rng)
    for _ in range(iteraciones):
        celdas = _voronoi_en(poligono, semillas)
        semillas = np.array([[c.centroid.x, c.centroid.y] for c in celdas])
    return _voronoi_en(poligono, semillas)


def _area_km2(geom) -> float:
    return geom.area * KM_POR_GRADO_LAT * KM_POR_GRADO_LON


def generar(s, guardar_crudos: bool = True) -> Datos:
    rng = np.random.default_rng(s.semilla)

    # --- 1. Localidades: Voronoi de centroides aproximados dentro de la silueta ---
    centros = np.array([[l[2], l[3]] for l in LOCALIDADES])
    geom_loc = _voronoi_en(SILUETA, centros)
    localidades = gpd.GeoDataFrame(
        {"codigo": [l[0] for l in LOCALIDADES], "nombre": [l[1] for l in LOCALIDADES],
         "perfil": [l[4] for l in LOCALIDADES]},
        geometry=geom_loc, crs="EPSG:4326",
    )

    # --- 2. UPZ: subdivisión de cada localidad en celdas compactas ---
    filas = []
    n_upz = 0
    for (cod, nom, _, _, perfil, nombres_upz), geom in zip(LOCALIDADES, geom_loc):
        celdas = _lloyd(geom, len(nombres_upz), rng)
        c_loc = np.array([geom.centroid.x, geom.centroid.y])
        offsets = [np.array([c.centroid.x, c.centroid.y]) - c_loc for c in celdas]

        # Los focos de déficit se ubican en la dirección donde quedan en la realidad
        libres = list(range(len(celdas)))
        asignacion = {}
        for nombre in nombres_upz:
            if nombre in FOCOS_DEFICIT:
                d = np.array(FOCOS_DEFICIT[nombre])
                mejor = max(libres, key=lambda i: offsets[i] @ d / (np.linalg.norm(offsets[i]) + 1e-9))
                asignacion[nombre] = mejor
                libres.remove(mejor)
        rng.shuffle(libres)
        for nombre in nombres_upz:
            if nombre not in asignacion:
                asignacion[nombre] = libres.pop()

        for nombre in nombres_upz:
            n_upz += 1
            filas.append({
                "codigo": f"UPZ{n_upz:03d}", "nombre": nombre, "localidad": nom,
                "cod_localidad": cod, "perfil": perfil, "geometry": celdas[asignacion[nombre]],
            })
    upz = gpd.GeoDataFrame(filas, crs="EPSG:4326")
    upz["area_km2"] = upz.geometry.apply(_area_km2)

    # --- 3. Demanda por UPZ ---
    peso = np.sqrt(upz["area_km2"].to_numpy()) * rng.lognormal(0, 0.35, len(upz))
    es_foco = upz["nombre"].isin(FOCOS_DEFICIT).to_numpy()
    es_baja = upz["nombre"].isin(BAJA_RESIDENCIAL).to_numpy()
    perfil = upz["perfil"].to_numpy()
    peso *= np.where(es_baja, 0.15, 1.0)
    peso *= np.where(es_foco, 2.6, 1.0)
    peso *= np.where(perfil == "deficit", 1.3, np.where(perfil == "superavit", 0.8, 1.0))
    demanda = rng.multinomial(s.n_estudiantes, peso / peso.sum())
    upz["demanda"] = demanda

    # --- 4. Oferta por UPZ: proporcional a la demanda con un factor de desbalance ---
    ratio = rng.lognormal(0, 0.15, len(upz))
    ratio *= np.where(perfil == "deficit", 0.8, np.where(perfil == "superavit", 1.75, 1.0))
    ratio *= np.where(es_foco, 0.5, 1.0)
    oferta = demanda * ratio
    oferta *= s.n_estudiantes * s.holgura_global_cupos / oferta.sum()

    # --- 5. Sedes: se reparten según la oferta y se les asignan cupos ---
    cupos_por_sede = oferta.sum() / s.n_sedes_objetivo
    sedes = []
    for i, fila in upz.iterrows():
        n_sedes = int(round(oferta[i] / cupos_por_sede))
        if n_sedes == 0 and oferta[i] > cupos_por_sede * 0.3:
            n_sedes = 1
        if n_sedes == 0:
            continue
        cupos = rng.multinomial(int(round(oferta[i])), rng.dirichlet(np.full(n_sedes, 3.0)))
        pts = _puntos_en(fila.geometry.buffer(-0.002) if fila.geometry.buffer(-0.002).area > 0 else fila.geometry, n_sedes, rng)
        for (x, y), c in zip(pts, cupos):
            sedes.append({"localidad": fila.localidad, "upz": fila.codigo, "lon": x, "lat": y, "cupos": int(c)})
    sedes = pd.DataFrame(sedes)
    sedes = sedes[sedes["cupos"] > 0].reset_index(drop=True)

    # Identificadores y nombres verosímiles (claramente sintéticos)
    sedes["id"] = np.arange(len(sedes))
    sedes["dane"] = [f"111001{rng.integers(0, 10**6):06d}" for _ in range(len(sedes))]
    usados: dict[str, int] = {}
    nombres = []
    for _ in range(len(sedes)):
        base = f"Colegio {NOMBRES_COLEGIOS[rng.integers(len(NOMBRES_COLEGIOS))]} IED"
        usados[base] = usados.get(base, 0) + 1
        nombres.append(base if usados[base] == 1 else f"{base} - Sede {chr(64 + usados[base])}")
    sedes["nombre"] = nombres
    # Calidad simulada tipo Saber 11 (puntaje global), un poco mejor hacia el norte
    sedes["calidad"] = np.clip(
        rng.normal(252, 16, len(sedes)) + (sedes["lat"].to_numpy() - 4.62) * 120, 200, 320
    ).round(1)
    sedes = sedes[["id", "dane", "nombre", "localidad", "upz", "lon", "lat", "cupos", "calidad"]]

    upz["oferta"] = sedes.groupby("upz")["cupos"].sum().reindex(upz["codigo"]).fillna(0).astype(int).to_numpy()

    # Copia "cruda" con la misma forma que tendrían los datos descargados
    if guardar_crudos:
        destino = DATA_RAW / "sintetica"
        destino.mkdir(parents=True, exist_ok=True)
        sedes.to_csv(destino / "oferta_sedes.csv", index=False, encoding="utf-8")
        upz[["codigo", "nombre", "localidad", "demanda"]].to_csv(destino / "demanda_upz.csv", index=False, encoding="utf-8")
        upz.to_file(destino / "upz.geojson", driver="GeoJSON")
        localidades.to_file(destino / "localidades.geojson", driver="GeoJSON")

    return Datos(
        upz=upz[["codigo", "nombre", "localidad", "cod_localidad", "geometry"]],
        localidades=localidades[["codigo", "nombre", "geometry"]],
        sedes=sedes,
        demanda_upz=upz.set_index("codigo")["demanda"],
        fuente="sintetica",
    )
