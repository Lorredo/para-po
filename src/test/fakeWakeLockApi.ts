import { vi } from 'vitest'

/** A fake `navigator.wakeLock` and `document`, driven by hand from tests. */
export function createFakeWakeLockEnv() {
  const sentinels: FakeSentinel[] = []
  let refuse = false
  let visibility: DocumentVisibilityState = 'visible'
  const visibilityListeners = new Set<() => void>()

  class FakeSentinel extends EventTarget {
    released = false
    release = vi.fn(async () => {
      if (this.released) return
      this.released = true
      this.dispatchEvent(new Event('release'))
    })
  }

  const wakeLock = {
    request: vi.fn(async () => {
      if (refuse || visibility === 'hidden') {
        throw new DOMException('Not allowed', 'NotAllowedError')
      }
      const sentinel = new FakeSentinel()
      sentinels.push(sentinel)
      return sentinel
    }),
  }

  const document = {
    get visibilityState() {
      return visibility
    },
    addEventListener: (_type: string, listener: () => void) => {
      visibilityListeners.add(listener)
    },
  } as unknown as Document

  return {
    navigator: { wakeLock } as unknown as Navigator,
    document,
    wakeLock,
    sentinels,
    refuse(value = true) {
      refuse = value
    },
    /** Like switching apps: the browser releases the lock. */
    async hide() {
      visibility = 'hidden'
      visibilityListeners.forEach((l) => l())
      await Promise.all(sentinels.map((s) => s.release()))
    },
    show() {
      visibility = 'visible'
      visibilityListeners.forEach((l) => l())
    },
  }
}
