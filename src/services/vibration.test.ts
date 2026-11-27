import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALARM_PATTERN_MS, createVibration } from './vibration'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('createVibration', () => {
  it('repeats the pattern every 2 s until stopped', () => {
    const vibrate = vi.fn(() => true)
    const v = createVibration({ vibrate } as unknown as Navigator)
    expect(v.supported).toBe(true)

    v.start()
    expect(vibrate).toHaveBeenLastCalledWith(ALARM_PATTERN_MS)
    vi.advanceTimersByTime(6000)
    expect(vibrate).toHaveBeenCalledTimes(4)

    v.stop()
    expect(vibrate).toHaveBeenLastCalledWith(0)
    vi.advanceTimersByTime(6000)
    expect(vibrate).toHaveBeenCalledTimes(5)
  })

  it('does not touch the hardware when stopping without having started', () => {
    const vibrate = vi.fn(() => true)
    createVibration({ vibrate } as unknown as Navigator).stop()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('ignores a second start', () => {
    const vibrate = vi.fn(() => true)
    const v = createVibration({ vibrate } as unknown as Navigator)
    v.start()
    v.start()
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('does nothing where vibration is unsupported (iPhone)', () => {
    const v = createVibration({} as Navigator)
    expect(v.supported).toBe(false)
    expect(() => {
      v.start()
      v.stop()
    }).not.toThrow()
  })

  it('survives browsers that throw', () => {
    const vibrate = vi.fn(() => {
      throw new Error('needs a tap first')
    })
    const v = createVibration({ vibrate } as unknown as Navigator)
    expect(() => {
      v.start()
      vi.advanceTimersByTime(2000)
      v.stop()
    }).not.toThrow()
  })
})
