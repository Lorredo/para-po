import { haversineM } from './distance'
import type { LatLng } from './types'

/** A route with precomputed distances, so lookups along it are cheap. */
export type Polyline = {
  points: LatLng[]
  /** cumulativeM[i] is the distance from points[0] to points[i]. */
  cumulativeM: number[]
  totalM: number
}

export function measurePolyline(points: LatLng[]): Polyline {
  if (points.length === 0)
    throw new Error('A polyline needs at least one point')
  const cumulativeM = [0]
  for (let i = 1; i < points.length; i++) {
    cumulativeM.push(
      cumulativeM[i - 1]! + haversineM(points[i - 1]!, points[i]!),
    )
  }
  return { points, cumulativeM, totalM: cumulativeM[cumulativeM.length - 1]! }
}

/** The point a given distance along the route, clamped to its ends. */
export function pointAlong(line: Polyline, distanceM: number): LatLng {
  const { points, cumulativeM, totalM } = line
  if (!(distanceM > 0)) return points[0]!
  if (distanceM >= totalM) return points[points.length - 1]!

  let i = 1
  while (cumulativeM[i]! < distanceM) i++
  const start = points[i - 1]!
  const end = points[i]!
  const segmentM = cumulativeM[i]! - cumulativeM[i - 1]!
  const t = segmentM === 0 ? 0 : (distanceM - cumulativeM[i - 1]!) / segmentM
  // Linear interpolation is fine for segments of a few km.
  return {
    lat: start.lat + (end.lat - start.lat) * t,
    lng: start.lng + (end.lng - start.lng) * t,
  }
}
