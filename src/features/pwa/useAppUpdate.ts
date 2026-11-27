import { useRegisterSW } from 'virtual:pwa-register/react'

/** Check for a new version this often while the app stays open. */
const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Registers the service worker and reports when a new version is waiting.
 * Nothing reloads by itself: reloading mid-trip would stop the alarm, so the
 * UI asks first (and waits until no trip is running).
 */
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => void registration.update(), UPDATE_CHECK_MS)
    },
  })

  return {
    needRefresh,
    offlineReady,
    update: () => void updateServiceWorker(true),
    dismissUpdate: () => setNeedRefresh(false),
    dismissOfflineReady: () => setOfflineReady(false),
  }
}
