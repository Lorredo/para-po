import { copy } from '../../content/copy'
import { formatAway } from '../../features/trip/useBackgroundReturn'

/** "Para Po was in the background for 2 minutes, so tracking may have paused." */
export function ReturnNotice({
  awayMs,
  onDismiss,
}: {
  awayMs: number
  onDismiss: () => void
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl bg-jeep-yellow/25 p-3 text-sm text-ink"
    >
      <p className="min-w-0 flex-1">{copy.returned.body(formatAway(awayMs))}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg px-3 py-1 font-semibold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
      >
        {copy.returned.dismiss}
      </button>
    </div>
  )
}
