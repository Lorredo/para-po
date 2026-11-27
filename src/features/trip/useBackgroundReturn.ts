import { useCallback, useEffect, useRef, useState } from 'react'

/** Shorter trips to the background (a quick glance at a message) don't count. */
export const MIN_AWAY_MS = 3000

/**
 * During a trip, notices when Para Po comes back from the background
 * (another app, or the screen locked). Browsers pause web apps while they're
 * hidden, so GPS and the alarm may have stopped meanwhile: the rider should
 * know. Returns how long it was away, or null.
 */
export function useBackgroundReturn(
  active: boolean,
  doc: Document | undefined = globalThis.document,
) {
  const [awayMs, setAwayMs] = useState<number | null>(null)
  const [wasActive, setWasActive] = useState(active)
  const hiddenAtRef = useRef<number | null>(null)

  // A finished trip's notice shouldn't carry over to the next one.
  // (Adjusting state during render, as React recommends over an effect.)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) setAwayMs(null)
  }

  useEffect(() => {
    if (!active || !doc) {
      hiddenAtRef.current = null
      return
    }
    const onChange = () => {
      if (doc.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (hiddenAt === null) return
      const away = Date.now() - hiddenAt
      if (away >= MIN_AWAY_MS) setAwayMs(away)
    }
    doc.addEventListener('visibilitychange', onChange)
    return () => doc.removeEventListener('visibilitychange', onChange)
  }, [active, doc])

  const dismiss = useCallback(() => setAwayMs(null), [])
  return { awayMs, dismiss }
}

/** "45 seconds", "1 minute", "12 minutes". */
export function formatAway(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} seconds`
  const minutes = Math.round(seconds / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}
