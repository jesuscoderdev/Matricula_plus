import { WebMercatorViewport } from '@deck.gl/core'

type Bbox = [[number, number], [number, number]]
export interface Margen { arriba?: number; abajo?: number; izquierda?: number; derecha?: number }

/**
 * Cámara que encuadra `bbox` CENTRADO en el espacio que dejan libre los márgenes (p. ej. el texto de
 * la portada a la izquierda). El relleno de fitBounds con márgenes desiguales no lo centra, así que
 * se ajusta al rectángulo libre y luego se corre la cámara para que su centro caiga en el de ese
 * rectángulo. Ningún margen pasa del 70 % del lado, para que el mapa siempre tenga espacio.
 */
export function encuadrar(bbox: Bbox, ancho: number, alto: number, margen: Margen = {}) {
  const W = Math.max(ancho, 60), H = Math.max(alto, 60)
  const pad = Math.round(Math.min(W, H) * 0.05)
  const lado = (a: number | undefined, total: number) => Math.min((a ?? 0) + pad, total * 0.7)
  const L = lado(margen.izquierda, W), R = lado(margen.derecha, W), T = lado(margen.arriba, H), B = lado(margen.abajo, H)
  const libreW = Math.max(60, W - L - R), libreH = Math.max(60, H - T - B)
  let ajuste: { longitude: number; latitude: number; zoom: number }
  try {
    ajuste = new WebMercatorViewport({ width: libreW, height: libreH }).fitBounds(bbox)
  } catch {
    return new WebMercatorViewport({ width: W, height: H }).fitBounds(bbox)
  }
  // El centro del encuadre debe quedar en (L + libreW / 2, T + libreH / 2) de la pantalla completa
  const completo = new WebMercatorViewport({ width: W, height: H, longitude: ajuste.longitude, latitude: ajuste.latitude, zoom: ajuste.zoom })
  const [longitude, latitude] = completo.unproject([W - L - libreW / 2, H - T - libreH / 2])
  return { longitude, latitude, zoom: ajuste.zoom }
}
