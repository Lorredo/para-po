import { RINGTONES, type Ringtone, type RingtoneId } from './ringtones'

/**
 * Plays alarm tones with the Web Audio API.
 *
 * Browsers block sound until the user taps something, so `unlock()` must be
 * called from inside a tap (Start trip, Preview, Test alarm). After that, the
 * alarm can start on its own when the GPS says we've arrived.
 */

export type PlayOptions = {
  /** Repeat until stopped (alarm), or play one cycle (preview). Default true. */
  loop?: boolean
  /** Start a little quieter and build up to full volume over 8 s. */
  crescendo?: boolean
  /** Called when a non-looping play finishes on its own. */
  onEnded?: () => void
}

export type AlarmAudio = {
  readonly supported: boolean
  /** Call inside a user tap. Resolves to true when sound can play. */
  unlock(): Promise<boolean>
  play(id: RingtoneId, options?: PlayOptions): void
  stop(): void
  isPlaying(): boolean
}

export type AlarmAudioOptions = {
  createContext?: () => AudioContext | null
  navigator?: Navigator | undefined
  /** Whether Web Audio exists, checked without creating a context. */
  available?: boolean
}

/** Schedule this far ahead so the loop never stutters. */
const LOOKAHEAD_S = 1.5
const PUMP_MS = 250
/** Small delay before the first note, so it's never scheduled in the past. */
const START_DELAY_S = 0.05
const FADE_OUT_S = 0.05
const CRESCENDO_FROM = 0.55
const CRESCENDO_S = 8
/** Exponential ramps can't reach 0. */
const SILENT = 0.0001

type Session = {
  master: GainNode
  nextCycleAt: number
  ringtone: Ringtone
  timer: ReturnType<typeof setInterval> | null
  endTimer: ReturnType<typeof setTimeout> | null
}

function audioContextClass(): typeof AudioContext | undefined {
  return (
    globalThis.AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  )
}

function defaultCreateContext(): AudioContext | null {
  const Ctor = audioContextClass()
  return Ctor ? new Ctor() : null
}

export function createAlarmAudio({
  createContext = defaultCreateContext,
  navigator = globalThis.navigator,
  available = audioContextClass() !== undefined,
}: AlarmAudioOptions = {}): AlarmAudio {
  let ctx: AudioContext | null = null
  let failed = false
  let session: Session | null = null

  function ensureContext(): AudioContext | null {
    if (ctx || failed) return ctx
    try {
      ctx = createContext()
    } catch {
      ctx = null
    }
    if (!ctx) failed = true
    return ctx
  }

  function teardown(s: Session) {
    if (s.timer) clearInterval(s.timer)
    if (s.endTimer) clearTimeout(s.endTimer)
    const c = ctx!
    const now = c.currentTime
    const gain = s.master.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(0, now + FADE_OUT_S)
    // Notes already scheduled ahead keep "playing" into a disconnected node.
    setTimeout(() => s.master.disconnect(), FADE_OUT_S * 1000 + 50)
  }

  function pump(s: Session) {
    const c = ctx!
    // If timers were throttled, don't try to catch up on missed cycles.
    if (s.nextCycleAt < c.currentTime) {
      s.nextCycleAt = c.currentTime + START_DELAY_S
    }
    while (s.nextCycleAt < c.currentTime + LOOKAHEAD_S) {
      scheduleCycle(c, s.master, s.ringtone, s.nextCycleAt)
      s.nextCycleAt += s.ringtone.cycleS
    }
  }

  const audio: AlarmAudio = {
    // Doesn't create the context: that must wait for a tap.
    get supported() {
      if (ctx) return true
      return !failed && available
    },

    async unlock() {
      const c = ensureContext()
      if (!c) return false
      allowPlaybackWhenSilenced(navigator)
      try {
        // iOS only unlocks after a sound *starts* inside the tap.
        // A one-sample silent buffer does that without anyone hearing it.
        const source = c.createBufferSource()
        source.buffer = c.createBuffer(1, 1, c.sampleRate)
        source.connect(c.destination)
        source.start(0)
        if (c.state !== 'running') await c.resume()
      } catch {
        return false
      }
      return c.state === 'running'
    },

    play(id, { loop = true, crescendo = false, onEnded } = {}) {
      audio.stop()
      const c = ensureContext()
      if (!c) return
      if (c.state === 'suspended') void c.resume().catch(() => {})

      const ringtone = RINGTONES[id]
      const now = c.currentTime
      const master = c.createGain()
      if (crescendo) {
        master.gain.setValueAtTime(CRESCENDO_FROM, now)
        master.gain.linearRampToValueAtTime(1, now + CRESCENDO_S)
      } else {
        master.gain.setValueAtTime(1, now)
      }
      master.connect(c.destination)

      const s: Session = {
        master,
        ringtone,
        nextCycleAt: now + START_DELAY_S,
        timer: null,
        endTimer: null,
      }
      session = s

      if (loop) {
        pump(s)
        s.timer = setInterval(() => pump(s), PUMP_MS)
        return
      }

      scheduleCycle(c, master, ringtone, s.nextCycleAt)
      const endsInMs = (START_DELAY_S + ringtone.cycleS) * 1000
      s.endTimer = setTimeout(() => {
        if (session !== s) return
        s.endTimer = null
        teardown(s)
        session = null
        onEnded?.()
      }, endsInMs)
    },

    stop() {
      if (!session) return
      teardown(session)
      session = null
    },

    isPlaying() {
      return session !== null
    },
  }

  return audio
}

/** Schedule one full cycle of a ringtone starting at time `t0`. */
function scheduleCycle(
  c: AudioContext,
  destination: AudioNode,
  ringtone: Ringtone,
  t0: number,
) {
  for (const step of ringtone.steps) {
    const start = t0 + step.at
    const end = start + step.durationS
    const peak = step.level / step.freqs.length
    for (const freq of step.freqs) {
      const osc = c.createOscillator()
      osc.type = step.wave
      osc.frequency.setValueAtTime(freq, start)

      const envelope = c.createGain()
      envelope.gain.setValueAtTime(SILENT, start)
      envelope.gain.exponentialRampToValueAtTime(peak, start + 0.01)
      if (step.decay) {
        envelope.gain.exponentialRampToValueAtTime(SILENT, end)
      } else {
        envelope.gain.setValueAtTime(peak, end - 0.02)
        envelope.gain.linearRampToValueAtTime(0, end)
      }

      osc.connect(envelope)
      envelope.connect(destination)
      osc.onended = () => {
        osc.disconnect()
        envelope.disconnect()
      }
      osc.start(start)
      osc.stop(end + 0.02)
    }
  }
}

/**
 * Safari 17+ lets a page say its sound is "playback" (like a music app), so
 * the ringer/silent switch doesn't mute it. Elsewhere this does nothing.
 */
function allowPlaybackWhenSilenced(nav: Navigator | undefined) {
  const session = (nav as { audioSession?: { type: string } } | undefined)
    ?.audioSession
  if (!session) return
  try {
    session.type = 'playback'
  } catch {
    // Read-only or unsupported value: nothing more we can do.
  }
}

/** App-wide instance. The AudioContext is created lazily, on first use. */
export const alarmAudio: AlarmAudio = createAlarmAudio()
