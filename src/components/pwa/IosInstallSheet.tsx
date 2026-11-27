import { useEffect, useId, useRef } from 'react'
import { copy } from '../../content/copy'

/**
 * iPhone and iPad have no install prompt for websites, so we show the steps.
 */
export function IosInstallSheet({ onClose }: { onClose: () => void }) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-lg font-bold text-navy">
          {copy.pwa.ios.title}
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink/90">
          <li>
            {copy.pwa.ios.step1} <ShareIcon />
          </li>
          <li>{copy.pwa.ios.step2}</li>
          <li>{copy.pwa.ios.step3}</li>
        </ol>
        <p className="text-sm text-ink/70">{copy.pwa.ios.why}</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-jeep-yellow px-4 py-3 font-semibold text-navy focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
        >
          {copy.pwa.ios.done}
        </button>
      </div>
    </div>
  )
}

/** The iOS Share symbol: a box with an arrow pointing up. */
function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Share"
      className="inline-block align-text-bottom text-gps-blue"
    >
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}
