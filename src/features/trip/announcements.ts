import { useEffect, useRef, useState } from 'react'
import { copy } from '../../content/copy'
import { formatDistance } from '../../lib/geo/format'

/** Distances worth announcing to screen-reader users on the way in. */
export const ANNOUNCE_AT_M = [2000, 1000, 500] as const

export type AnnouncerState = {
  /** Thresholds already passed (or already below at the start). */
  done: ReadonlySet<number>
  entered: boolean
}

export const INITIAL_ANNOUNCER: AnnouncerState = {
  done: new Set(),
  entered: false,
}

/**
 * Decides whether a new distance reading deserves an announcement. Pure, so
 * it's easy to test. On the very first reading nothing is announced; we just
 * note which milestones are already behind us.
 */
export function nextAnnouncement(
  state: AnnouncerState,
  distanceM: number,
  radiusM: number,
  isFirst: boolean,
): { state: AnnouncerState; message?: string } {
  const done = new Set(state.done)
  const milestones = ANNOUNCE_AT_M.filter((m) => m > radiusM)

  if (isFirst) {
    for (const m of milestones) if (distanceM <= m) done.add(m)
    return { state: { done, entered: distanceM <= radiusM } }
  }

  if (!state.entered && distanceM <= radiusM) {
    for (const m of milestones) done.add(m)
    return { state: { done, entered: true }, message: copy.announce.entering }
  }

  // Announce only the closest milestone crossed by this reading.
  const crossed = milestones.filter((m) => distanceM <= m && !done.has(m))
  if (crossed.length === 0) return { state }
  for (const m of crossed) done.add(m)
  const nearest = Math.min(...crossed)
  return {
    state: { ...state, done },
    message: copy.announce.distance(formatDistance(nearest)),
  }
}

/**
 * Returns the latest announcement for an aria-live region during a trip.
 * Resets whenever a new trip starts.
 */
export function useDistanceAnnouncer(
  distanceM: number | null,
  radiusM: number,
  active: boolean,
): string {
  const [message, setMessage] = useState('')
  const [wasActive, setWasActive] = useState(active)
  const stateRef = useRef<AnnouncerState>(INITIAL_ANNOUNCER)
  const seenFirstRef = useRef(false)

  // Each trip starts fresh. (Adjusting state during render, as React
  // recommends over an effect.)
  if (active !== wasActive) {
    setWasActive(active)
    setMessage('')
  }

  useEffect(() => {
    if (active) return
    stateRef.current = INITIAL_ANNOUNCER
    seenFirstRef.current = false
  }, [active])

  useEffect(() => {
    if (!active || distanceM === null) return
    const result = nextAnnouncement(
      stateRef.current,
      distanceM,
      radiusM,
      !seenFirstRef.current,
    )
    seenFirstRef.current = true
    stateRef.current = result.state
    if (result.message) setMessage(result.message)
  }, [active, distanceM, radiusM])

  return message
}
