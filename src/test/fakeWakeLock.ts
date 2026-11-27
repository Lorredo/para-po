import { vi } from 'vitest'
import type { ScreenWakeLock, WakeLockStatus } from '../services/wakeLock'

/** A ScreenWakeLock that records calls; `result` sets what request() gives. */
export function createFakeWakeLock(
  result: WakeLockStatus = 'active',
): ScreenWakeLock & {
  request: ReturnType<typeof vi.fn<() => Promise<boolean>>>
  release: ReturnType<typeof vi.fn<() => void>>
} {
  let status: WakeLockStatus = 'off'
  const listeners = new Set<() => void>()
  const set = (next: WakeLockStatus) => {
    status = next
    listeners.forEach((l) => l())
  }
  return {
    getStatus: () => status,
    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    request: vi.fn(async () => {
      set(result)
      return result === 'active'
    }),
    release: vi.fn(() => set('off')),
  }
}
