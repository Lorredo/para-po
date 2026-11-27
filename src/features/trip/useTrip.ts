import { useCallback, useEffect, useRef, useState } from 'react'
import {
  evaluateGeofence,
  type GeofenceResult,
  INITIAL_GEOFENCE_STATE,
} from '../../lib/geo/geofence'
import type { AlarmAudio } from '../../services/audio/alarmAudio'
import type { LocationFix } from '../../services/location/types'
import type { ScreenWakeLock } from '../../services/wakeLock'
import type { Destination } from './types'

export type TripPhase = 'planning' | 'active' | 'ended'

/** No GPS update for this long during a trip shows a warning. */
export const GPS_WATCHDOG_MS = 30_000
const WATCHDOG_CHECK_MS = 5_000

type UseTripOptions = {
  destination: Destination | null
  radiusM: number
  fix: LocationFix | null
  startLocation: () => void
  stopLocation: () => void
  audio: AlarmAudio
  wakeLock: ScreenWakeLock
  /** The geofence decided it's time to ring. */
  onAlarm: (reason: 'arrived' | 'passed') => void
  watchdogMs?: number
}

/**
 * Runs a trip: one tap starts sound, screen wake lock and GPS together,
 * then every GPS reading goes through the geofence until it says "ring".
 */
export function useTrip({
  destination,
  radiusM,
  fix,
  startLocation,
  stopLocation,
  audio,
  wakeLock,
  onAlarm,
  watchdogMs = GPS_WATCHDOG_MS,
}: UseTripOptions) {
  const [phase, setPhase] = useState<TripPhase>('planning')
  const [result, setResult] = useState<GeofenceResult | null>(null)
  const [startedNear, setStartedNear] = useState(false)
  const [gpsStale, setGpsStale] = useState(false)

  const phaseRef = useRef<TripPhase>('planning')
  const geofenceRef = useRef(INITIAL_GEOFENCE_STATE)
  const lastFixAtRef = useRef(0)
  const onAlarmRef = useRef(onAlarm)
  const lastFixRef = useRef<LocationFix | null>(fix)

  useEffect(() => {
    onAlarmRef.current = onAlarm
  }, [onAlarm])

  const setPhaseBoth = (next: TripPhase) => {
    phaseRef.current = next
    setPhase(next)
  }

  const resetGeofence = () => {
    geofenceRef.current = INITIAL_GEOFENCE_STATE
    setResult(null)
    setStartedNear(false)
  }

  /** Must be called from inside a tap: that's what lets sound play later. */
  const start = useCallback(() => {
    if (!destination || phaseRef.current === 'active') return
    void audio.unlock()
    void wakeLock.request()
    resetGeofence()
    setGpsStale(false)
    lastFixAtRef.current = Date.now()
    // Readings from before the trip don't count.
    lastFixRef.current = fix
    setPhaseBoth('active')
    startLocation()
  }, [destination, audio, wakeLock, fix, startLocation])

  const shutDown = useCallback(
    (next: TripPhase) => {
      stopLocation()
      wakeLock.release()
      setGpsStale(false)
      setPhaseBoth(next)
    },
    [stopLocation, wakeLock],
  )

  /** Stop the trip without arriving. */
  const end = useCallback(() => {
    shutDown('planning')
    resetGeofence()
  }, [shutDown])

  /** "I'm getting off": the trip is done. */
  const finish = useCallback(() => shutDown('ended'), [shutDown])

  /** Leave the "Safe travels" screen. */
  const dismiss = useCallback(() => {
    resetGeofence()
    setPhaseBoth('planning')
  }, [])

  // Moving the stop mid-trip starts the geofence over for the new spot.
  const destLat = destination?.lat
  const destLng = destination?.lng
  useEffect(() => {
    if (phaseRef.current !== 'active') return
    resetGeofence()
  }, [destLat, destLng])

  // Every new GPS reading during a trip goes through the geofence.
  useEffect(() => {
    if (phaseRef.current !== 'active' || !destination || !fix) return
    if (fix === lastFixRef.current) return
    lastFixRef.current = fix
    lastFixAtRef.current = Date.now()
    setGpsStale(false)

    const next = evaluateGeofence(
      geofenceRef.current,
      fix,
      destination,
      { radiusM },
      Date.now(),
    )
    geofenceRef.current = next.state
    setResult(next)
    if (next.event === 'started-near') setStartedNear(true)
    if (next.state.armed) setStartedNear(false)
    if (next.event === 'arrived' || next.event === 'passed') {
      onAlarmRef.current(next.event)
    }
  }, [fix, destination, radiusM])

  // Watchdog: warn if GPS goes quiet during a trip.
  useEffect(() => {
    if (phase !== 'active') return
    const timer = setInterval(() => {
      setGpsStale(Date.now() - lastFixAtRef.current > watchdogMs)
    }, WATCHDOG_CHECK_MS)
    return () => clearInterval(timer)
  }, [phase, watchdogMs])

  // Never leave the screen locked on after the app goes away.
  useEffect(() => () => wakeLock.release(), [wakeLock])

  /** For the alarm's snooze: ring again only while the trip is still on. */
  const isActive = useCallback(() => phaseRef.current === 'active', [])

  return {
    phase,
    result,
    startedNear,
    gpsStale,
    start,
    end,
    finish,
    dismiss,
    isActive,
  }
}
