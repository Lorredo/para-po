import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RingtoneId } from '../../services/audio/ringtones'
import { createFakeAudio, createFakeVibration } from '../../test/fakeAlarm'
import { SNOOZE_MS, useAlarm } from './useAlarm'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-27T08:00:00+08:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

function setup(options: { shouldRingAgain?: () => boolean } = {}) {
  const { audio } = createFakeAudio()
  const vibration = createFakeVibration()
  const hook = renderHook(
    ({ ringtoneId }: { ringtoneId: RingtoneId }) =>
      useAlarm({ audio, vibration, ringtoneId, ...options }),
    { initialProps: { ringtoneId: 'jeepney' } },
  )
  return { audio, vibration, ...hook }
}

describe('useAlarm', () => {
  it('rings with sound that builds up, and vibration', () => {
    const { result, audio, vibration } = setup()
    act(() => result.current.ring('arrived'))
    expect(result.current.state).toEqual({
      status: 'ringing',
      reason: 'arrived',
    })
    expect(audio.play).toHaveBeenCalledWith('jeepney', {
      loop: true,
      crescendo: true,
    })
    expect(vibration.start).toHaveBeenCalled()
  })

  it('plays a test alarm at full volume straight away', () => {
    const { result, audio } = setup()
    act(() => result.current.ring('test'))
    expect(audio.play).toHaveBeenCalledWith('jeepney', {
      loop: true,
      crescendo: false,
    })
  })

  it('uses the latest ringtone', () => {
    const { result, audio, rerender } = setup()
    rerender({ ringtoneId: 'bell' })
    act(() => result.current.ring('arrived'))
    expect(audio.play).toHaveBeenCalledWith('bell', expect.anything())
  })

  it('stops sound and vibration', () => {
    const { result, audio, vibration } = setup()
    act(() => result.current.ring('arrived'))
    act(() => result.current.stop())
    expect(result.current.state).toEqual({ status: 'idle' })
    expect(audio.stop).toHaveBeenCalled()
    expect(vibration.stop).toHaveBeenCalled()
  })

  it('snoozes for a minute, then rings again', () => {
    const { result, audio } = setup()
    act(() => result.current.ring('passed'))
    act(() => result.current.snooze())

    expect(result.current.state).toEqual({
      status: 'snoozed',
      reason: 'passed',
      until: Date.now() + SNOOZE_MS,
    })
    expect(audio.stop).toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(SNOOZE_MS - 1))
    expect(result.current.state.status).toBe('snoozed')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.state).toEqual({
      status: 'ringing',
      reason: 'passed',
    })
    expect(audio.play).toHaveBeenCalledTimes(2)
  })

  it('stays quiet after a snooze when no longer needed', () => {
    const { result, audio } = setup({ shouldRingAgain: () => false })
    act(() => result.current.ring('arrived'))
    act(() => result.current.snooze())
    act(() => vi.advanceTimersByTime(SNOOZE_MS))
    expect(result.current.state).toEqual({ status: 'idle' })
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('turning it off during a snooze cancels the next ring', () => {
    const { result, audio } = setup()
    act(() => result.current.ring('arrived'))
    act(() => result.current.snooze())
    act(() => result.current.stop())
    act(() => vi.advanceTimersByTime(SNOOZE_MS * 2))
    expect(result.current.state).toEqual({ status: 'idle' })
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('never keeps ringing after unmount', () => {
    const { result, audio, vibration, unmount } = setup()
    act(() => result.current.ring('arrived'))
    act(() => result.current.snooze())
    unmount()
    expect(audio.stop).toHaveBeenCalled()
    expect(vibration.stop).toHaveBeenCalled()
    vi.advanceTimersByTime(SNOOZE_MS)
    expect(audio.play).toHaveBeenCalledTimes(1)
  })
})
