import { describe, expect, it } from 'vitest'
import { clampRadius, formatDistance, formatLatLng } from './format'

describe('formatDistance', () => {
  it.each([
    [0, '0 m'],
    [4, '0 m'],
    [5, '10 m'],
    [349, '350 m'],
    [994, '990 m'],
    [995, '1 km'],
    [1000, '1 km'],
    [1250, '1.3 km'],
    [2000, '2 km'],
    [9949, '9.9 km'],
    [9990, '10 km'],
    [10_000, '10 km'],
    [12_400, '12 km'],
  ])('%d m → %s', (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected)
  })

  it('returns a dash for invalid input', () => {
    expect(formatDistance(-1)).toBe('–')
    expect(formatDistance(Number.NaN)).toBe('–')
    expect(formatDistance(Number.POSITIVE_INFINITY)).toBe('–')
  })
})

describe('formatLatLng', () => {
  it('rounds to 4 decimals', () => {
    expect(formatLatLng({ lat: 14.579412, lng: 121.035948 })).toBe(
      '14.5794, 121.0359',
    )
  })
})

describe('clampRadius', () => {
  it('snaps to the step', () => {
    expect(clampRadius(321, 100, 2000, 50)).toBe(300)
    expect(clampRadius(326, 100, 2000, 50)).toBe(350)
  })

  it('keeps the value in range', () => {
    expect(clampRadius(10, 100, 2000, 50)).toBe(100)
    expect(clampRadius(5000, 100, 2000, 50)).toBe(2000)
  })

  it('falls back to the minimum for invalid input', () => {
    expect(clampRadius(Number.NaN, 100, 2000, 50)).toBe(100)
  })
})
