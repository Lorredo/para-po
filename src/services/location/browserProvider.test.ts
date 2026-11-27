import { describe, expect, it, vi } from 'vitest'
import { createBrowserProvider, WATCH_OPTIONS } from './browserProvider'
import type { LocationErrorKind, LocationFix } from './types'

function fakeGeolocation() {
  let onSuccess: PositionCallback = () => {}
  let onError: PositionErrorCallback = () => {}
  const geolocation = {
    watchPosition: vi.fn(
      (success: PositionCallback, error?: PositionErrorCallback | null) => {
        onSuccess = success
        onError = error ?? (() => {})
        return 42
      },
    ),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  }
  return {
    geolocation: geolocation as unknown as Geolocation,
    mocks: geolocation,
    emit(lat: number, lng: number, accuracy = 10, speed: number | null = null) {
      onSuccess({
        coords: { latitude: lat, longitude: lng, accuracy, speed },
        timestamp: 1_700_000_000_000,
      } as GeolocationPosition)
    },
    fail(code: number) {
      onError({ code } as GeolocationPositionError)
    },
  }
}

function collect() {
  const fixes: LocationFix[] = []
  const errors: LocationErrorKind[] = []
  return {
    fixes,
    errors,
    listener: {
      onFix: (fix: LocationFix) => fixes.push(fix),
      onError: (kind: LocationErrorKind) => errors.push(kind),
    },
  }
}

describe('createBrowserProvider', () => {
  it('watches with high accuracy and normalizes fixes', () => {
    const geo = fakeGeolocation()
    const out = collect()
    createBrowserProvider({
      geolocation: geo.geolocation,
      isSecureContext: true,
    }).start(out.listener)

    expect(geo.mocks.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      WATCH_OPTIONS,
    )
    geo.emit(14.55, 121.03, 12, 8.5)
    expect(out.fixes).toEqual([
      {
        lat: 14.55,
        lng: 121.03,
        accuracyM: 12,
        timestamp: 1_700_000_000_000,
        speedMps: 8.5,
      },
    ])
  })

  it('treats missing speed as unknown', () => {
    const geo = fakeGeolocation()
    const out = collect()
    createBrowserProvider({ geolocation: geo.geolocation }).start(out.listener)
    geo.emit(14.55, 121.03, 12, null)
    expect(out.fixes[0]?.speedMps).toBeNull()
  })

  it.each([
    [1, 'permission-denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('maps error code %d to %s', (code, kind) => {
    const geo = fakeGeolocation()
    const out = collect()
    createBrowserProvider({ geolocation: geo.geolocation }).start(out.listener)
    geo.fail(code)
    expect(out.errors).toEqual([kind])
  })

  it('stops watching and ignores late callbacks', () => {
    const geo = fakeGeolocation()
    const out = collect()
    const stop = createBrowserProvider({ geolocation: geo.geolocation }).start(
      out.listener,
    )
    stop()
    expect(geo.mocks.clearWatch).toHaveBeenCalledWith(42)
    geo.emit(14.55, 121.03)
    geo.fail(2)
    expect(out.fixes).toEqual([])
    expect(out.errors).toEqual([])
  })

  it('refuses on insecure pages', () => {
    const geo = fakeGeolocation()
    const out = collect()
    createBrowserProvider({
      geolocation: geo.geolocation,
      isSecureContext: false,
    }).start(out.listener)
    expect(out.errors).toEqual(['insecure'])
    expect(geo.mocks.watchPosition).not.toHaveBeenCalled()
  })

  it('reports browsers without geolocation', () => {
    const out = collect()
    createBrowserProvider({
      geolocation: undefined,
      isSecureContext: true,
    }).start(out.listener)
    expect(out.errors).toEqual(['unsupported'])
  })
})
