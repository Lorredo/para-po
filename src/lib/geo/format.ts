import type { LatLng } from './types'

/**
 * Human-friendly distance for commuters.
 * Under 1 km: nearest 10 m ("350 m"). Under 10 km: one decimal, dropping a
 * trailing ".0" ("1.2 km", "2 km"). Beyond that: whole km ("12 km").
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '–'
  if (meters < 1000) {
    const rounded = Math.round(meters / 10) * 10
    // 995 m rounds up to 1000 m; show it as km instead.
    if (rounded < 1000) return `${rounded} m`
  }
  const km = meters / 1000
  // "1.5 km", but "2 km" rather than "2.0 km".
  if (km < 10) return `${km.toFixed(1).replace(/\.0$/, '')} km`
  return `${Math.round(km)} km`
}

/** Coordinates to 4 decimals (about 11 m), e.g. "14.5794, 121.0359". */
export function formatLatLng({ lat, lng }: LatLng): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

/** Keep a radius inside the allowed range and snapped to the slider step. */
export function clampRadius(
  meters: number,
  min: number,
  max: number,
  step: number,
): number {
  if (!Number.isFinite(meters)) return min
  const snapped = Math.round(meters / step) * step
  return Math.min(max, Math.max(min, snapped))
}
