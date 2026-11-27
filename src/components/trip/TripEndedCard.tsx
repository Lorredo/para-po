import { copy } from '../../content/copy'

/** Shown after "I'm getting off". */
export function TripEndedCard({ onDone }: { onDone: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-2xl bg-route-teal/15 p-4"
    >
      <div className="min-w-0 flex-1">
        <p className="text-lg font-extrabold text-navy">
          {copy.trip.ended.title}
        </p>
        <p className="text-sm text-ink/80">{copy.trip.ended.body}</p>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="shrink-0 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-jeep-yellow focus-visible:outline-none"
      >
        {copy.trip.ended.done}
      </button>
    </div>
  )
}
