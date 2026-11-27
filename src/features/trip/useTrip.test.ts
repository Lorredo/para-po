import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { offsetM } from '../../lib/geo/distance'
import type { LocationFix } from '../../services/location/types'
import type { ScreenWakeLock } from '../../services/wakeLock'
import { createFakeAudio } from '../../test/fakeAlarm'
import type { Destination } from './types'
import { GPS_WATCHDOG_MS, useTrip } from './useTrip'

const AYALA: Destination = { lat: 14.5492, lng: 121.0279, name: 'Ayala' }

function fakeWakeLock() {
  return {
    getStatus: () => 'off' as const,
    subscribe: () => () => {},
    request: vi.fn(async () => true),
    release: vi.fn(),
  } satisfies ScreenWakeLock
}

let clock = 0
/** A fresh reading `northM` meters north of Ayala. */
function reading(northM: number): LocationFix {
  // 10 s apart: the 100–400 m steps in these tests are then realistic speeds
  // (anything over 60 m/s is rejected as a GPS glitch).
  clock += 10_000
  return {
    ...offsetM(AYALA, northM, 0),
    accuracyM: 10,
    timestamp: Date.now() + clock,
    speedMps: 10,
  }
}

type Props = { fix: LocationFix | null; destination: Destination | null }

function setup(initial: Partial<Props> = {}) {
  const { audio } = createFakeAudio()
  const wakeLock = fakeWakeLock()
  const startLocation = vi.fn()
  const stopLocation = vi.fn()
  const onAlarm = vi.fn()
  const hook = renderHook(
    ({ fix, destination }: Props) =>
      useTrip({
        destination,
        radiusM: 300,
        fix,
        startLocation,
        stopLocation,
        audio,
        wakeLock,
        onAlarm,
      }),
    { initialProps: { fix: null, destination: AYALA, ...initial } },
  )
  const feed = (northM: number) =>
    hook.rerender({ fix: reading(northM), destination: AYALA })
  return {
    audio,
    wakeLock,
    startLocation,
    stopLocation,
    onAlarm,
    feed,
    ...hook,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-27T08:00:00+08:00'))
  clock = 0
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useTrip', () => {
  it('starts sound, screen wake lock and GPS in one tap', () => {
    const { result, audio, wakeLock, startLocation } = setup()
    expect(result.current.phase).toBe('planning')
    act(() => result.current.start())
    expect(result.current.phase).toBe('active')
    expect(audio.unlock).toHaveBeenCalled()
    expect(wakeLock.request).toHaveBeenCalled()
    expect(startLocation).toHaveBeenCalled()
  })

  it('cannot start without a stop', () => {
    const { result, startLocation } = setup({ destination: null })
    act(() => result.current.start())
    expect(result.current.phase).toBe('planning')
    expect(startLocation).not.toHaveBeenCalled()
  })

  it('rings when the geofence says you have arrived', () => {
    const { result, feed, onAlarm } = setup()
    act(() => result.current.start())
    for (const n of [900, 800, 700, 600, 500, 400]) feed(n)
    expect(onAlarm).not.toHaveBeenCalled()
    expect(result.current.result?.state.status).toBe('approaching')

    feed(290)
    expect(result.current.result?.state.status).toBe('entering')
    feed(280)
    expect(onAlarm).toHaveBeenCalledWith('arrived')
    expect(onAlarm).toHaveBeenCalledTimes(1)
  })

  it('ignores readings when no trip is running', () => {
    const { feed, onAlarm, result } = setup()
    feed(290)
    feed(280)
    expect(onAlarm).not.toHaveBeenCalled()
    expect(result.current.result).toBeNull()
  })

  it('does not count the reading that was on screen before the trip', () => {
    const before = reading(280)
    const { result, rerender, onAlarm } = setup({ fix: before })
    act(() => result.current.start())
    rerender({ fix: before, destination: AYALA })
    expect(result.current.result).toBeNull()
    expect(onAlarm).not.toHaveBeenCalled()
  })

  it('flags starting near the stop, and clears it once armed', () => {
    const { result, feed, onAlarm } = setup()
    act(() => result.current.start())
    feed(100)
    expect(result.current.startedNear).toBe(true)
    feed(500)
    expect(result.current.startedNear).toBe(false)
    feed(290)
    feed(280)
    expect(onAlarm).toHaveBeenCalledWith('arrived')
  })

  it('starts the geofence over when the stop moves mid-trip', () => {
    const { result, feed, rerender } = setup()
    act(() => result.current.start())
    feed(900)
    expect(result.current.result).not.toBeNull()
    rerender({
      fix: null,
      destination: { lat: 14.6, lng: 121.05 },
    })
    expect(result.current.result).toBeNull()
  })

  it('"I\'m getting off" finishes the trip and lets the screen sleep', () => {
    const { result, wakeLock, stopLocation } = setup()
    act(() => result.current.start())
    act(() => result.current.finish())
    expect(result.current.phase).toBe('ended')
    expect(wakeLock.release).toHaveBeenCalled()
    expect(stopLocation).toHaveBeenCalled()
    act(() => result.current.dismiss())
    expect(result.current.phase).toBe('planning')
  })

  it('"End trip" goes straight back to planning', () => {
    const { result, wakeLock, stopLocation } = setup()
    act(() => result.current.start())
    act(() => result.current.end())
    expect(result.current.phase).toBe('planning')
    expect(wakeLock.release).toHaveBeenCalled()
    expect(stopLocation).toHaveBeenCalled()
  })

  it('reports whether the trip is still on (for snooze)', () => {
    const { result } = setup()
    expect(result.current.isActive()).toBe(false)
    act(() => result.current.start())
    expect(result.current.isActive()).toBe(true)
    act(() => result.current.end())
    expect(result.current.isActive()).toBe(false)
  })

  it('warns when GPS goes quiet for 30 s, and clears on the next reading', () => {
    const { result, feed } = setup()
    act(() => result.current.start())
    feed(900)
    act(() => vi.advanceTimersByTime(GPS_WATCHDOG_MS - 5000))
    expect(result.current.gpsStale).toBe(false)
    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current.gpsStale).toBe(true)
    feed(890)
    expect(result.current.gpsStale).toBe(false)
  })

  it('releases the wake lock if the app goes away mid-trip', () => {
    const { result, wakeLock, unmount } = setup()
    act(() => result.current.start())
    unmount()
    expect(wakeLock.release).toHaveBeenCalled()
  })
})
