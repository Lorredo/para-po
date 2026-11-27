import { copy } from '../../content/copy'
import type { TripPhase } from '../../features/trip/useTrip'

type TripControlsProps = {
  phase: TripPhase
  canStart: boolean
  onStart: () => void
  onEnd: () => void
}

/** The main action, at the bottom of the panel where a thumb can reach it. */
export function TripControls({
  phase,
  canStart,
  onStart,
  onEnd,
}: TripControlsProps) {
  if (phase === 'active') {
    return (
      <button
        type="button"
        onClick={onEnd}
        className="w-full rounded-2xl border-2 border-navy/25 px-4 py-3 text-base font-bold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
      >
        {copy.trip.end}
      </button>
    )
  }

  if (phase === 'ended') return null

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        aria-describedby={canStart ? undefined : 'trip-start-hint'}
        className="w-full rounded-2xl bg-jeep-yellow px-4 py-4 text-lg font-extrabold text-navy shadow-sm hover:brightness-95 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copy.trip.start}
      </button>
      {!canStart && (
        <p id="trip-start-hint" className="text-center text-xs text-ink/70">
          {copy.trip.needStop}
        </p>
      )}
    </div>
  )
}
