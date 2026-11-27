import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type LocationErrorKind,
  type LocationFix,
  type LocationProvider,
  NON_FATAL_ERRORS,
} from '../../services/location/types'

export type TrackingStatus = 'off' | 'locating' | 'tracking' | 'error'

export type LocationTracking = {
  status: TrackingStatus
  fix: LocationFix | null
  /** Fatal when status is 'error'; otherwise a warning such as a weak signal. */
  error: LocationErrorKind | null
  start(): void
  stop(): void
}

/** Runs a LocationProvider and exposes its latest fix as React state. */
export function useLocationTracking(
  provider: LocationProvider,
): LocationTracking {
  const [status, setStatus] = useState<TrackingStatus>('off')
  const [fix, setFix] = useState<LocationFix | null>(null)
  const [error, setError] = useState<LocationErrorKind | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    setStatus('off')
    setFix(null)
    setError(null)
  }, [])

  const start = useCallback(() => {
    if (stopRef.current) return
    setError(null)
    setStatus('locating')

    let active = true
    const stopProvider = provider.start({
      onFix(next) {
        if (!active) return
        setFix(next)
        setError(null)
        setStatus('tracking')
      },
      onError(kind) {
        if (!active) return
        setError(kind)
        if (NON_FATAL_ERRORS.has(kind)) return
        active = false
        stopRef.current?.()
        stopRef.current = null
        setFix(null)
        setStatus('error')
      },
    })

    // Some errors (unsupported, insecure) are reported before start() returns.
    if (!active) {
      stopProvider()
      return
    }
    stopRef.current = () => {
      active = false
      stopProvider()
    }
  }, [provider])

  useEffect(() => () => stopRef.current?.(), [])

  return { status, fix, error, start, stop }
}
