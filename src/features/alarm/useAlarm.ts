import { useCallback, useEffect, useRef, useState } from 'react'
import type { AlarmAudio } from '../../services/audio/alarmAudio'
import type { RingtoneId } from '../../services/audio/ringtones'
import type { Vibration } from '../../services/vibration'

/** Why the alarm is ringing: the screen says different things for each. */
export type AlarmReason = 'arrived' | 'passed' | 'test'

export type AlarmState =
  | { status: 'idle' }
  | { status: 'ringing'; reason: AlarmReason }
  | { status: 'snoozed'; reason: AlarmReason; until: number }

export const SNOOZE_MS = 60_000

type UseAlarmOptions = {
  audio: AlarmAudio
  vibration: Vibration
  ringtoneId: RingtoneId
  snoozeMs?: number
  /**
   * Asked when a snooze ends. Return false to stay quiet, e.g. once the
   * user is no longer near the stop. Defaults to always ringing again.
   */
  shouldRingAgain?: () => boolean
}

/** Sound + vibration + snooze, as one piece of state. */
export function useAlarm({
  audio,
  vibration,
  ringtoneId,
  snoozeMs = SNOOZE_MS,
  shouldRingAgain,
}: UseAlarmOptions) {
  const [state, setState] = useState<AlarmState>({ status: 'idle' })
  const snoozeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringtoneRef = useRef(ringtoneId)
  const shouldRingAgainRef = useRef(shouldRingAgain)
  const reasonRef = useRef<AlarmReason>('arrived')

  useEffect(() => {
    ringtoneRef.current = ringtoneId
    shouldRingAgainRef.current = shouldRingAgain
  }, [ringtoneId, shouldRingAgain])

  const clearSnooze = useCallback(() => {
    if (snoozeTimer.current) clearTimeout(snoozeTimer.current)
    snoozeTimer.current = null
  }, [])

  const silence = useCallback(() => {
    audio.stop()
    vibration.stop()
  }, [audio, vibration])

  const ring = useCallback(
    (reason: AlarmReason) => {
      clearSnooze()
      reasonRef.current = reason
      // A test should sound like the real thing at full volume straight away;
      // a real alarm builds up so it isn't a shock.
      audio.play(ringtoneRef.current, {
        loop: true,
        crescendo: reason !== 'test',
      })
      vibration.start()
      setState({ status: 'ringing', reason })
    },
    [audio, vibration, clearSnooze],
  )

  const stop = useCallback(() => {
    clearSnooze()
    silence()
    setState({ status: 'idle' })
  }, [clearSnooze, silence])

  const snooze = useCallback(() => {
    clearSnooze()
    silence()
    const reason = reasonRef.current
    setState({ status: 'snoozed', reason, until: Date.now() + snoozeMs })
    snoozeTimer.current = setTimeout(() => {
      snoozeTimer.current = null
      if (shouldRingAgainRef.current?.() ?? true) ring(reason)
      else setState({ status: 'idle' })
    }, snoozeMs)
  }, [clearSnooze, silence, snoozeMs, ring])

  // Never leave an alarm ringing after the screen that owns it is gone.
  useEffect(
    () => () => {
      clearSnooze()
      silence()
    },
    [clearSnooze, silence],
  )

  return { state, ring, stop, snooze }
}
