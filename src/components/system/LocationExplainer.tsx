import { useEffect, useId, useRef } from 'react'
import { copy } from '../../content/copy'

type LocationExplainerProps = {
  onAllow: () => void
  onCancel: () => void
}

/**
 * Shown before the browser's own permission prompt, so people know why
 * we're asking. A cold, unexplained prompt is the most common reason
 * people tap "Block".
 */
export function LocationExplainer({
  onAllow,
  onCancel,
}: LocationExplainerProps) {
  const titleId = useId()
  const bodyId = useId()
  const allowRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    allowRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-bold text-navy">
          {copy.location.explainer.title}
        </h2>
        <p id={bodyId} className="text-sm text-ink/80">
          {copy.location.explainer.body}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            ref={allowRef}
            type="button"
            onClick={onAllow}
            className="rounded-xl bg-jeep-yellow px-4 py-3 font-semibold text-navy focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
          >
            {copy.location.explainer.allow}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-3 font-semibold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
          >
            {copy.location.explainer.notNow}
          </button>
        </div>
      </div>
    </div>
  )
}
