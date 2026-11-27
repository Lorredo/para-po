import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS_M, haversineM, offsetM } from './distance'

const ONE_DEGREE_M = (Math.PI / 180) * EARTH_RADIUS_M // ≈ 111,195 m

describe('haversineM', () => {
  it('is zero for the same point', () => {
    expect(
      haversineM({ lat: 14.55, lng: 121.03 }, { lat: 14.55, lng: 121.03 }),
    ).toBe(0)
  })

  it('measures one degree along the equator and a meridian', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(
      ONE_DEGREE_M,
      3,
    )
    expect(
      haversineM({ lat: 14, lng: 121 }, { lat: 15, lng: 121 }),
    ).toBeCloseTo(ONE_DEGREE_M, 3)
  })

  it('is symmetric', () => {
    const ayala = { lat: 14.5492, lng: 121.0279 }
    const cubao = { lat: 14.6193, lng: 121.051 }
    expect(haversineM(ayala, cubao)).toBeCloseTo(haversineM(cubao, ayala), 9)
  })

  it('gives a sensible Ayala to Cubao distance', () => {
    const d = haversineM(
      { lat: 14.5492, lng: 121.0279 },
      { lat: 14.6193, lng: 121.051 },
    )
    expect(d).toBeGreaterThan(8000)
    expect(d).toBeLessThan(8500)
  })
})

describe('offsetM', () => {
  it('moves the expected distance', () => {
    const start = { lat: 14.55, lng: 121.03 }
    expect(haversineM(start, offsetM(start, 300, 0))).toBeCloseTo(300, 1)
    expect(haversineM(start, offsetM(start, 0, 300))).toBeCloseTo(300, 1)
    expect(haversineM(start, offsetM(start, 300, 400))).toBeCloseTo(500, 0)
  })
})
