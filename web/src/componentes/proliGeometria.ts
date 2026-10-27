/**
 * Geometría de Proli, en las coordenadas de sus capas (480 × 474). La usan la app (ProliAnimado)
 * y el generador de videos (scripts/proli-videos), así los dos dibujan el mismo personaje.
 */
export const ANCHO = 480, ALTO = 474
export const OJOS = [{ cx: 181, cy: 179.5 }, { cx: 226, cy: 179.5 }]
export const BOCA = { x0: 180, x1: 224, y: 215, curva: 232 }
/** Desde dónde gira el brazo que saluda */
export const HOMBRO_PX = { x: 386, y: 282 }
export const TINTA = '#2e170a'
export const RANGO = { x: 10, y: 8 }          // cuánto se mueven los ojos dentro de la cara
export const BRILLO = { x: 4.5, y: 3.5 }      // el brillo se mueve un poco más que el ojo: da profundidad
/** El saludo: ángulos del brazo (grados) repartidos parejo en SALUDO_S segundos */
export const SALUDO = [0, -24, 4, -24, 4, -24, 4, 0], SALUDO_S = 2.6
/** Al hablar, la boca se abre y se cierra a ritmo irregular, como sílabas: un ciclo dura HABLA_S segundos */
export const HABLA = { alto: [0.25, 1, 0.45, 0.85, 0.3, 1, 0.25], ancho: [1, 0.85, 1, 0.9, 1, 0.85, 1] }, HABLA_S = 0.9
