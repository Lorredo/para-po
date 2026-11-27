import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeAudioContext } from '../../test/fakeAudioContext'
import { createAlarmAudio } from './alarmAudio'
import { RINGTONE_IDS, RINGTONES } from './ringtones'

function setup(nav?: Navigator) {
  const ctx = new FakeAudioContext()
  const createContext = vi.fn(() => ctx.asAudioContext())
  const audio = createAlarmAudio({
    createContext,
    navigator: nav,
    available: true,
  })
  /** Move audio time and timers forward together. */
  const advance = (seconds: number) => {
    ctx.currentTime += seconds
    vi.advanceTimersByTime(seconds * 1000)
  }
  return { ctx, audio, createContext, advance }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('createAlarmAudio', () => {
  it('creates the AudioContext lazily, inside the first tap', async () => {
    const { audio, createContext } = setup()
    // Checking support must not create it: browsers warn about contexts
    // created outside a user gesture.
    expect(audio.supported).toBe(true)
    expect(createContext).not.toHaveBeenCalled()
    await audio.unlock()
    expect(createContext).toHaveBeenCalledTimes(1)
  })

  it('reports no support when Web Audio is missing', async () => {
    const audio = createAlarmAudio({ createContext: () => null })
    // jsdom has no AudioContext, like a very old browser.
    expect(audio.supported).toBe(false)
    await expect(audio.unlock()).resolves.toBe(false)
    expect(() => audio.play('bell')).not.toThrow()
    expect(audio.isPlaying()).toBe(false)
  })

  it('treats a throwing AudioContext constructor as unsupported', async () => {
    const audio = createAlarmAudio({
      available: true,
      createContext: () => {
        throw new Error('nope')
      },
    })
    expect(audio.supported).toBe(true)
    await expect(audio.unlock()).resolves.toBe(false)
    expect(audio.supported).toBe(false)
  })

  describe('unlock', () => {
    it('plays a silent sound and resumes the context', async () => {
      const { ctx, audio } = setup()
      await expect(audio.unlock()).resolves.toBe(true)
      expect(ctx.bufferSources).toHaveLength(1)
      expect(ctx.bufferSources[0]!.started).toBe(true)
      expect(ctx.state).toBe('running')
    })

    it('fails gracefully when the browser refuses', async () => {
      const { ctx, audio } = setup()
      ctx.failResume = true
      await expect(audio.unlock()).resolves.toBe(false)
    })

    it('asks Safari to keep playing when the silent switch is on', async () => {
      const nav = { audioSession: { type: 'auto' } } as unknown as Navigator
      const { audio } = setup(nav)
      await audio.unlock()
      expect(
        (nav as unknown as { audioSession: { type: string } }).audioSession
          .type,
      ).toBe('playback')
    })

    it('ignores a read-only audio session', async () => {
      const nav = {
        audioSession: Object.defineProperty({}, 'type', {
          get: () => 'auto',
          set: () => {
            throw new Error('read-only')
          },
        }),
      } as unknown as Navigator
      const { audio } = setup(nav)
      await expect(audio.unlock()).resolves.toBe(true)
    })
  })

  describe('play (looping alarm)', () => {
    it('schedules the ringtone and keeps it going', async () => {
      const { ctx, audio, advance } = setup()
      await audio.unlock()
      audio.play('beeps')
      expect(audio.isPlaying()).toBe(true)

      // Beeps: 4 notes per 1 s cycle, scheduled ~1.5 s ahead.
      expect(ctx.startedBetween(0, 1.05)).toHaveLength(4)
      expect(ctx.oscillators[0]!.freq).toBe(1046)
      expect(ctx.oscillators[0]!.type).toBe('square')

      advance(10)
      // Ten seconds later, notes are still being scheduled.
      expect(ctx.startedBetween(10, 11)).toHaveLength(4)
    })

    it('plays chords as one oscillator per note', async () => {
      const { ctx, audio } = setup()
      await audio.unlock()
      audio.play('jeepney')
      const first = ctx.startedBetween(0.04, 0.06)
      expect(first.map((o) => o.freq).sort()).toEqual([392, 494])
    })

    it('builds up volume with crescendo', async () => {
      const { ctx, audio } = setup()
      await audio.unlock()
      audio.play('bell', { crescendo: true })
      const master = ctx.gains[0]!
      expect(master.gain.events).toEqual([
        { type: 'set', value: 0.55, time: 0 },
        { type: 'linear', value: 1, time: 8 },
      ])
    })

    it('does not try to catch up after timers were throttled', async () => {
      const { ctx, audio } = setup()
      await audio.unlock()
      audio.play('beeps')
      // The tab was frozen for a minute: audio time moved, timers didn't.
      ctx.currentTime += 60
      const before = ctx.oscillators.length
      vi.advanceTimersByTime(250)
      // Only the next ~1.5 s gets scheduled, not 60 s of missed beeps.
      expect(ctx.oscillators.length - before).toBeLessThanOrEqual(8)
      expect(ctx.startedBetween(0, 60)).toHaveLength(before)
    })

    it('tries to resume a context the browser suspended', async () => {
      const { ctx, audio } = setup()
      await audio.unlock()
      ctx.state = 'suspended'
      audio.play('bell')
      expect(ctx.resumeCalls).toBe(2)
    })

    it('fades out and stops scheduling on stop()', async () => {
      const { ctx, audio, advance } = setup()
      await audio.unlock()
      audio.play('beeps')
      advance(2)
      audio.stop()
      expect(audio.isPlaying()).toBe(false)

      const master = ctx.gains[0]!
      expect(master.gain.events.at(-1)).toEqual({
        type: 'linear',
        value: 0,
        time: 2.05,
      })
      const count = ctx.oscillators.length
      advance(5)
      expect(ctx.oscillators.length).toBe(count)
      expect(master.disconnected).toBe(true)
    })

    it('replaces whatever was playing', async () => {
      const { ctx, audio } = setup()
      await audio.unlock()
      audio.play('beeps')
      audio.play('chime')
      expect(ctx.gains[0]!.gain.events.at(-1)?.value).toBe(0)
      expect(audio.isPlaying()).toBe(true)
    })

    it('frees notes once they finish', async () => {
      const { ctx, audio } = setup()
      await audio.unlock()
      audio.play('beeps')
      const osc = ctx.oscillators[0]!
      osc.onended?.()
      expect(osc.disconnected).toBe(true)
    })
  })

  describe('play once (preview)', () => {
    it('plays one cycle and reports when it ends', async () => {
      const { ctx, audio, advance } = setup()
      await audio.unlock()
      const onEnded = vi.fn()
      audio.play('chime', { loop: false, onEnded })
      expect(ctx.oscillators).toHaveLength(4)

      advance(RINGTONES.chime.cycleS - 0.1)
      expect(onEnded).not.toHaveBeenCalled()
      advance(0.2) // one cycle plus the short start delay
      expect(onEnded).toHaveBeenCalledTimes(1)
      expect(audio.isPlaying()).toBe(false)
      expect(ctx.oscillators).toHaveLength(4)
    })

    it('does not report "ended" if stopped early or replaced', async () => {
      const { audio, advance } = setup()
      await audio.unlock()
      const onEnded = vi.fn()
      audio.play('chime', { loop: false, onEnded })
      audio.stop()
      audio.play('bell', { loop: false })
      advance(5)
      expect(onEnded).not.toHaveBeenCalled()
    })
  })

  describe('ringtones', () => {
    it.each(RINGTONE_IDS)('%s fits inside its cycle and is audible', (id) => {
      const tone = RINGTONES[id]
      for (const step of tone.steps) {
        expect(step.at + step.durationS).toBeLessThanOrEqual(tone.cycleS)
        expect(step.level).toBeGreaterThan(0)
        expect(step.level).toBeLessThanOrEqual(1)
        expect(step.durationS).toBeGreaterThan(0.03)
      }
    })
  })
})
