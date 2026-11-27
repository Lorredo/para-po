import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haversineM } from '../../lib/geo/distance'
import type { SimRoute } from './simRoutes'
import { createSimulatedProvider } from './simulatedProvider'
import type { LocationFix } from './types'

// A straight 1,000 m route due north, ridden at 10 m/s.
const START = { lat: 14.5, lng: 121.0 }
const END = { lat: 14.5 + 1000 / 111_195, lng: 121.0 }
const ROUTE: SimRoute = {
  id: 'test',
  name: 'Test route',
  speedMps: 10,
  points: [START, END],
  suggestedStop: { ...END, name: 'End' },
}

function ride(options: Parameters<typeof createSimulatedProvider>[1] = {}) {
  const provider = createSimulatedProvider(ROUTE, { jitterM: 0, ...options })
  const fixes: LocationFix[] = []
  const stop = provider.start({
    onFix: (fix) => fixes.push(fix),
    onError: () => {},
  })
  const travelled = () => haversineM(START, fixes[fixes.length - 1]!)
  return { provider, fixes, stop, travelled, sim: provider.controller }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createSimulatedProvider', () => {
  it('reports the start immediately, then moves once per second', () => {
    const { fixes, travelled } = ride()
    expect(fixes).toHaveLength(1)
    expect(travelled()).toBeCloseTo(0, 3)

    vi.advanceTimersByTime(1000)
    expect(fixes).toHaveLength(2)
    expect(travelled()).toBeCloseTo(10, 0)
    expect(fixes[1]).toMatchObject({ accuracyM: 8, speedMps: 10 })
  })

  it('speeds up with the playback rate', () => {
    const { travelled, sim } = ride({ rate: 10 })
    vi.advanceTimersByTime(3000)
    expect(travelled()).toBeCloseTo(300, 0)
    sim.setRate(50)
    vi.advanceTimersByTime(1000)
    expect(travelled()).toBeCloseTo(800, 0)
  })

  it('keeps reporting a still position while paused', () => {
    const { fixes, travelled, sim } = ride()
    vi.advanceTimersByTime(2000)
    sim.pause()
    vi.advanceTimersByTime(3000)
    expect(fixes).toHaveLength(6)
    expect(travelled()).toBeCloseTo(20, 0)
    expect(fixes[fixes.length - 1]?.speedMps).toBe(0)
  })

  it('jumps when seeking and reports the new spot right away', () => {
    const { fixes, travelled, sim } = ride()
    sim.seek(750)
    expect(fixes).toHaveLength(2)
    expect(travelled()).toBeCloseTo(750, 0)
    expect(sim.getState().progressM).toBe(750)
  })

  it('stops at the end of the route but keeps reporting', () => {
    const { fixes, travelled, sim } = ride({ rate: 50 })
    vi.advanceTimersByTime(5000)
    expect(travelled()).toBeCloseTo(1000, 0)
    expect(sim.getState().progressM).toBe(sim.getState().totalM)
    expect(fixes[fixes.length - 1]?.speedMps).toBe(0)
  })

  it('stops emitting when stopped', () => {
    const { fixes, stop, sim } = ride()
    stop()
    expect(sim.getState().running).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(fixes).toHaveLength(1)
  })

  it('adds GPS-like wobble within the jitter limit', () => {
    let n = 0
    const values = [0, 1, 0.5, 0.5]
    const { fixes } = ride({ jitterM: 5, random: () => values[n++ % 4]! })
    const offset = haversineM(START, fixes[0]!)
    expect(offset).toBeGreaterThan(0)
    expect(offset).toBeLessThanOrEqual(Math.SQRT2 * 5 + 0.01)
  })

  it('notifies subscribers on changes', () => {
    const { sim } = ride()
    const onChange = vi.fn()
    sim.subscribe(onChange)
    sim.pause()
    sim.setRate(10)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(sim.getState()).toMatchObject({ playing: false, rate: 10 })
  })

  it('ignores nonsense rates and seeks', () => {
    const { sim } = ride()
    sim.setRate(-3)
    expect(sim.getState().rate).toBe(1)
    sim.seek(Number.NaN)
    expect(sim.getState().progressM).toBe(0)
    sim.seek(99_999)
    expect(sim.getState().progressM).toBe(sim.getState().totalM)
  })
})
