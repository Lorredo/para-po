import { describe, expect, it } from 'vitest'
import { offsetM } from './distance'
import { closestApproachM } from './segment'

const STOP = { lat: 14.5492, lng: 121.0279 } // Ayala
const at = (northM: number, eastM: number) => offsetM(STOP, northM, eastM)

describe('closestApproachM', () => {
  it('finds the closest point inside a segment that passes the stop', () => {
    // Travelling west to east, passing 120 m north of the stop.
    expect(closestApproachM(STOP, at(120, -500), at(120, 500))).toBeCloseTo(
      120,
      0,
    )
  })

  it('is ~0 when the segment runs straight through the stop', () => {
    expect(closestApproachM(STOP, at(500, 0), at(-350, 0))).toBeLessThan(0.5)
  })

  it('uses the nearer end when the closest point is outside the segment', () => {
    // Heading straight at the stop but still 400 m away.
    expect(closestApproachM(STOP, at(900, 0), at(400, 0))).toBeCloseTo(400, 0)
    // Heading straight away from it.
    expect(closestApproachM(STOP, at(400, 0), at(900, 0))).toBeCloseTo(400, 0)
  })

  it('handles a zero-length segment (standing still)', () => {
    expect(closestApproachM(STOP, at(300, 400), at(300, 400))).toBeCloseTo(
      500,
      0,
    )
  })
})
