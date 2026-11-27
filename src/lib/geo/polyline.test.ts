import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS_M } from './distance'
import { measurePolyline, pointAlong } from './polyline'

const ONE_DEGREE_M = (Math.PI / 180) * EARTH_RADIUS_M

const line = measurePolyline([
  { lat: 0, lng: 0 },
  { lat: 0, lng: 1 },
  { lat: 0, lng: 2 },
])

describe('measurePolyline', () => {
  it('adds up segment lengths', () => {
    expect(line.cumulativeM[1]).toBeCloseTo(ONE_DEGREE_M, 3)
    expect(line.totalM).toBeCloseTo(2 * ONE_DEGREE_M, 3)
  })

  it('handles a single point', () => {
    expect(measurePolyline([{ lat: 1, lng: 1 }]).totalM).toBe(0)
  })

  it('rejects an empty route', () => {
    expect(() => measurePolyline([])).toThrow()
  })
})

describe('pointAlong', () => {
  it('interpolates within and across segments', () => {
    expect(pointAlong(line, ONE_DEGREE_M / 2).lng).toBeCloseTo(0.5, 6)
    expect(pointAlong(line, ONE_DEGREE_M).lng).toBeCloseTo(1, 6)
    expect(pointAlong(line, 1.5 * ONE_DEGREE_M).lng).toBeCloseTo(1.5, 6)
  })

  it('clamps to the ends', () => {
    expect(pointAlong(line, -5)).toEqual({ lat: 0, lng: 0 })
    expect(pointAlong(line, Number.NaN)).toEqual({ lat: 0, lng: 0 })
    expect(pointAlong(line, 10 * ONE_DEGREE_M)).toEqual({ lat: 0, lng: 2 })
  })
})
