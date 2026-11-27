import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { copy } from '../../content/copy'
import {
  INITIAL_ANNOUNCER,
  nextAnnouncement,
  useDistanceAnnouncer,
} from './announcements'

/** Feeds distances through and collects what would be announced. */
function announce(distances: number[], radiusM = 300) {
  let state = INITIAL_ANNOUNCER
  return distances.flatMap((d, i) => {
    const result = nextAnnouncement(state, d, radiusM, i === 0)
    state = result.state
    return result.message ? [result.message] : []
  })
}

describe('nextAnnouncement', () => {
  it('announces each milestone once on the way in, then entering', () => {
    expect(
      announce([3000, 2500, 1990, 1500, 990, 700, 480, 400, 290, 250]),
    ).toEqual([
      '2 km to your stop',
      '1 km to your stop',
      '500 m to your stop',
      copy.announce.entering,
    ])
  })

  it('says nothing on the first reading, and skips milestones already behind', () => {
    expect(announce([1400, 1200, 900])).toEqual(['1 km to your stop'])
  })

  it('announces only the nearest milestone when a reading skips several', () => {
    expect(announce([2500, 450])).toEqual(['500 m to your stop'])
  })

  it('does not repeat after GPS jitter back out', () => {
    expect(announce([1200, 990, 1010, 980])).toEqual(['1 km to your stop'])
  })

  it('skips milestones inside a big radius', () => {
    expect(announce([3000, 1900, 1400, 900], 1000)).toEqual([
      '2 km to your stop',
      copy.announce.entering,
    ])
  })

  it('does not announce "entering" when the trip starts inside', () => {
    expect(announce([200, 150])).toEqual([])
  })
})

describe('useDistanceAnnouncer', () => {
  it('announces during a trip and resets when it ends', () => {
    const { result, rerender } = renderHook(
      ({ d, active }: { d: number | null; active: boolean }) =>
        useDistanceAnnouncer(d, 300, active),
      { initialProps: { d: 1200, active: true } },
    )
    expect(result.current).toBe('')
    rerender({ d: 950, active: true })
    expect(result.current).toBe('1 km to your stop')
    rerender({ d: 950, active: false })
    expect(result.current).toBe('')
  })

  it('stays quiet without a trip', () => {
    const { result, rerender } = renderHook(
      ({ d }: { d: number | null }) => useDistanceAnnouncer(d, 300, false),
      { initialProps: { d: 1200 } },
    )
    rerender({ d: 400 })
    expect(result.current).toBe('')
  })
})
