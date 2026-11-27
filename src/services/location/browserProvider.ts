import type { LocationErrorKind, LocationFix, LocationProvider } from './types'

export type BrowserProviderOptions = {
  geolocation?: Geolocation | undefined
  isSecureContext?: boolean | undefined
}

/**
 * Real GPS via `navigator.geolocation.watchPosition`.
 *
 * - High accuracy: we need GPS, not Wi-Fi or cell-tower estimates.
 * - maximumAge 5 s: accept a slightly cached reading so the first fix is quick.
 * - timeout 20 s: report a weak signal, but the watch keeps trying.
 */
export const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 20_000,
}

export function createBrowserProvider({
  geolocation = globalThis.navigator?.geolocation,
  isSecureContext = globalThis.isSecureContext,
}: BrowserProviderOptions = {}): LocationProvider {
  return {
    kind: 'browser',
    start(listener) {
      // `undefined` means the environment doesn't say; assume it's fine.
      if (isSecureContext === false) {
        listener.onError('insecure')
        return () => {}
      }
      if (!geolocation) {
        listener.onError('unsupported')
        return () => {}
      }

      let stopped = false
      const watchId = geolocation.watchPosition(
        (position) => {
          if (!stopped) listener.onFix(toFix(position))
        },
        (error) => {
          if (!stopped) listener.onError(toErrorKind(error))
        },
        WATCH_OPTIONS,
      )

      return () => {
        stopped = true
        geolocation.clearWatch(watchId)
      }
    },
  }
}

function toFix(position: GeolocationPosition): LocationFix {
  const { latitude, longitude, accuracy, speed } = position.coords
  return {
    lat: latitude,
    lng: longitude,
    accuracyM: accuracy,
    timestamp: position.timestamp,
    speedMps:
      typeof speed === 'number' && Number.isFinite(speed) ? speed : null,
  }
}

function toErrorKind(error: GeolocationPositionError): LocationErrorKind {
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return 'permission-denied'
    case 3: // TIMEOUT
      return 'timeout'
    default: // 2: POSITION_UNAVAILABLE
      return 'unavailable'
  }
}
