import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  SETTINGS_KEY,
  saveSettings,
} from './settings'
import { createMemoryStore } from './storage'

describe('settings', () => {
  it('uses defaults on first visit', () => {
    expect(loadSettings(createMemoryStore())).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips saved settings', () => {
    const store = createMemoryStore()
    saveSettings({ radiusM: 750, ringtoneId: 'chime', introSeen: true }, store)
    expect(loadSettings(store)).toEqual({
      radiusM: 750,
      ringtoneId: 'chime',
      introSeen: true,
    })
  })

  it('repairs each field independently', () => {
    const store = createMemoryStore()
    store.write(SETTINGS_KEY, { radiusM: 99_999, ringtoneId: 'airhorn' })
    expect(loadSettings(store)).toEqual({
      radiusM: 2000,
      ringtoneId: DEFAULT_SETTINGS.ringtoneId,
      introSeen: false,
    })

    store.write(SETTINGS_KEY, { radiusM: 'far', ringtoneId: 'bell' })
    expect(loadSettings(store)).toEqual({
      radiusM: DEFAULT_SETTINGS.radiusM,
      ringtoneId: 'bell',
      introSeen: false,
    })
  })

  it('ignores junk', () => {
    const store = createMemoryStore()
    store.write(SETTINGS_KEY, 'not an object')
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS)
  })
})
