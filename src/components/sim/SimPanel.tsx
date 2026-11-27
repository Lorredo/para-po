import { useId, useSyncExternalStore } from 'react'
import { copy } from '../../content/copy'
import type { Destination } from '../../features/trip/types'
import { formatDistance } from '../../lib/geo/format'
import type { SimController } from '../../services/location/simulatedProvider'

const RATES = [1, 10, 50] as const

type SimPanelProps = {
  controller: SimController
  suggestedStop: Destination
  onStart: () => void
  onUseStop: (stop: Destination) => void
}

/** Controls for the demo ride. Only shown with ?sim in the URL. */
export function SimPanel({
  controller,
  suggestedStop,
  onStart,
  onUseStop,
}: SimPanelProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState)
  const progressId = useId()

  return (
    <section
      aria-label={copy.sim.label}
      className="absolute inset-x-3 top-[4.5rem] z-[999] space-y-2 rounded-2xl bg-navy/95 p-3 text-white shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs">
          <span className="mr-1 rounded-full bg-jeep-yellow px-2 py-0.5 font-bold text-navy">
            {copy.sim.badge}
          </span>
          {state.routeName}
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

      {!state.running ? (
        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-xl bg-jeep-yellow px-4 py-2 text-sm font-bold text-navy focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          {copy.sim.start}
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={state.playing ? controller.pause : controller.play}
              className="w-20 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-jeep-yellow focus-visible:outline-none"
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
                  className={`px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-jeep-yellow focus-visible:outline-none ${
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
          <div>
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
              aria-valuetext={copy.sim.progressText(
                formatDistance(state.progressM),
                formatDistance(state.totalM),
              )}
              onChange={(event) => controller.seek(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-jeep-yellow"
            />
            <p className="text-right text-[11px] text-white/70 tabular-nums">
              {copy.sim.progressText(
                formatDistance(state.progressM),
                formatDistance(state.totalM),
              )}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
