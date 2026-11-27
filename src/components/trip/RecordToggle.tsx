import { useId } from 'react'
import { copy } from '../../content/copy'

type RecordToggleProps = {
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}

/** Opt-in GPS log for field-testing. Off by default. */
export function RecordToggle({
  checked,
  disabled,
  onChange,
}: RecordToggleProps) {
  const id = useId()
  const hintId = useId()
  // A tool for field-testing, so it stays folded away for everyday riders.
  return (
    <details className="text-sm" open={checked}>
      <summary className="cursor-pointer font-semibold text-ink/70">
        {copy.record.section}
      </summary>
      <div className="mt-2 flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-navy"
        />
        <div>
          <label htmlFor={id} className="font-semibold text-ink">
            {copy.record.label}
          </label>
          <p id={hintId} className="text-xs text-ink/70">
            {copy.record.hint}
          </p>
        </div>
      </div>
    </details>
  )
}
