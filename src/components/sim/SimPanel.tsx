import { useId, useSyncExternalStore } from 'react'
import { copy } from '../../content/copy'
import type { Destination } from '../../features/trip/types'
import { formatDistance } from '../../lib/geo/format'
import type { SimController } from '../../services/location/simulatedProvider'

const RATES = [1, 10, 50] as const

type SimPanelProps = {
  controller: SimController
  suggestedStop: Destination
  onUseStop: (stop: Destination) => void
  /** Where "Exit demo" goes (the real app). */
  exitHref?: string
}

/** Controls for the demo ride. Only shown with ?sim in the URL. */
export function SimPanel({
  controller,
  suggestedStop,
  onUseStop,
  exitHref,
}: SimPanelProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState)
  const progressId = useId()

  const progressText = copy.sim.progressText(
    formatDistance(state.progressM),
    formatDistance(state.totalM),
  )
  const badge = (
    <span className="shrink-0 rounded-full bg-jeep-yellow px-2 py-0.5 text-xs font-bold text-navy">
      {copy.sim.badge}
    </span>
  )

  // Positioned by the parent, in the overlay stack above the map.
  return (
    <section
      aria-label={copy.sim.label}
      className="pointer-events-auto space-y-2 rounded-2xl bg-navy/95 p-3 text-white shadow-lg"
    >
      {!state.running ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1 text-xs">
              {badge}
              <span className="truncate">{state.routeName}</span>
            </p>
            {suggestedStop.name && (
              <button
                type="button"
                onClick={() => onUseStop(suggestedStop)}
                className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-jeep-yellow focus-visible:outline-none"
              >
                {copy.sim.useStop(suggestedStop.name)}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-white/85">{copy.sim.startHint}</p>
            {exitHref && (
              <a
                href={exitHref}
                className="shrink-0 rounded text-xs font-semibold text-white underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-jeep-yellow focus-visible:outline-none"
              >
                {copy.demo.exit}
              </a>
            )}
          </div>
        </>
      ) : (
        // While riding, keep it to two short rows so the map stays visible.
        <>
          <div className="flex items-center gap-2">
            {badge}
            <button
              type="button"
              onClick={state.playing ? controller.pause : controller.play}
              className="w-16 rounded-lg bg-white/15 px-2 py-1 text-sm font-semibold hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-jeep-yellow focus-visible:outline-none"
            >
              {state.playing ? copy.sim.pause : copy.sim.play}
            </button>
            <div
              role="group"
              aria-label={copy.sim.speed}
              className="flex overflow-hidden rounded-lg bg-white/10"
            >
              {RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  aria-pressed={state.rate === rate}
                  onClick={() => controller.setRate(rate)}
                  className={`px-2.5 py-1 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-jeep-yellow focus-visible:outline-none ${
                    state.rate === rate
                      ? 'bg-jeep-yellow text-navy'
                      : 'hover:bg-white/15'
                  }`}
                >
                  {rate}×
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={progressId} className="sr-only">
              {copy.sim.progress}
            </label>
            <input
              id={progressId}
              type="range"
              min={0}
              max={Math.round(state.totalM)}
              step={50}
              value={Math.round(state.progressM)}
              aria-valuetext={progressText}
              onChange={(event) => controller.seek(Number(event.target.value))}
              className="h-2 min-w-0 flex-1 cursor-pointer accent-jeep-yellow"
            />
            <p className="shrink-0 text-[11px] text-white/75 tabular-nums">
              {progressText}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
