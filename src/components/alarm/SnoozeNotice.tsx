import { useEffect, useState } from 'react'
import { copy } from '../../content/copy'

type SnoozeNoticeProps = {
  until: number
  /** Silences the alarm for good, e.g. "I'm getting off". */
  onTurnOff: () => void
}

/** "Snoozed. Ringing again in 42 s." with a way to say you're off. */
export function SnoozeNotice({ until, onTurnOff }: SnoozeNoticeProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const seconds = Math.max(0, Math.ceil((until - now) / 1000))

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl bg-alarm-red/10 p-3 text-sm text-ink"
    >
      <p className="min-w-0 flex-1 font-semibold tabular-nums">
        {copy.alarm.snoozed(seconds)}
      </p>
      <button
        type="button"
        onClick={onTurnOff}
        className="shrink-0 rounded-lg px-3 py-1 font-semibold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
      >
        {copy.alarm.stop}
      </button>
    </div>
  )
}
