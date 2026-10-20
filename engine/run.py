"""
Recorrido narrativo "hoy vs Matrícula+": datos → población → escenarios → KPIs → JSON.

Uso (desde la raíz del proyecto):
    python -m engine.run                         # datos sintéticos (por defecto)
    python -m engine.run --fuente real           # datos reales
    python -m engine.run --estudiantes 20000 --semilla 7
"""
import argparse
import time

from engine.config import APP_NAME, DATA_PROCESSED, Supuestos
from engine.fuentes import cargar
from engine.estudiantes import generar_poblacion
from engine.asignacion.escenarios import escenario_hoy, escenario_matricula
from engine.asignacion.aceptacion_diferida import pares_bloqueantes
from engine.kpis import calcular_kpis
from engine.exportar import exportar


def main():
    p = argparse.ArgumentParser(description=f"Pipeline de {APP_NAME}")
    p.add_argument("--fuente", choices=["sintetica", "real"], default="sintetica")
    p.add_argument("--estudiantes", type=int, help="tamaño de la muestra de solicitudes")
    p.add_argument("--semilla", type=int)
    p.add_argument("--sin-copiar-web", action="store_true", help="no copiar los JSON a web/public/data")
    args = p.parse_args()

    s = Supuestos()
    if args.estudiantes:
        s.n_estudiantes = args.estudiantes
    if args.semilla is not None:
        s.semilla = args.semilla

    t0 = time.time()
    paso = lambda msg: print(f"[{time.time() - t0:6.1f}s] {msg}")  # noqa: E731

    paso(f"Cargando datos ({args.fuente})…")
    datos = cargar(args.fuente, s)
    capacidad = datos.sedes["cupos"].to_numpy()
    paso(f"  {len(datos.upz)} UPZ · {len(datos.sedes)} sedes · {capacidad.sum():,} cupos · "
         f"{int(datos.demanda_upz.sum()):,} solicitudes")

    paso("Generando población sintética de estudiantes…")
    pob = generar_poblacion(datos, s)

    paso("Escenario A: así se asigna hoy…")
    asig_hoy = escenario_hoy(pob, capacidad, s)

    paso(f"Escenario B: con {APP_NAME} (cupo garantizado + aceptación diferida)…")
    res = escenario_matricula(pob, capacidad, s)
    asig_mat, n_flujo = res.asignacion, res.n_flujo_final
    paso(f"  {res.n_garantizados:,} con cupo garantizado · {res.n_en_garantia:,} terminan en su garantía "
         f"· {pob.n - res.n_en_garantia:,} logran algo que prefieren más o igual")

    # Verificación de estabilidad sobre el resultado real (no solo en los tests),
    # con las listas y prioridades efectivas (incluye la sede garantizada)
    bloqueantes = pares_bloqueantes(res.prefs, res.claves, capacidad, asig_mat)
    if bloqueantes:
        raise AssertionError(f"La asignación no es estable: {len(bloqueantes)} pares bloqueantes")
    paso("  Estabilidad verificada: 0 pares bloqueantes")

    paso("Calculando KPIs…")
    k_hoy = calcular_kpis(pob, asig_hoy, datos.sedes, s)
    k_mat = calcular_kpis(pob, asig_mat, datos.sedes, s)

    paso(f"Exportando a {DATA_PROCESSED}…")
    r = exportar(datos, pob, asig_hoy, asig_mat, k_hoy, k_mat, n_flujo, s, copiar_web=not args.sin_copiar_web)

    h, m, d = r["hoy"], r["matricula"], r["delta"]
    print()
    print(f"{'':28}{'Hoy':>12}{APP_NAME:>14}{'Delta':>10}")
    for clave, etiqueta in [("sin_cupo", "Sin cupo"), ("pct_primera_opcion", "% 1ª opción"),
                            ("pct_top3", "% top 3"), ("tiempo_prom_min", "Tiempo prom. (min)"),
                            ("viajes_largos", f"Viajes > {s.umbral_viaje_largo_min:.0f} min"),
                            ("cupos_ociosos", "Cupos ociosos")]:
        print(f"{etiqueta:28}{h[clave]:>12}{m[clave]:>14}{d.get(clave, ''):>10}")
    print(f"\nLocalidad foco: {r['localidad_foco']} · ubicados en el paso final: {n_flujo}")
    print("Sin cupo por localidad (hoy → Matrícula+): " + ", ".join(
        f"{l['localidad']} {l['hoy']['sin_cupo']}→{l['matricula']['sin_cupo']}"
        for l in sorted(r["localidades"], key=lambda x: -x["hoy"]["sin_cupo"])[:6]))
    paso("Listo.")


if __name__ == "__main__":
    main()
