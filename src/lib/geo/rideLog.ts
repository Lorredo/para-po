import {
  evaluateGeofence,
  type GeofenceEvent,
  type GeofenceFix,
  type GeofenceResult,
  type GeofenceStatus,
  INITIAL_GEOFENCE_STATE,
  type RejectReason,
} from './geofence'
import type { LatLng } from './types'

/**
 * A recording of one real trip: every GPS reading and what the geofence
 * decided about it, plus what the rider did. Recorded rides become test
 * fixtures, so real commutes keep checking the "when to ring" logic.
 */

export const RIDE_LOG_FORMAT = 'para-po-ride-log'
export const RIDE_LOG_VERSION = 1

export type RideReading = GeofenceFix & {
  /** When the app received it (ms since epoch); used as "now" on replay. */
  receivedAt: number
  speedMps: number | null
  accepted: boolean
  rejectReason?: RejectReason
  status: GeofenceStatus
  distanceM: number
  event?: GeofenceEvent
}

export type RideEventType =
  'start' | 'alarm' | 'snooze' | 'getting-off' | 'end' | 'hidden' | 'visible'

export type RideEvent = { at: number; type: RideEventType; detail?: string }

export type RideLog = {
  format: typeof RIDE_LOG_FORMAT
  version: typeof RIDE_LOG_VERSION
  recordedAt: string
  destination: LatLng & { name?: string }
  radiusM: number
  readings: RideReading[]
  events: RideEvent[]
}

/** ~10 cm; more digits only add file size, not information. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

export function createRideLog({
  destination,
  radiusM,
  now = Date.now,
}: {
  destination: LatLng & { name?: string | undefined }
  radiusM: number
  now?: () => number
}) {
  const log: RideLog = {
    format: RIDE_LOG_FORMAT,
    version: RIDE_LOG_VERSION,
    recordedAt: new Date(now()).toISOString(),
    destination: {
      lat: round6(destination.lat),
      lng: round6(destination.lng),
      ...(destination.name ? { name: destination.name } : {}),
    },
    radiusM,
    readings: [],
    events: [],
  }

  return {
    reading(
      fix: GeofenceFix & { speedMps: number | null },
      result: GeofenceResult,
    ) {
      log.readings.push({
        lat: round6(fix.lat),
        lng: round6(fix.lng),
        accuracyM: Math.round(fix.accuracyM * 10) / 10,
        timestamp: fix.timestamp,
        speedMps: fix.speedMps,
        receivedAt: now(),
        accepted: result.accepted,
        ...(result.rejectReason ? { rejectReason: result.rejectReason } : {}),
        status: result.state.status,
        distanceM: Math.round(result.distanceM * 10) / 10,
        ...(result.event ? { event: result.event } : {}),
      })
    },
    event(type: RideEventType, detail?: string) {
      log.events.push({ at: now(), type, ...(detail ? { detail } : {}) })
    },
    /** A finished copy, safe to keep after recording carries on. */
    snapshot(): RideLog {
      return structuredClone(log)
    },
  }
}

export type RideLogRecorder = ReturnType<typeof createRideLog>

export class RideLogError extends Error {}

/** Checks a file really is a ride log before trusting it. */
export function parseRideLog(data: unknown): RideLog {
  const fail = (why: string): never => {
    throw new RideLogError(`Not a valid Para Po ride log: ${why}`)
  }
  if (typeof data !== 'object' || data === null) return fail('not an object')
  const log = data as Partial<RideLog>
  if (log.format !== RIDE_LOG_FORMAT) return fail('wrong format')
  if (log.version !== RIDE_LOG_VERSION) return fail('unsupported version')
  const d = log.destination
  if (!d || !Number.isFinite(d.lat) || !Number.isFinite(d.lng)) {
    return fail('missing destination')
  }
  if (
    typeof log.radiusM !== 'number' ||
    !Number.isFinite(log.radiusM) ||
    log.radiusM <= 0
  ) {
    return fail('missing radius')
  }
  if (!Array.isArray(log.readings)) return fail('missing readings')
  for (const r of log.readings) {
    const ok =
      Number.isFinite(r?.lat) &&
      Number.isFinite(r?.lng) &&
      Number.isFinite(r?.timestamp) &&
      Number.isFinite(r?.receivedAt) &&
      typeof r?.accuracyM === 'number'
    if (!ok) return fail('a reading is malformed')
  }
  return {
    ...log,
    events: Array.isArray(log.events) ? log.events : [],
  } as RideLog
}

export type ReplayEvent = {
  index: number
  event: GeofenceEvent
  distanceM: number
}

/**
 * Feeds a recorded ride back through today's geofence, exactly as the app
 * saw it (each reading's receive time is "now"). Returns where it would ring.
 */
export function replayRide(
  log: RideLog,
  radiusM: number = log.radiusM,
): ReplayEvent[] {
  let state = INITIAL_GEOFENCE_STATE
  const events: ReplayEvent[] = []
  log.readings.forEach((r, index) => {
    const result = evaluateGeofence(
      state,
      {
        lat: r.lat,
        lng: r.lng,
        accuracyM: r.accuracyM,
        timestamp: r.timestamp,
      },
      log.destination,
      { radiusM },
      r.receivedAt,
    )
    state = result.state
    if (result.event) {
      events.push({
        index,
        event: result.event,
        // Same rounding as recorded readings, so the two compare equal.
        distanceM: Math.round(result.distanceM * 10) / 10,
      })
    }
  })
  return events
}

/** What the app decided during the real ride, in the same shape. */
export function recordedEvents(log: RideLog): ReplayEvent[] {
  return log.readings.flatMap((r, index) =>
    r.event ? [{ index, event: r.event, distanceM: r.distanceM }] : [],
  )
}
