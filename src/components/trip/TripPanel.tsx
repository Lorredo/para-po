import { copy } from '../../content/copy'
import { formatLatLng } from '../../lib/geo/format'
import type { LatLng } from '../../lib/geo/types'
import { RadiusSlider } from './RadiusSlider'

type TripPanelProps = {
  destination: LatLng | null
  radiusM: number
  onRadiusChange: (meters: number) => void
  onClearDestination: () => void
}

export function TripPanel({
  destination,
  radiusM,
  onRadiusChange,
  onClearDestination,
}: TripPanelProps) {
  return (
    <section
      aria-label={copy.setup.sectionLabel}
      className="relative z-[1000] space-y-4 rounded-t-2xl bg-white px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
    >
      {destination ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-navy">
              {copy.setup.destinationTitle}
            </h2>
            <p className="text-xs text-ink/60 tabular-nums">
              {formatLatLng(destination)}
            </p>
            <p className="mt-1 text-sm text-ink/80">
              {copy.setup.destinationHint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearDestination}
            className="shrink-0 rounded-full border border-navy/20 px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
          >
            {copy.setup.clear}
          </button>
        </div>
      ) : (
        <div>
          <h2 className="text-base font-bold text-navy">
            {copy.setup.emptyTitle}
          </h2>
          <p className="text-sm text-ink/80">{copy.setup.emptyHint}</p>
        </div>
      )}

      <RadiusSlider value={radiusM} onChange={onRadiusChange} />
    </section>
  )
}
