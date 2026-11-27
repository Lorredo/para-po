/**
 * Original alarm tones, synthesised with Web Audio: no audio files to license,
 * download or cache, and they work offline.
 */

export type RingtoneId = 'jeepney' | 'bell' | 'chime' | 'beeps'

/** One note (or chord) within a ringtone cycle. Times are in seconds. */
export type ToneStep = {
  at: number
  durationS: number
  /** Several frequencies play together as a chord. */
  freqs: number[]
  wave: OscillatorType
  /** Peak loudness 0–1, shared across the chord. */
  level: number
  /** Ring out like a struck bell instead of holding steady. */
  decay?: boolean
}

export type Ringtone = {
  id: RingtoneId
  /** One full pattern; loops start a new cycle after this long. */
  cycleS: number
  steps: ToneStep[]
}

/** Beep, beep, beeeep: a friendly two-tone horn. */
const JEEPNEY: Ringtone = {
  id: 'jeepney',
  cycleS: 1.4,
  steps: [
    { at: 0, durationS: 0.16, freqs: [392, 494], wave: 'square', level: 0.18 },
    {
      at: 0.24,
      durationS: 0.16,
      freqs: [392, 494],
      wave: 'square',
      level: 0.18,
    },
    {
      at: 0.48,
      durationS: 0.45,
      freqs: [392, 494],
      wave: 'square',
      level: 0.18,
    },
  ],
}

/** Two struck bells, each with a bright overtone. */
const BELL: Ringtone = {
  id: 'bell',
  cycleS: 1.6,
  steps: [
    {
      at: 0,
      durationS: 1.2,
      freqs: [880],
      wave: 'sine',
      level: 0.5,
      decay: true,
    },
    {
      at: 0,
      durationS: 0.8,
      freqs: [2217],
      wave: 'sine',
      level: 0.15,
      decay: true,
    },
    {
      at: 0.5,
      durationS: 1.0,
      freqs: [659],
      wave: 'sine',
      level: 0.45,
      decay: true,
    },
    {
      at: 0.5,
      durationS: 0.7,
      freqs: [1661],
      wave: 'sine',
      level: 0.12,
      decay: true,
    },
  ],
}

/** A rising C-major arpeggio. */
const CHIME: Ringtone = {
  id: 'chime',
  cycleS: 1.5,
  steps: [
    {
      at: 0,
      durationS: 0.35,
      freqs: [523.25],
      wave: 'triangle',
      level: 0.35,
      decay: true,
    },
    {
      at: 0.15,
      durationS: 0.35,
      freqs: [659.25],
      wave: 'triangle',
      level: 0.35,
      decay: true,
    },
    {
      at: 0.3,
      durationS: 0.35,
      freqs: [783.99],
      wave: 'triangle',
      level: 0.35,
      decay: true,
    },
    {
      at: 0.45,
      durationS: 0.7,
      freqs: [1046.5],
      wave: 'triangle',
      level: 0.35,
      decay: true,
    },
  ],
}

/** Four quick high beeps: hard to sleep through. */
const BEEPS: Ringtone = {
  id: 'beeps',
  cycleS: 1.0,
  steps: [0, 0.15, 0.3, 0.45].map((at) => ({
    at,
    durationS: 0.09,
    freqs: [1046],
    wave: 'square' as const,
    level: 0.15,
  })),
}

export const RINGTONES: Record<RingtoneId, Ringtone> = {
  jeepney: JEEPNEY,
  bell: BELL,
  chime: CHIME,
  beeps: BEEPS,
}

export const RINGTONE_IDS = Object.keys(RINGTONES) as RingtoneId[]
export const DEFAULT_RINGTONE: RingtoneId = 'jeepney'

export function isRingtoneId(value: unknown): value is RingtoneId {
  return typeof value === 'string' && value in RINGTONES
}
