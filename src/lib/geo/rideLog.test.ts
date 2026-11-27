import { describe, expect, it } from 'vitest'
import { offsetM } from './distance'
import { evaluateGeofence, INITIAL_GEOFENCE_STATE } from './geofence'
import {
  createRideLog,
  parseRideLog,
  RIDE_LOG_FORMAT,
  type RideLog,
  RideLogError,
  recordedEvents,
  replayRide,
} from './rideLog'

const STOP = { lat: 14.5492, lng: 121.0279, name: 'Ayala' }
const T0 = 1_764_000_000_000

/** Records a straight ride towards the stop, the way the app would. */
function recordRide(northSteps: number[], radiusM = 300) {
  let clock = T0
  const recorder = createRideLog({
    destination: STOP,
    radiusM,
    now: () => clock,
  })
  recorder.event('start')
  let state = INITIAL_GEOFENCE_STATE
  for (const northM of northSteps) {
    clock += 10_000
    const fix = {
      ...offsetM(STOP, northM, 0),
      accuracyM: 12.34,
      timestamp: clock,
      speedMps: 10,
    }
    const result = evaluateGeofence(state, fix, STOP, { radiusM }, clock)
    state = result.state
    recorder.reading(fix, result)
    if (result.event === 'arrived') recorder.event('alarm', 'arrived')
  }
  recorder.event('getting-off')
  return recorder.snapshot()
}

describe('createRideLog', () => {
  it('records readings with the geofence decision, and events', () => {
    const log = recordRide([900, 800, 290, 280])
    expect(log).toMatchObject({
      format: RIDE_LOG_FORMAT,
      version: 1,
      recordedAt: new Date(T0).toISOString(),
      destination: STOP,
      radiusM: 300,
    })
    expect(log.readings).toHaveLength(4)
    expect(log.readings[0]).toMatchObject({
      accuracyM: 12.3,
      accepted: true,
      status: 'approaching',
      speedMps: 10,
    })
    expect(log.readings[3]).toMatchObject({
      event: 'arrived',
      status: 'arrived',
    })
    expect(log.events.map((e) => e.type)).toEqual([
      'start',
      'alarm',
      'getting-off',
    ])
    expect(log.events[1]).toMatchObject({ detail: 'arrived' })
  })

  it('rounds coordinates to 6 decimals', () => {
    const log = recordRide([900])
    const decimals = String(log.readings[0]!.lat).split('.')[1] ?? ''
    expect(decimals.length).toBeLessThanOrEqual(6)
  })

  it('records rejected readings and why', () => {
    let clock = T0
    const recorder = createRideLog({
      destination: { lat: STOP.lat, lng: STOP.lng },
      radiusM: 300,
      now: () => clock,
    })
    const fix = {
      ...offsetM(STOP, 500, 0),
      accuracyM: 400,
      timestamp: clock,
      speedMps: null,
    }
    recorder.reading(
      fix,
      evaluateGeofence(
        INITIAL_GEOFENCE_STATE,
        fix,
        STOP,
        { radiusM: 300 },
        clock,
      ),
    )
    clock += 1
    const log = recorder.snapshot()
    expect(log.destination).toEqual({ lat: STOP.lat, lng: STOP.lng })
    expect(log.readings[0]).toMatchObject({
      accepted: false,
      rejectReason: 'inaccurate',
      speedMps: null,
    })
  })

  it('snapshots are independent copies', () => {
    const recorder = createRideLog({ destination: STOP, radiusM: 300 })
    const before = recorder.snapshot()
    recorder.event('end')
    expect(before.events).toEqual([])
  })
})

describe('parseRideLog', () => {
  const valid = () =>
    JSON.parse(JSON.stringify(recordRide([900, 280]))) as RideLog

  it('accepts a real log (round-tripped through JSON)', () => {
    expect(parseRideLog(valid()).readings).toHaveLength(2)
  })

  it('fills in missing events', () => {
    const data = valid() as Partial<RideLog>
    delete data.events
    expect(parseRideLog(data).events).toEqual([])
  })

  it.each([
    ['not an object', 'nope'],
    ['not an object', null],
    ['wrong format', { ...valid(), format: 'gpx' }],
    ['unsupported version', { ...valid(), version: 2 }],
    ['missing destination', { ...valid(), destination: { lat: 'x' } }],
    ['missing destination', { ...valid(), destination: undefined }],
    ['missing radius', { ...valid(), radiusM: 0 }],
    ['missing radius', { ...valid(), radiusM: undefined }],
    ['missing radius', { ...valid(), radiusM: Number.POSITIVE_INFINITY }],
    ['missing readings', { ...valid(), readings: 'lots' }],
    ['a reading is malformed', { ...valid(), readings: [{ lat: 1 }] }],
    ['a reading is malformed', { ...valid(), readings: [null] }],
  ])('rejects: %s', (why, data) => {
    expect(() => parseRideLog(data)).toThrow(RideLogError)
    expect(() => parseRideLog(data)).toThrow(why)
  })
})

describe('replayRide', () => {
  it('reproduces what the app decided during the ride', () => {
    const log = recordRide([1500, 1200, 900, 600, 400, 290, 280, 150])
    expect(replayRide(log)).toEqual(recordedEvents(log))
    expect(recordedEvents(log)).toEqual([
      { index: 6, event: 'arrived', distanceM: expect.closeTo(280, 0) },
    ])
  })

  it('can ask "what if the radius had been different?"', () => {
    const log = recordRide([1500, 1200, 900, 600, 400, 290, 280, 150])
    expect(replayRide(log, 1000)[0]).toMatchObject({
      index: 3,
      event: 'arrived',
    })
  })

  it('reports nothing for a ride that never came close', () => {
    const log = recordRide([3000, 2900, 2800])
    expect(replayRide(log)).toEqual([])
    expect(recordedEvents(log)).toEqual([])
  })
})
