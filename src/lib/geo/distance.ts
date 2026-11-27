import type { LatLng } from './types'

/** Mean Earth radius (IUGG), in meters. */
export const EARTH_RADIUS_M = 6_371_008.8

const toRad = (degrees: number) => (degrees * Math.PI) / 180
const toDeg = (radians: number) => (radians * 180) / Math.PI

/**
 * Great-circle distance in meters (haversine). Accurate to well under a meter
 * at commuting distances, which is far below GPS error.
 */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Move a point by a small offset in meters (good for offsets up to a few km). */
export function offsetM(point: LatLng, northM: number, eastM: number): LatLng {
  const dLat = northM / EARTH_RADIUS_M
  const dLng = eastM / (EARTH_RADIUS_M * Math.cos(toRad(point.lat)))
  return { lat: point.lat + toDeg(dLat), lng: point.lng + toDeg(dLng) }
}
