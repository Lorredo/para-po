import type { ReactNode } from 'react'
import { copy } from '../../content/copy'
import type { Destination } from '../../features/trip/types'
import { formatDistance, formatLatLng } from '../../lib/geo/format'
import { RadiusSlider } from './RadiusSlider'

type TripPanelProps = {
  destination: Destination | null
  radiusM: number
  onRadiusChange: (meters: number) => void
  onClearDestination: () => void
  /** Straight-line distance from the user to the stop, when both are known. */
  distanceM?: number | null
  accuracyM?: number | null
  /** A status line shown above everything else, e.g. GPS problems. */
  notice?: ReactNode
  /** Extra settings below the radius, e.g. the alarm sound. */
  footer?: ReactNode
  /** The main action (Start / End trip), last, within thumb reach. */
  actions?: ReactNode
  /** Changing the stop is fine mid-trip; removing it isn't. */
  clearDisabled?: boolean
  /**
   * During a trip, fold the radius and sound settings behind this one-line
   * summary so the map keeps its space.
   */
  settingsSummary?: string | undefined
  /** Shown under the empty state, e.g. the "Try a demo ride" link. */
  emptyExtra?: ReactNode
}

export function TripPanel({
  destination,
  radiusM,
  onRadiusChange,
  onClearDestination,
  distanceM = null,
  accuracyM = null,
  notice,
  footer,
  actions,
  clearDisabled = false,
  settingsSummary,
  emptyExtra,
}: TripPanelProps) {
  const settings = (
    <>
      <RadiusSlider value={radiusM} onChange={onRadiusChange} />
      {footer}
    </>
  )

  return (
    <section
      aria-label={copy.setup.sectionLabel}
      // On short screens the panel scrolls instead of squeezing the map.
      className="relative z-[1000] max-h-[58dvh] space-y-4 overflow-y-auto overscroll-contain rounded-t-2xl bg-white px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
    >
      {notice}

      {destination ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold tracking-wide text-ink/70 uppercase">
              {copy.setup.destinationTitle}
            </h2>
            <p className="truncate text-base font-bold text-navy">
              {destination.name ?? copy.setup.droppedPin}
            </p>
            <p className="text-xs text-ink/70 tabular-nums">
              {destination.kind && <>{destination.kind} · </>}
              {formatLatLng(destination)}
            </p>
            {distanceM !== null ? (
              <div className="mt-2" data-testid="distance-readout">
                <p className="text-2xl font-bold text-navy tabular-nums">
                  {formatDistance(distanceM)}{' '}
                  <span className="text-base font-semibold text-ink/70">
                    {copy.location.toStop}
                  </span>
                </p>
                {accuracyM !== null && (
                  <p className="text-xs text-ink/70 tabular-nums">
                    {copy.location.accuracy(accuracyM)}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-ink/80">
                {copy.setup.destinationHint}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClearDestination}
            disabled={clearDisabled}
            className="shrink-0 rounded-full border border-navy/20 px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none disabled:opacity-40"
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
          {emptyExtra}
        </div>
      )}

      {settingsSummary ? (
        <details className="rounded-xl border border-ink/10 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-navy">
            {settingsSummary}
          </summary>
          <div className="mt-3 space-y-4">{settings}</div>
        </details>
      ) : (
        settings
      )}
      {actions && (
        // Start/End trip stays in reach even when the panel scrolls.
        <div className="sticky -bottom-4 -mx-4 bg-white px-4 pt-2 pb-4">
          {actions}
        </div>
      )}
    </section>
  )
}
