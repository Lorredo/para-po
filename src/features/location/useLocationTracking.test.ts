import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LocationProvider } from '../../services/location/types'
import { createFakeProvider } from '../../test/fakeLocationProvider'
import { useLocationTracking } from './useLocationTracking'

const AYALA = { lat: 14.5492, lng: 121.0279 }

describe('useLocationTracking', () => {
  it('starts off and does nothing until started', () => {
    const fake = createFakeProvider()
    const { result } = renderHook(() => useLocationTracking(fake.provider))
    expect(result.current.status).toBe('off')
    expect(fake.provider.start).not.toHaveBeenCalled()
  })

  it('goes locating → tracking as fixes arrive', () => {
    const fake = createFakeProvider()
    const { result } = renderHook(() => useLocationTracking(fake.provider))

    act(() => result.current.start())
    expect(result.current.status).toBe('locating')

    fake.emit(AYALA, { accuracyM: 15 })
    expect(result.current.status).toBe('tracking')
    expect(result.current.fix).toMatchObject({ ...AYALA, accuracyM: 15 })
  })

  it('ignores a second start while running', () => {
    const fake = createFakeProvider()
    const { result } = renderHook(() => useLocationTracking(fake.provider))
    act(() => result.current.start())
    act(() => result.current.start())
    expect(fake.provider.start).toHaveBeenCalledTimes(1)
  })

  it('treats a timeout as a warning and clears it on the next fix', () => {
    const fake = createFakeProvider()
    const { result } = renderHook(() => useLocationTracking(fake.provider))
    act(() => result.current.start())
    fake.emit(AYALA)

    fake.fail('timeout')
    expect(result.current.status).toBe('tracking')
    expect(result.current.error).toBe('timeout')
    expect(fake.running).toBe(true)

    fake.emit(AYALA)
    expect(result.current.error).toBeNull()
  })

  it('keeps tracking through a lost signal (tunnels) and keeps the last fix', () => {
    const fake = createFakeProvider()
    const { result } = renderHook(() => useLocationTracking(fake.provider))
    act(() => result.current.start())
    fake.emit(AYALA)

    fake.fail('unavailable')
    expect(result.current.status).toBe('tracking')
    expect(result.current.error).toBe('unavailable')
    expect(result.current.fix).toMatchObject(AYALA)
    expect(fake.running).toBe(true)

    fake.emit({ lat: 14.55, lng: 121.03 })
    expect(result.current.error).toBeNull()
    expect(result.current.fix).toMatchObject({ lat: 14.55, lng: 121.03 })
  })

  it('stops the provider on a fatal error', () => {
    const fake = createFakeProvider()
    const { result } = renderHook(() => useLocationTracking(fake.provider))
    act(() => result.current.start())
    fake.emit(AYALA)

    fake.fail('permission-denied')
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('permission-denied')
    expect(result.current.fix).toBeNull()
    expect(fake.stop).toHaveBeenCalled()
  })

  it('handles errors reported before start() returns', () => {
    let stopped = false
    const provider: LocationProvider = {
      kind: 'browser',
      start(listener) {
        listener.onError('insecure')
        return () => {
          stopped = true
        }
      },
    }
    const { result } = renderHook(() => useLocationTracking(provider))
    act(() => result.current.start())
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('insecure')
    expect(stopped).toBe(true)

    // It can be started again afterwards.
    act(() => result.current.stop())
    expect(result.current.status).toBe('off')
  })

  it('stops and resets on stop() and on unmount', () => {
    const fake = createFakeProvider()
    const { result, unmount } = renderHook(() =>
      useLocationTracking(fake.provider),
    )
    act(() => result.current.start())
    fake.emit(AYALA)
    act(() => result.current.stop())
    expect(result.current).toMatchObject({ status: 'off', fix: null })
    expect(fake.stop).toHaveBeenCalledTimes(1)

    act(() => result.current.start())
    unmount()
    expect(fake.stop).toHaveBeenCalledTimes(2)
  })
})
