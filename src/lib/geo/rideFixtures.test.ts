import { describe, expect, it } from 'vitest'
import { parseRideLog, recordedEvents, replayRide } from './rideLog'

/**
 * Replays every real ride recorded with the app (tests/fixtures/rides).
 * See that folder's README for how to add one.
 */
const files = import.meta.glob('../../../tests/fixtures/rides/*.json', {
  eager: true,
  import: 'default',
})

type Expectation = { event: 'arrived' | 'passed'; maxDistanceM?: number }

const rides = Object.entries(files).map(([path, data]) => ({
  name: path.split('/').pop()!,
  log: parseRideLog(data),
  expect: (data as { expect?: Expectation }).expect,
}))

describe('recorded real rides', () => {
  if (rides.length === 0) {
    it.todo('no recorded rides yet: record one with the app and add it')
    return
  }

  describe.each(rides)('$name', ({ log, expect: wanted }) => {
    it("today's geofence makes the same decisions as on the ride", () => {
      expect(replayRide(log)).toEqual(recordedEvents(log))
    })

    if (wanted) {
      it(`rings (${wanted.event}) as expected`, () => {
        const first = replayRide(log).find(
          (e) => e.event === 'arrived' || e.event === 'passed',
        )
        expect(first?.event).toBe(wanted.event)
        if (wanted.maxDistanceM !== undefined) {
          expect(first!.distanceM).toBeLessThanOrEqual(wanted.maxDistanceM)
        }
      })
    }
  })
})
