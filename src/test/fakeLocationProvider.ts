import { act } from '@testing-library/react'
import { vi } from 'vitest'
import type { LatLng } from '../lib/geo/types'
import type {
  LocationErrorKind,
  LocationFix,
  LocationListener,
  LocationProvider,
} from '../services/location/types'

/** A LocationProvider you drive by hand from tests. */
export function createFakeProvider() {
  let listener: LocationListener | null = null
  const stop = vi.fn(() => {
    listener = null
  })
  const provider: LocationProvider = {
    kind: 'browser',
    start: vi.fn((next: LocationListener) => {
      listener = next
      return stop
    }),
  }

  return {
    provider,
    stop,
    get running() {
      return listener !== null
    },
    emit(point: LatLng, extra: Partial<LocationFix> = {}) {
      act(() => {
        listener?.onFix({
          ...point,
          accuracyM: 10,
          timestamp: Date.now(),
          speedMps: null,
          ...extra,
        })
      })
    },
    fail(kind: LocationErrorKind) {
      act(() => listener?.onError(kind))
    },
  }
}
