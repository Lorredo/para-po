/**
 * "Install Para Po" support.
 *
 * - Android / desktop Chrome fire `beforeinstallprompt`; we keep the event so
 *   our own Install button can show the browser's prompt later.
 * - iPhone / iPad Safari have no install prompt at all; the UI shows
 *   "Share › Add to Home Screen" instructions instead.
 *
 * Chrome can fire the event before React has mounted, so this store starts
 * listening as soon as the module loads.
 */

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallSnapshot = {
  /** Already running as an installed app. */
  installed: boolean
  /** The browser's own install prompt is available. */
  canPrompt: boolean
  /** iPhone/iPad: show manual Add to Home Screen steps instead. */
  ios: boolean
}

export type InstallPromptStore = {
  getSnapshot(): InstallSnapshot
  subscribe(onChange: () => void): () => void
  /** Shows the browser prompt. Resolves to what the user chose. */
  prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export function isIosDevice(nav: Navigator | undefined): boolean {
  if (!nav) return false
  // iPadOS 13+ reports itself as a Mac, but has a touch screen.
  return (
    /iPhone|iPad|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  )
}

export function isStandalone(win: Window | undefined): boolean {
  if (!win) return false
  return (
    win.matchMedia?.('(display-mode: standalone)').matches === true ||
    (win.navigator as { standalone?: boolean }).standalone === true
  )
}

export function createInstallPromptStore(
  win: Window | undefined = globalThis.window,
): InstallPromptStore {
  const listeners = new Set<() => void>()
  let deferred: BeforeInstallPromptEvent | null = null
  let snapshot: InstallSnapshot = {
    installed: isStandalone(win),
    canPrompt: false,
    ios: isIosDevice(win?.navigator),
  }

  const update = (patch: Partial<InstallSnapshot>) => {
    snapshot = { ...snapshot, ...patch }
    listeners.forEach((l) => l())
  }

  win?.addEventListener('beforeinstallprompt', (event) => {
    // Stop Chrome's mini-infobar; we offer a calmer button in the header.
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    update({ canPrompt: true })
  })
  win?.addEventListener('appinstalled', () => {
    deferred = null
    update({ installed: true, canPrompt: false })
  })

  return {
    getSnapshot: () => snapshot,
    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    async prompt() {
      const event = deferred
      if (!event) return 'unavailable'
      // Each event can only be used once.
      deferred = null
      update({ canPrompt: false })
      await event.prompt()
      const { outcome } = await event.userChoice
      return outcome
    },
  }
}

export const installPrompt: InstallPromptStore = createInstallPromptStore()
