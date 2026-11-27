import { describe, expect, it } from 'vitest'
import { haversineM, offsetM } from './distance'
import {
  evaluateGeofence,
  type GeofenceConfig,
  type GeofenceEvent,
  type GeofenceFix,
  INITIAL_GEOFENCE_STATE,
  type GeofenceResult,
} from './geofence'
import { measurePolyline, pointAlong } from './polyline'
import type { LatLng } from './types'

const STOP: LatLng = { lat: 14.5492, lng: 121.0279 } // Ayala
const T0 = 1_764_000_000_000
const CONFIG: GeofenceConfig = { radiusM: 300 }

/** A point `northM` / `eastM` meters from the stop. */
const at = (northM: number, eastM = 0) => offsetM(STOP, northM, eastM)

type Reading = { northM: number; eastM?: number; accuracyM?: number }

/**
 * Feeds readings one per `intervalS` through the geofence, like a phone would,
 * and returns every result. Readings are "fresh" (now = their timestamp).
 */
function run(
  readings: Reading[],
  {
    config = CONFIG,
    intervalS = 1,
  }: { config?: GeofenceConfig; intervalS?: number } = {},
): GeofenceResult[] {
  let state = INITIAL_GEOFENCE_STATE
  return readings.map((reading, i) => {
    const fix: GeofenceFix = {
      ...at(reading.northM, reading.eastM ?? 0),
      accuracyM: reading.accuracyM ?? 10,
      timestamp: T0 + i * intervalS * 1000,
    }
    const result = evaluateGeofence(state, fix, STOP, config, fix.timestamp)
    state = result.state
    return result
  })
}

const events = (results: GeofenceResult[]) =>
  results.flatMap((r, i) => (r.event ? [{ i, event: r.event }] : []))

/** Deterministic pseudo-random numbers in [-1, 1) so failures can be replayed. */
function noise(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
}

/** Readings along a straight north→south line that passes `offsetEastM` from the stop. */
function straightRide({
  fromNorthM,
  toNorthM,
  stepM,
  offsetEastM = 0,
  accuracyM = 10,
  jitterM = 0,
  seed = 1,
}: {
  fromNorthM: number
  toNorthM: number
  stepM: number
  offsetEastM?: number
  accuracyM?: number
  jitterM?: number
  seed?: number
}): Reading[] {
  const rand = noise(seed)
  const readings: Reading[] = []
  for (let n = fromNorthM; n >= toNorthM; n -= stepM) {
    readings.push({
      northM: n + rand() * jitterM,
      eastM: offsetEastM + rand() * jitterM,
      accuracyM,
    })
  }
  return readings
}

describe('evaluateGeofence', () => {
  describe('normal approach', () => {
    it('arrives on the second reading inside the radius, once', () => {
      // 10 m/s towards the stop from 1 km out, one reading per second.
      const results = run(
        straightRide({ fromNorthM: 1005, toNorthM: -200, stepM: 10 }),
      )
      const fired = events(results)

      expect(fired).toEqual([{ i: 72, event: 'arrived' }])
      expect(results[70]!.state.status).toBe('approaching') // 305 m
      expect(results[71]!.state.status).toBe('entering') // 295 m: first inside
      expect(results[72]!.distanceM).toBeCloseTo(285, 0)
      expect(results[72]!.state.status).toBe('arrived')
    })

    it('reports distance and status while approaching', () => {
      const [first, second] = run([{ northM: 2000 }, { northM: 1990 }])
      expect(first!.accepted).toBe(true)
      expect(first!.distanceM).toBeCloseTo(2000, 0)
      expect(first!.state.status).toBe('approaching')
      expect(second!.distanceM).toBeCloseTo(1990, 0)
      expect(second!.event).toBeUndefined()
    })

    it('stays quiet after ringing', () => {
      const results = run(
        [
          { northM: 900 },
          { northM: 250 },
          { northM: 200 }, // arrived
          { northM: 150 },
          { northM: -400 },
          { northM: -900 },
        ],
        { intervalS: 30 }, // realistic gaps, so none of these look like glitches
      )
      expect(events(results)).toEqual([{ i: 2, event: 'arrived' }])
      expect(results.at(-1)!.state.status).toBe('arrived')
      expect(results.at(-1)!.accepted).toBe(true)
    })

    it('arrives with realistic GPS noise', () => {
      for (let seed = 1; seed <= 25; seed++) {
        const fired = events(
          run(
            straightRide({
              fromNorthM: 1500,
              toNorthM: -300,
              stepM: 11,
              accuracyM: 20,
              jitterM: 20,
              seed,
            }),
          ),
        )
        expect(fired, `seed ${seed}`).toHaveLength(1)
        expect(fired[0]!.event, `seed ${seed}`).toBe('arrived')
      }
    })
  })

  describe('false-alarm protection', () => {
    it('ignores a GPS glitch that jumps into the radius', () => {
      const results = run([
        { northM: 900 },
        { northM: 890 },
        { northM: 50 }, // 840 m in one second: impossible
        { northM: 870 },
        { northM: 860 },
      ])
      expect(events(results)).toEqual([])
      expect(results[2]).toMatchObject({
        accepted: false,
        rejectReason: 'jump',
      })
      expect(results[3]!.state.status).toBe('approaching')
    })

    it('a glitch cannot set up a false "passed" alarm later', () => {
      // Glitch near the stop, then traffic jitter far away that looks like
      // moving away. Without the jump filter this would ring "passed".
      const results = run([
        { northM: 900 },
        { northM: 50 },
        { northM: 870 },
        { northM: 880 },
        { northM: 895 },
        { northM: 910 },
      ])
      expect(events(results)).toEqual([])
    })

    it('recovers when the bad reading was the one it trusted', () => {
      // The very first reading is way off (50 km). The next real reading looks
      // like a jump from it; on the second jump in a row it trusts the new
      // readings and starts fresh from there.
      const approach = straightRide({ fromNorthM: 905, toNorthM: 0, stepM: 10 })
      const results = run([{ northM: 50_000 }, ...approach])
      expect(results[1]).toMatchObject({
        accepted: false,
        rejectReason: 'jump',
      })
      expect(results[2]!.accepted).toBe(true)
      expect(events(results).map((e) => e.event)).toEqual(['arrived'])
    })

    it('still accepts fast but possible movement', () => {
      // 1,200 m in 30 s is 40 m/s: a fast train, not a glitch.
      const results = run([{ northM: 2000 }, { northM: 800 }], {
        intervalS: 30,
      })
      expect(results[1]!.accepted).toBe(true)
    })

    it('needs two readings in a row inside, not two in total', () => {
      const results = run([
        { northM: 400 },
        { northM: 290 }, // in
        { northM: 310 }, // out
        { northM: 295 }, // in
        { northM: 305 }, // out
      ])
      expect(events(results).filter((e) => e.event === 'arrived')).toEqual([])
    })

    it('never rings for a road passing well outside the radius', () => {
      for (let seed = 1; seed <= 25; seed++) {
        const results = run(
          straightRide({
            fromNorthM: 2000,
            toNorthM: -2000,
            stepM: 11,
            offsetEastM: 450, // closest approach 450 m; radius 300 m
            accuracyM: 20,
            jitterM: 20,
            seed,
          }),
        )
        expect(events(results), `seed ${seed}`).toEqual([])
      }
    })

    it('never rings while standing still far away', () => {
      const readings = Array.from({ length: 120 }, (_, i) => ({
        northM: 800 + (i % 2 === 0 ? 25 : -25),
        accuracyM: 30,
      }))
      expect(events(run(readings))).toEqual([])
    })
  })

  describe('rejected readings', () => {
    it('ignores readings that are too inaccurate', () => {
      const results = run([
        { northM: 900 },
        { northM: 100, accuracyM: 200 },
        { northM: 90, accuracyM: 500 },
        { northM: 880 },
      ])
      expect(events(results)).toEqual([])
      expect(results[1]).toMatchObject({
        accepted: false,
        rejectReason: 'inaccurate',
      })
      // Distance is still reported, so the UI can show it with a warning.
      expect(results[1]!.distanceM).toBeCloseTo(100, 0)
      // Rejected readings leave the state untouched.
      expect(results[2]!.state).toBe(results[0]!.state)
    })

    it('rejects a missing or invalid accuracy', () => {
      const fix = { ...at(100), accuracyM: Number.NaN, timestamp: T0 }
      expect(
        evaluateGeofence(INITIAL_GEOFENCE_STATE, fix, STOP, CONFIG, T0),
      ).toMatchObject({ accepted: false, rejectReason: 'inaccurate' })
    })

    it('ignores stale readings', () => {
      const fix = { ...at(100), accuracyM: 10, timestamp: T0 }
      const result = evaluateGeofence(
        INITIAL_GEOFENCE_STATE,
        fix,
        STOP,
        CONFIG,
        T0 + 16_000,
      )
      expect(result).toMatchObject({ accepted: false, rejectReason: 'stale' })
      expect(result.state).toBe(INITIAL_GEOFENCE_STATE)
    })

    it('ignores readings older than the last one used', () => {
      const first = evaluateGeofence(
        INITIAL_GEOFENCE_STATE,
        { ...at(900), accuracyM: 10, timestamp: T0 + 5000 },
        STOP,
        CONFIG,
        T0 + 5000,
      )
      const late = evaluateGeofence(
        first.state,
        { ...at(100), accuracyM: 10, timestamp: T0 + 4000 },
        STOP,
        CONFIG,
        T0 + 6000,
      )
      expect(late).toMatchObject({
        accepted: false,
        rejectReason: 'out-of-order',
      })
    })

    it('honours custom limits', () => {
      const strict: GeofenceConfig = {
        radiusM: 300,
        maxAccuracyM: 25,
        maxFixAgeMs: 2000,
      }
      const fix = { ...at(900), accuracyM: 30, timestamp: T0 }
      expect(
        evaluateGeofence(INITIAL_GEOFENCE_STATE, fix, STOP, strict, T0)
          .rejectReason,
      ).toBe('inaccurate')
      expect(
        evaluateGeofence(
          INITIAL_GEOFENCE_STATE,
          { ...fix, accuracyM: 10 },
          STOP,
          strict,
          T0 + 2500,
        ).rejectReason,
      ).toBe('stale')
    })
  })

  describe('passing the stop without a confirmed arrival', () => {
    it('catches a fast train that skips the radius between readings', () => {
      // 25 m/s with a reading every 30 s (tunnels, covered stations): 750 m jumps.
      // No reading ever lands inside the 300 m radius.
      const results = run(
        [
          { northM: 2350 },
          { northM: 1600 },
          { northM: 850 },
          { northM: 100 - 450 },
          { northM: -1100 },
          { northM: -1850 },
        ],
        { intervalS: 30 },
      )
      expect(results.every((r) => r.distanceM > 300)).toBe(true)
      expect(events(results)).toEqual([{ i: 4, event: 'passed' }])
      expect(results[4]!.state.status).toBe('passed')
    })

    it('catches a road that only grazes the edge of the radius', () => {
      // Closest approach 320 m with ±30 m accuracy: close enough to count.
      const results = run(
        straightRide({
          fromNorthM: 1000,
          toNorthM: -1000,
          stepM: 15,
          offsetEastM: 320,
          accuracyM: 30,
        }),
      )
      const fired = events(results)
      expect(fired).toHaveLength(1)
      expect(fired[0]!.event).toBe('passed')
      // It rings soon after the closest point, not at the end of the ride.
      expect(results[fired[0]!.i]!.distanceM).toBeLessThan(400)
    })

    it('a radius change mid-ride takes effect immediately', () => {
      let state = INITIAL_GEOFENCE_STATE
      const feed = (northM: number, radiusM: number, i: number) => {
        // 30 s apart, so the 1.1 km between the first two isn't a "jump".
        const fix = { ...at(northM), accuracyM: 10, timestamp: T0 + i * 30_000 }
        const result = evaluateGeofence(
          state,
          fix,
          STOP,
          { radiusM },
          fix.timestamp,
        )
        state = result.state
        return result
      }
      feed(2000, 300, 0)
      expect(feed(900, 1000, 1).event).toBeUndefined() // first inside the new 1 km radius
      expect(feed(890, 1000, 2).event).toBe('arrived')
    })
  })

  describe('starting near the stop', () => {
    it('flags starting inside the radius and holds the alarm', () => {
      const results = run([{ northM: 100 }, { northM: 90 }, { northM: 80 }])
      expect(events(results)).toEqual([{ i: 0, event: 'started-near' }])
      expect(results.at(-1)!.state.status).toBe('started-near')
    })

    it('treats "just outside, within GPS error" as starting near', () => {
      const results = run([{ northM: 320, accuracyM: 30 }])
      expect(events(results)).toEqual([{ i: 0, event: 'started-near' }])
    })

    it('does not ring when moving away from a stop you started near', () => {
      const away = Array.from({ length: 120 }, (_, i) => ({
        northM: 320 + i * 15,
        accuracyM: 30,
      }))
      expect(events(run(away))).toEqual([{ i: 0, event: 'started-near' }])
    })

    it('arms once you have moved away, then rings on the way back', () => {
      const out = straightRide({
        fromNorthM: 0,
        toNorthM: -800,
        stepM: 20,
      }).map((r) => ({
        northM: -r.northM,
      }))
      const back = straightRide({ fromNorthM: 800, toNorthM: 0, stepM: 20 })
      const results = run([...out, ...back])
      const fired = events(results)
      expect(fired.map((e) => e.event)).toEqual(['started-near', 'arrived'])
      expect(fired[1]!.i).toBeGreaterThan(out.length)
    })
  })

  describe('never stays silent (sweep)', () => {
    // Every combination must ring ("arrived" or "passed") on a ride straight
    // through the stop, however fast the ride and however sparse the readings.
    const speedsMps = [3, 11, 20, 30]
    const intervalsS = [1, 5, 15, 30]
    const radii = [100, 300, 1000]

    for (const speed of speedsMps) {
      for (const interval of intervalsS) {
        for (const radiusM of radii) {
          const stepM = speed * interval
          it(`${speed} m/s, a reading every ${interval} s, ${radiusM} m radius`, () => {
            const fired = events(
              run(
                straightRide({
                  fromNorthM: radiusM + 3000,
                  toNorthM: -(radiusM + 3000),
                  stepM,
                  accuracyM: 15,
                  jitterM: 10,
                  seed: speed * 1000 + interval * 10 + radiusM,
                }),
                { config: { radiusM }, intervalS: interval },
              ),
            )
            expect(fired).toHaveLength(1)
            expect<GeofenceEvent[]>(['arrived', 'passed']).toContain(
              fired[0]!.event,
            )
          })
        }
      }
    }
  })

  describe('on the EDSA demo route', () => {
    const edsa = measurePolyline([
      { lat: 14.6522, lng: 121.0323 },
      { lat: 14.6427, lng: 121.0387 },
      { lat: 14.6352, lng: 121.0433 },
      { lat: 14.6195, lng: 121.0511 },
      { lat: 14.6077, lng: 121.0565 },
      { lat: 14.5878, lng: 121.0567 },
      { lat: 14.5812, lng: 121.0536 },
      { lat: 14.5737, lng: 121.0482 },
      { lat: 14.5668, lng: 121.0456 },
      { lat: 14.5543, lng: 121.0345 },
      { lat: 14.5492, lng: 121.0279 },
      { lat: 14.542, lng: 121.0195 },
    ])

    it('rings for Ayala just before reaching it', () => {
      let state = INITIAL_GEOFENCE_STATE
      let rangAt: number | null = null
      for (let s = 0, i = 0; s <= edsa.totalM; s += 11, i++) {
        const fix = {
          ...pointAlong(edsa, s),
          accuracyM: 8,
          timestamp: T0 + i * 1000,
        }
        const result = evaluateGeofence(state, fix, STOP, CONFIG, fix.timestamp)
        state = result.state
        if (result.event === 'arrived') {
          rangAt = haversineM(fix, STOP)
          break
        }
      }
      expect(rangAt).not.toBeNull()
      expect(rangAt!).toBeLessThanOrEqual(300)
      expect(rangAt!).toBeGreaterThan(270) // about one reading after entering
    })
  })
})
