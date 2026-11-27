import { copy } from '../../content/copy'
import type { TrackingStatus } from '../../features/location/useLocationTracking'

type LocateButtonProps = {
  status: TrackingStatus
  onClick: () => void
}

export function LocateButton({ status, onClick }: LocateButtonProps) {
  const tracking = status === 'tracking'
  const locating = status === 'locating'
  const label = tracking ? copy.location.recenter : copy.location.locate

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-busy={locating}
      className={`flex h-11 w-11 items-center justify-center rounded-full shadow-md ring-1 ring-black/10 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none ${
        tracking ? 'bg-gps-blue text-white' : 'bg-white text-navy'
      }`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className={locating ? 'animate-pulse' : undefined}
      >
        <circle cx="12" cy="12" r="7" />
        <circle
          cx="12"
          cy="12"
          r="2.5"
          fill={tracking ? 'currentColor' : 'none'}
        />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  )
}
