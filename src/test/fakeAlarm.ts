import { vi } from 'vitest'
import type { AlarmAudio, PlayOptions } from '../services/audio/alarmAudio'
import type { RingtoneId } from '../services/audio/ringtones'
import type { Vibration } from '../services/vibration'

/** An AlarmAudio that records calls instead of making sound. */
export function createFakeAudio({ supported = true } = {}) {
  let playing = false
  let onEnded: (() => void) | undefined
  const audio = {
    supported,
    unlock: vi.fn(async () => supported),
    play: vi.fn((_id: RingtoneId, options: PlayOptions = {}) => {
      playing = true
      onEnded = options.onEnded
    }),
    stop: vi.fn(() => {
      playing = false
    }),
    isPlaying: vi.fn(() => playing),
  } satisfies AlarmAudio
  return {
    audio,
    /** Simulate a one-shot preview finishing on its own. */
    finish() {
      playing = false
      onEnded?.()
    },
  }
}

export function createFakeVibration() {
  return {
    supported: true,
    start: vi.fn<() => void>(),
    stop: vi.fn<() => void>(),
  } satisfies Vibration
}
