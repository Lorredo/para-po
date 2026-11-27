import { useEffect, useId, useRef } from 'react'
import { copy } from '../../content/copy'
import type { AlarmReason } from '../../features/alarm/useAlarm'
import { formatDistance } from '../../lib/geo/format'

type AlarmOverlayProps = {
  reason: AlarmReason
  stopName?: string | undefined
  distanceM?: number | null
  onStop: () => void
  /** Omit to hide the snooze button (e.g. for a test alarm). */
  onSnooze?: (() => void) | undefined
}

/**
 * Full-screen alarm. Big, high-contrast, and operable with one thumb while
 * standing in a moving jeepney.
 */
export function AlarmOverlay({
  reason,
  stopName,
  distanceM = null,
  onStop,
  onSnooze,
}: AlarmOverlayProps) {
  const titleId = useId()
  const bodyId = useId()
  const stopRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    stopRef.current?.focus()
  }, [])

  const where =
    stopName && distanceM !== null
      ? copy.alarm.whereWithDistance(stopName, formatDistance(distanceM))
      : stopName

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="fixed inset-0 z-[3000] flex flex-col items-center bg-alarm-red px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <BellIcon />
        <h2 id={titleId} className="text-5xl font-extrabold tracking-tight">
          {copy.alarm.title}
        </h2>
        <p id={bodyId} className="max-w-xs text-xl font-semibold">
          {copy.alarm.body[reason]}
        </p>
        {where && <p className="text-base text-white/90">{where}</p>}
      </div>

      <div className="w-full max-w-sm space-y-3">
        <button
          ref={stopRef}
          type="button"
          onClick={onStop}
          className="w-full rounded-2xl bg-white px-6 py-5 text-xl font-bold text-alarm-red shadow-lg focus-visible:ring-4 focus-visible:ring-jeep-yellow focus-visible:outline-none"
        >
          {reason === 'test' ? copy.alarm.done : copy.alarm.stop}
        </button>
        {onSnooze && (
          <button
            type="button"
            onClick={onSnooze}
            className="w-full rounded-2xl border-2 border-white/80 px-6 py-4 text-lg font-semibold text-white focus-visible:ring-4 focus-visible:ring-jeep-yellow focus-visible:outline-none"
          >
            {copy.alarm.snooze}
          </button>
        )}
      </div>
    </div>
  )
}

function BellIcon() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="origin-top motion-safe:animate-[para-po-ring_1.2s_ease-in-out_infinite]"
    >
      <path d="M12 2a1.5 1.5 0 0 0-1.5 1.5v.6A6.5 6.5 0 0 0 5.5 10.5V15l-1.8 2.2a.6.6 0 0 0 .5 1h15.6a.6.6 0 0 0 .5-1L18.5 15v-4.5a6.5 6.5 0 0 0-5-6.4v-.6A1.5 1.5 0 0 0 12 2z" />
      <circle cx="12" cy="20.5" r="2" />
    </svg>
  )
}
