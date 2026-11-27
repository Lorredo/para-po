import { EARTH_RADIUS_M } from './distance'
import type { LatLng } from './types'

const toRad = (degrees: number) => (degrees * Math.PI) / 180

/**
 * Closest distance, in meters, from `target` to the straight segment a→b.
 *
 * GPS gives us points, but the phone travelled the line between them. On a
 * fast train with readings 30 s apart, neither point may be near the stop
 * even though the line between them went right past it.
 *
 * Uses a flat projection centred on the target, which is accurate to well
 * under a meter over the few km between two readings.
 */
export function closestApproachM(target: LatLng, a: LatLng, b: LatLng): number {
  const metersPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M
  const metersPerDegLng = metersPerDegLat * Math.cos(toRad(target.lat))
  const ax = (a.lng - target.lng) * metersPerDegLng
  const ay = (a.lat - target.lat) * metersPerDegLat
  const bx = (b.lng - target.lng) * metersPerDegLng
  const by = (b.lat - target.lat) * metersPerDegLat

  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  // Project the target (the origin) onto the segment, clamped to its ends.
  const t =
    lengthSq === 0
      ? 0
      : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSq))
  return Math.hypot(ax + t * dx, ay + t * dy)
}
