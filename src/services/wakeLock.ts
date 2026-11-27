/**
 * Keeps the screen on during a trip (Screen Wake Lock API).
 *
 * This is the web's answer to background tracking: browsers pause pages when
 * the screen locks, so we stop it from locking. The browser drops the lock
 * whenever the tab is hidden (switching apps), so we take it again as soon as
 * Para Po is visible.
 */

export type WakeLockStatus =
  | 'off' // not wanted
  | 'pending' // asking the browser
  | 'active' // the screen will stay on
  | 'lost' // dropped while hidden; re-acquired on return
  | 'unsupported' // no Wake Lock API (older browsers)
  | 'error' // the browser refused (e.g. Battery Saver)

export type ScreenWakeLock = {
  getStatus(): WakeLockStatus
  subscribe(onChange: () => void): () => void
  /** Call when a trip starts. Resolves to true if the screen will stay on. */
  request(): Promise<boolean>
  /** Call when a trip ends. */
  release(): void
}

type WakeLockOptions = {
  navigator?: Navigator | undefined
  document?: Document | undefined
}

export function createScreenWakeLock({
  navigator = globalThis.navigator,
  document = globalThis.document,
}: WakeLockOptions = {}): ScreenWakeLock {
  const api = navigator?.wakeLock
  const listeners = new Set<() => void>()
  let status: WakeLockStatus = 'off'
  let wanted = false
  let sentinel: WakeLockSentinel | null = null

  const set = (next: WakeLockStatus) => {
    if (next === status) return
    status = next
    listeners.forEach((listener) => listener())
  }

  async function acquire(): Promise<boolean> {
    if (!api) {
      set('unsupported')
      return false
    }
    if (sentinel) return true
    set('pending')
    try {
      const lock = await api.request('screen')
      if (!wanted) {
        // The trip ended while we were waiting.
        void lock.release().catch(() => {})
        return false
      }
      sentinel = lock
      lock.addEventListener('release', () => {
        if (sentinel !== lock) return
        sentinel = null
        if (wanted) set('lost')
      })
      set('active')
      return true
    } catch {
      // Requests made while hidden always fail; that's "lost", not an error.
      set(document?.visibilityState === 'hidden' ? 'lost' : 'error')
      return false
    }
  }

  document?.addEventListener('visibilitychange', () => {
    if (wanted && !sentinel && document.visibilityState === 'visible') {
      void acquire()
    }
  })

  return {
    getStatus: () => status,
    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    request() {
      wanted = true
      return acquire()
    },
    release() {
      wanted = false
      const lock = sentinel
      sentinel = null
      if (lock) void lock.release().catch(() => {})
      set('off')
    },
  }
}

export const screenWakeLock: ScreenWakeLock = createScreenWakeLock()
