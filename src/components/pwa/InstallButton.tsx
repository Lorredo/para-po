import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { copy } from '../../content/copy'
import type { InstallPromptStore } from '../../features/pwa/installPrompt'
import { IosInstallSheet } from './IosInstallSheet'

/**
 * A quiet "Install" button in the header: the browser's own prompt on
 * Android/desktop Chrome, step-by-step instructions on iPhone. Hidden once
 * installed, and on browsers that can't install at all.
 */
export function InstallButton({ store }: { store: InstallPromptStore }) {
  const { installed, canPrompt, ios } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  )
  const [showIosSteps, setShowIosSteps] = useState(false)

  if (installed || (!canPrompt && !ios)) return null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canPrompt) void store.prompt()
          else setShowIosSteps(true)
        }}
        className="ml-auto rounded-full border border-white/40 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-jeep-yellow focus-visible:outline-none"
      >
        {copy.pwa.install}
      </button>
      {showIosSteps &&
        createPortal(
          <IosInstallSheet onClose={() => setShowIosSteps(false)} />,
          document.body,
        )}
    </>
  )
}
