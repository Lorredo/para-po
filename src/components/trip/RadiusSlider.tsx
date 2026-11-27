import { useId } from 'react'
import { RADIUS_MAX_M, RADIUS_MIN_M, RADIUS_STEP_M } from '../../config/trip'
import { copy } from '../../content/copy'
import { clampRadius, formatDistance } from '../../lib/geo/format'

type RadiusSliderProps = {
  value: number
  onChange: (meters: number) => void
}

export function RadiusSlider({ value, onChange }: RadiusSliderProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const label = formatDistance(value)

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {copy.radius.label}
        </label>
        <output htmlFor={id} className="text-lg font-bold text-navy">
          {label}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={RADIUS_MIN_M}
        max={RADIUS_MAX_M}
        step={RADIUS_STEP_M}
        value={value}
        aria-valuetext={label}
        aria-describedby={hintId}
        onChange={(event) =>
          onChange(
            clampRadius(
              Number(event.target.value),
              RADIUS_MIN_M,
              RADIUS_MAX_M,
              RADIUS_STEP_M,
            ),
          )
        }
        className="h-2 w-full cursor-pointer accent-navy"
      />
      <div className="flex justify-between text-xs text-ink/60" aria-hidden>
        <span>{formatDistance(RADIUS_MIN_M)}</span>
        <span>{formatDistance(RADIUS_MAX_M)}</span>
      </div>
      <p id={hintId} className="text-xs text-ink/70">
        {copy.radius.hint}
      </p>
    </div>
  )
}
