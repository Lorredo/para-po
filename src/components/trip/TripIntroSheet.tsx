import { useEffect, useId, useRef } from 'react'
import { copy } from '../../content/copy'

type TripIntroSheetProps = {
  /** Mention that the browser will ask for location next. */
  mentionLocation: boolean
  /** Starts the trip. This tap is what lets the alarm make sound later. */
  onStart: () => void
  onCancel: () => void
}

/**
 * Shown before the first trip only. A web app can't run in the background,
 * so the most important thing a rider must know is to keep it on screen.
 */
export function TripIntroSheet({
  mentionLocation,
  onStart,
  onCancel,
}: TripIntroSheetProps) {
  const titleId = useId()
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    startRef.current?.focus()
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
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-bold text-navy">
          {copy.tripIntro.title}
        </h2>
        <ul className="space-y-3 text-sm text-ink/90">
          <Point icon="📱">{copy.tripIntro.keepOpen}</Point>
          <Point icon="🔊">{copy.tripIntro.volume}</Point>
          {mentionLocation && (
            <Point icon="📍">{copy.tripIntro.location}</Point>
          )}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            ref={startRef}
            type="button"
            onClick={onStart}
            className="rounded-xl bg-jeep-yellow px-4 py-3 font-bold text-navy focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
          >
            {copy.tripIntro.start}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-3 font-semibold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
          >
            {copy.tripIntro.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}

function Point({ icon, children }: { icon: string; children: string }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="text-lg leading-none">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  )
}
