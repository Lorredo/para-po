import { haversineM } from './distance'
import { closestApproachM } from './segment'
import type { LatLng } from './types'

/**
 * Decides when to ring. Pure: no timers, no browser APIs, no React.
 * Feed it each GPS reading with the previous state, and keep the state it
 * returns.
 *
 * Rules:
 * 1. Ignore bad readings: too inaccurate, too old, out of order, or an
 *    impossible jump (a GPS glitch).
 * 2. "arrived": 2 readings in a row inside the radius.
 * 3. "passed": for when no 2 readings land inside (fast trains, tunnels).
 *    The line travelled between readings came within radius + GPS accuracy
 *    of the stop, and we are now moving away: 2 readings in a row, and at
 *    least max(accuracy, 30 m) beyond the closest point.
 * 4. "started-near": the trip began within radius + accuracy of the stop.
 *    Nothing rings until the user has moved away, so it can't fire instantly.
 */

export type GeofenceFix = LatLng & {
  accuracyM: number
  /** When the reading was taken (ms since epoch). */
  timestamp: number
}

export type GeofenceConfig = {
  radiusM: number
  /** Readings less accurate than this are ignored. */
  maxAccuracyM?: number
  /** Readings older than this are ignored. */
  maxFixAgeMs?: number
  /** Readings in a row inside the radius needed to arrive. */
  confirmReadings?: number
  /** Readings in a row moving away needed to call it "passed". */
  recedeReadings?: number
  /** Faster than this between readings (beyond GPS error) is a glitch. */
  maxSpeedMps?: number
}

export const GEOFENCE_DEFAULTS = {
  maxAccuracyM: 150,
  maxFixAgeMs: 15_000,
  confirmReadings: 2,
  recedeReadings: 2,
  maxSpeedMps: 60, // 216 km/h: faster than any Metro Manila ride
} as const satisfies Omit<Required<GeofenceConfig>, 'radiusM'>

/** How far past the closest point we must be before calling it "passed". */
const MIN_PASS_MARGIN_M = 30
/** Movement smaller than this between readings doesn't count as moving away. */
const RECEDE_EPSILON_M = 1
/** After this many "jumps" in a row, trust the new readings instead. */
const MAX_JUMP_REJECTS = 2

export type GeofenceEvent = 'arrived' | 'passed' | 'started-near'

export type GeofenceStatus =
  | 'waiting' // no usable reading yet
  | 'started-near' // began near the stop; not armed yet
  | 'approaching'
  | 'entering' // inside the radius, waiting for confirmation
  | 'arrived'
  | 'passed'

export type GeofenceState = {
  status: GeofenceStatus
  /** False until the user has been clearly outside the radius. */
  armed: boolean
  insideStreak: number
  recedingStreak: number
  /** The travelled path came within radius + accuracy of the stop. */
  wasNear: boolean
  /** Closest approach since arming, along the travelled path. */
  closestM: number
  jumpRejects: number
  lastFix: GeofenceFix | null
}

export const INITIAL_GEOFENCE_STATE: GeofenceState = Object.freeze({
  status: 'waiting',
  armed: false,
  insideStreak: 0,
  recedingStreak: 0,
  wasNear: false,
  closestM: Number.POSITIVE_INFINITY,
  jumpRejects: 0,
  lastFix: null,
})

export type RejectReason = 'inaccurate' | 'stale' | 'out-of-order' | 'jump'

export type GeofenceResult = {
  state: GeofenceState
  /** Straight-line distance to the stop for this reading, even if rejected. */
  distanceM: number
  accepted: boolean
  rejectReason?: RejectReason
  event?: GeofenceEvent
}

export function evaluateGeofence(
  state: GeofenceState,
  fix: GeofenceFix,
  destination: LatLng,
  config: GeofenceConfig,
  nowMs: number,
): GeofenceResult {
  const { radiusM } = config
  const maxAccuracyM = config.maxAccuracyM ?? GEOFENCE_DEFAULTS.maxAccuracyM
  const maxFixAgeMs = config.maxFixAgeMs ?? GEOFENCE_DEFAULTS.maxFixAgeMs
  const confirmReadings =
    config.confirmReadings ?? GEOFENCE_DEFAULTS.confirmReadings
  const recedeReadings =
    config.recedeReadings ?? GEOFENCE_DEFAULTS.recedeReadings
  const maxSpeedMps = config.maxSpeedMps ?? GEOFENCE_DEFAULTS.maxSpeedMps

  const distanceM = haversineM(fix, destination)
  const reject = (
    rejectReason: RejectReason,
    nextState = state,
  ): GeofenceResult => ({
    state: nextState,
    distanceM,
    accepted: false,
    rejectReason,
  })

  // 1. Is this reading usable at all?
  if (!(fix.accuracyM <= maxAccuracyM)) return reject('inaccurate')
  if (nowMs - fix.timestamp > maxFixAgeMs) return reject('stale')

  const last = state.lastFix
  if (last && fix.timestamp <= last.timestamp) return reject('out-of-order')

  let reanchor = false
  if (last) {
    const seconds = (fix.timestamp - last.timestamp) / 1000
    const unexplainedM = Math.max(
      0,
      haversineM(last, fix) - last.accuracyM - fix.accuracyM,
    )
    if (unexplainedM / seconds > maxSpeedMps) {
      if (state.jumpRejects + 1 < MAX_JUMP_REJECTS) {
        return reject('jump', { ...state, jumpRejects: state.jumpRejects + 1 })
      }
      // Two "jumps" in a row: the reading we trusted was probably the glitch.
      reanchor = true
    }
  }

  // Already rang: keep tracking quietly.
  if (state.status === 'arrived' || state.status === 'passed') {
    return {
      state: { ...state, lastFix: fix, jumpRejects: 0 },
      distanceM,
      accepted: true,
    }
  }

  const nearM = radiusM + fix.accuracyM

  // 4. Not armed yet: either the first reading, or we started near the stop.
  if (!state.armed) {
    if (distanceM > nearM) {
      return {
        state: armedFrom(fix, distanceM, false),
        distanceM,
        accepted: true,
      }
    }
    const isFirst = state.status === 'waiting'
    return {
      state: { ...state, status: 'started-near', lastFix: fix, jumpRejects: 0 },
      distanceM,
      accepted: true,
      ...(isFirst ? { event: 'started-near' as const } : {}),
    }
  }

  if (reanchor) {
    return {
      state: armedFrom(fix, distanceM, distanceM <= nearM),
      distanceM,
      accepted: true,
    }
  }

  // 2 & 3. Armed: look at the path travelled since the last reading.
  // Arming always stores a reading, so `last` is set from here on.
  const pathClosestM = closestApproachM(destination, last!, fix)
  const inside = distanceM <= radiusM
  const insideStreak = inside ? state.insideStreak + 1 : 0
  const movingAway = pathClosestM < distanceM - RECEDE_EPSILON_M
  const recedingStreak = movingAway ? state.recedingStreak + 1 : 0
  const closestM = Math.min(state.closestM, pathClosestM)
  const wasNear = state.wasNear || pathClosestM <= nearM

  let status: GeofenceStatus = inside ? 'entering' : 'approaching'
  let event: GeofenceEvent | undefined
  if (insideStreak >= confirmReadings) {
    status = 'arrived'
    event = 'arrived'
  } else if (
    !inside &&
    wasNear &&
    recedingStreak >= recedeReadings &&
    distanceM - closestM >= Math.max(fix.accuracyM, MIN_PASS_MARGIN_M)
  ) {
    status = 'passed'
    event = 'passed'
  }

  return {
    state: {
      status,
      armed: true,
      insideStreak,
      recedingStreak,
      wasNear,
      closestM,
      jumpRejects: 0,
      lastFix: fix,
    },
    distanceM,
    accepted: true,
    ...(event ? { event } : {}),
  }
}

/** A fresh armed state starting from this reading. */
function armedFrom(
  fix: GeofenceFix,
  distanceM: number,
  wasNear: boolean,
): GeofenceState {
  return {
    status: 'approaching',
    armed: true,
    insideStreak: 0,
    recedingStreak: 0,
    wasNear,
    closestM: distanceM,
    jumpRejects: 0,
    lastFix: fix,
  }
}
