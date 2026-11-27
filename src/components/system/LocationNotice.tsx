import { copy } from '../../content/copy'
import type { TrackingStatus } from '../../features/location/useLocationTracking'
import {
  isFatalLocationError,
  type LocationErrorKind,
} from '../../services/location/types'

type LocationNoticeProps = {
  status: TrackingStatus
  error: LocationErrorKind | null
  onDismiss: () => void
}

/** One short line about the GPS state, shown at the top of the trip panel. */
export function LocationNotice({
  status,
  error,
  onDismiss,
}: LocationNoticeProps) {
  if (status === 'error' && error && isFatalLocationError(error)) {
    const message = copy.location.errors[error]
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl bg-signal-red/10 p-3 text-sm text-ink"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-signal-red">{message.title}</p>
          <p className="text-ink/80">{message.body}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg px-3 py-1 font-semibold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
        >
          {copy.location.dismiss}
        </button>
      </div>
    )
  }

  // Warnings: the watch is still running and will recover on its own.
  if (error === 'timeout' || error === 'unavailable') {
    return (
      <p
        role="status"
        className="rounded-xl bg-jeep-yellow/20 p-3 text-sm text-ink"
      >
        {error === 'timeout'
          ? copy.location.weakSignal
          : copy.location.signalLost}
      </p>
    )
  }

  if (status === 'locating') {
    return (
      <p
        role="status"
        className="rounded-xl bg-gps-blue/10 p-3 text-sm text-ink"
      >
        {copy.location.locating}
      </p>
    )
  }

  return null
}
