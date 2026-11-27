import { useCallback, useEffect, useRef, useState } from 'react'
import type { GeofenceResult } from '../../lib/geo/geofence'
import {
  createRideLog,
  type RideEventType,
  type RideLog,
  type RideLogRecorder,
} from '../../lib/geo/rideLog'
import type { LatLng } from '../../lib/geo/types'
import type { LocationFix } from '../../services/location/types'

/**
 * Optional, opt-in recording of a real trip for testing. Kept in memory only;
 * the rider decides whether to download it afterwards.
 */
export function useRideRecorder(
  doc: Document | undefined = globalThis.document,
) {
  const [enabled, setEnabled] = useState(false)
  const [recording, setRecording] = useState(false)
  const [finished, setFinished] = useState<RideLog | null>(null)
  const recorderRef = useRef<RideLogRecorder | null>(null)

  /** Call when a trip starts. Does nothing unless the rider opted in. */
  const begin = useCallback(
    (destination: LatLng & { name?: string | undefined }, radiusM: number) => {
      if (!enabled || recorderRef.current) return
      recorderRef.current = createRideLog({ destination, radiusM })
      recorderRef.current.event('start')
      setFinished(null)
      setRecording(true)
    },
    [enabled],
  )

  /** Call when a trip ends, however it ends. */
  const finish = useCallback((how: 'getting-off' | 'end') => {
    const recorder = recorderRef.current
    if (!recorder) return
    recorder.event(how)
    recorderRef.current = null
    setFinished(recorder.snapshot())
    setRecording(false)
  }, [])

  const reading = useCallback(
    (fix: LocationFix, result: GeofenceResult) =>
      recorderRef.current?.reading(fix, result),
    [],
  )

  const event = useCallback(
    (type: RideEventType, detail?: string) =>
      recorderRef.current?.event(type, detail),
    [],
  )

  // Note when the app goes to the background and back: GPS pauses then.
  useEffect(() => {
    if (!recording || !doc) return
    const onChange = () =>
      recorderRef.current?.event(
        doc.visibilityState === 'hidden' ? 'hidden' : 'visible',
      )
    doc.addEventListener('visibilitychange', onChange)
    return () => doc.removeEventListener('visibilitychange', onChange)
  }, [recording, doc])

  const dismiss = useCallback(() => setFinished(null), [])

  return {
    enabled,
    setEnabled,
    recording,
    finished,
    begin,
    finish,
    reading,
    event,
    dismiss,
  }
}

/** e.g. "para-po-ride-2026-12-01-0815.json" (local time). */
export function rideLogFilename(log: RideLog): string {
  const d = new Date(log.recordedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `para-po-ride-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`
}
