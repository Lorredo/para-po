import type { LatLng } from '../../lib/geo/types'

/** One position reading, normalized from the browser or the simulator. */
export type LocationFix = LatLng & {
  /** Radius of 68% confidence, in meters. */
  accuracyM: number
  /** When the reading was taken (ms since epoch). */
  timestamp: number
  /** Meters per second, when known. */
  speedMps: number | null
}

/**
 * - `permission-denied`, `unsupported`, `insecure`: fatal, tracking stops.
 * - `unavailable`: no position right now (tunnel, covered station, GPS off).
 *   Browsers keep the watch running and recover on their own, so this is a
 *   warning, not fatal. Chromium also reports it briefly whenever the
 *   position source changes.
 * - `timeout`: no reading in time; the watch keeps trying. A warning.
 */
export type LocationErrorKind =
  'permission-denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure'

export type LocationWarningKind = Extract<
  LocationErrorKind,
  'timeout' | 'unavailable'
>
export type FatalLocationErrorKind = Exclude<
  LocationErrorKind,
  LocationWarningKind
>

export const NON_FATAL_ERRORS: ReadonlySet<LocationErrorKind> =
  new Set<LocationErrorKind>(['timeout', 'unavailable'])

export function isFatalLocationError(
  kind: LocationErrorKind,
): kind is FatalLocationErrorKind {
  return !NON_FATAL_ERRORS.has(kind)
}

export type LocationListener = {
  onFix(fix: LocationFix): void
  onError(kind: LocationErrorKind): void
}

/** Anything that can stream positions: real GPS or a simulated ride. */
export type LocationProvider = {
  readonly kind: 'browser' | 'simulated'
  /** Starts streaming. Returns a function that stops it. */
  start(listener: LocationListener): () => void
}
