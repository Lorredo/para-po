import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatAway, useBackgroundReturn } from './useBackgroundReturn'

function fakeDocument() {
  let visibility: DocumentVisibilityState = 'visible'
  const target = new EventTarget()
  // defineProperty, not Object.assign: assign would copy the getter's value
  // once instead of the getter itself.
  Object.defineProperty(target, 'visibilityState', {
    get: () => visibility,
  })
  const doc = target as unknown as Document
  const set = (next: DocumentVisibilityState) =>
    act(() => {
      visibility = next
      target.dispatchEvent(new Event('visibilitychange'))
    })
  return { doc, hide: () => set('hidden'), show: () => set('visible') }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useBackgroundReturn', () => {
  it('reports how long Para Po was in the background during a trip', () => {
    const { doc, hide, show } = fakeDocument()
    const { result } = renderHook(() => useBackgroundReturn(true, doc))
    hide()
    vi.advanceTimersByTime(90_000)
    show()
    expect(result.current.awayMs).toBe(90_000)
    act(() => result.current.dismiss())
    expect(result.current.awayMs).toBeNull()
  })

  it('ignores a quick glance away', () => {
    const { doc, hide, show } = fakeDocument()
    const { result } = renderHook(() => useBackgroundReturn(true, doc))
    hide()
    vi.advanceTimersByTime(2000)
    show()
    expect(result.current.awayMs).toBeNull()
  })

  it('does nothing without a trip, and clears when the trip ends', () => {
    const { doc, hide, show } = fakeDocument()
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useBackgroundReturn(active, doc),
      { initialProps: { active: false } },
    )
    hide()
    vi.advanceTimersByTime(60_000)
    show()
    expect(result.current.awayMs).toBeNull()

    rerender({ active: true })
    hide()
    vi.advanceTimersByTime(60_000)
    show()
    expect(result.current.awayMs).toBe(60_000)
    rerender({ active: false })
    expect(result.current.awayMs).toBeNull()
  })
})

describe('formatAway', () => {
  it.each([
    [45_000, '45 seconds'],
    [61_000, '1 minute'],
    [12 * 60_000, '12 minutes'],
  ])('%d ms → %s', (ms, text) => {
    expect(formatAway(ms)).toBe(text)
  })
})
