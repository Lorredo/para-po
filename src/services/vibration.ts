/**
 * Repeating vibration while the alarm rings.
 *
 * `navigator.vibrate` plays a pattern once, so we restart it every period.
 * iPhones don't support the Vibration API at all; there this does nothing,
 * and the README says so.
 */

export type Vibration = {
  readonly supported: boolean
  start(): void
  stop(): void
}

/** Buzz, pause, buzz, pause: 2 s, then repeat. */
export const ALARM_PATTERN_MS = [700, 300, 700, 300]
const PERIOD_MS = ALARM_PATTERN_MS.reduce((sum, ms) => sum + ms, 0)

export function createVibration(
  nav: Navigator | undefined = globalThis.navigator,
): Vibration {
  const supported = typeof nav?.vibrate === 'function'
  let timer: ReturnType<typeof setInterval> | null = null

  const buzz = () => {
    try {
      nav!.vibrate(ALARM_PATTERN_MS)
    } catch {
      // Some browsers throw without a recent tap; the sound still plays.
    }
  }

  return {
    supported,
    start() {
      if (!supported || timer) return
      buzz()
      timer = setInterval(buzz, PERIOD_MS)
    },
    stop() {
      // Only touch the hardware if we actually started it. (Browsers warn
      // about vibrate() calls before the first tap.)
      if (!timer) return
      clearInterval(timer)
      timer = null
      try {
        nav!.vibrate(0)
      } catch {
        // Nothing to cancel.
      }
    },
  }
}

export const vibration: Vibration = createVibration()
