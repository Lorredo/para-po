import {
  RADIUS_DEFAULT_M,
  RADIUS_MAX_M,
  RADIUS_MIN_M,
  RADIUS_STEP_M,
} from '../config/trip'
import { clampRadius } from '../lib/geo/format'
import {
  DEFAULT_RINGTONE,
  isRingtoneId,
  type RingtoneId,
} from './audio/ringtones'
import { type KeyValueStore, localStore } from './storage'

/** Preferences remembered between visits. */
export type Settings = {
  radiusM: number
  ringtoneId: RingtoneId
}

export const SETTINGS_KEY = 'para-po:settings:v1'

export const DEFAULT_SETTINGS: Settings = {
  radiusM: RADIUS_DEFAULT_M,
  ringtoneId: DEFAULT_RINGTONE,
}

/** Reads saved settings, falling back field by field on anything invalid. */
export function loadSettings(store: KeyValueStore = localStore): Settings {
  const raw = store.read(SETTINGS_KEY)
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
  const { radiusM, ringtoneId } = raw as Record<string, unknown>
  return {
    radiusM:
      typeof radiusM === 'number' && Number.isFinite(radiusM)
        ? clampRadius(radiusM, RADIUS_MIN_M, RADIUS_MAX_M, RADIUS_STEP_M)
        : DEFAULT_SETTINGS.radiusM,
    ringtoneId: isRingtoneId(ringtoneId)
      ? ringtoneId
      : DEFAULT_SETTINGS.ringtoneId,
  }
}

export function saveSettings(
  settings: Settings,
  store: KeyValueStore = localStore,
): void {
  store.write(SETTINGS_KEY, settings)
}
