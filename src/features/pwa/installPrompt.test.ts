import { describe, expect, it, vi } from 'vitest'
import {
  createInstallPromptStore,
  isIosDevice,
  isStandalone,
} from './installPrompt'

function fakeWindow({
  userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130',
  platform = 'Linux armv8l',
  maxTouchPoints = 5,
  standaloneMedia = false,
  navigatorStandalone,
}: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  standaloneMedia?: boolean
  navigatorStandalone?: boolean
} = {}) {
  const target = new EventTarget()
  return Object.assign(target, {
    navigator: {
      userAgent,
      platform,
      maxTouchPoints,
      standalone: navigatorStandalone,
    },
    matchMedia: (query: string) => ({
      matches: query === '(display-mode: standalone)' && standaloneMedia,
    }),
  }) as unknown as Window
}

function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  return Object.assign(event, {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  })
}

describe('isIosDevice', () => {
  it.each([
    [
      'iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)',
      'iPhone',
      5,
      true,
    ],
    [
      'iPad (iPadOS desktop mode)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'MacIntel',
      5,
      true,
    ],
    [
      'a real Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'MacIntel',
      0,
      false,
    ],
    ['Android', 'Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l', 5, false],
  ])('%s → %s', (_name, userAgent, platform, maxTouchPoints, expected) => {
    expect(
      isIosDevice({ userAgent, platform, maxTouchPoints } as Navigator),
    ).toBe(expected)
  })

  it('is false without a navigator', () => {
    expect(isIosDevice(undefined)).toBe(false)
  })
})

describe('isStandalone', () => {
  it('detects an installed app (display-mode or iOS navigator.standalone)', () => {
    expect(isStandalone(fakeWindow())).toBe(false)
    expect(isStandalone(fakeWindow({ standaloneMedia: true }))).toBe(true)
    expect(isStandalone(fakeWindow({ navigatorStandalone: true }))).toBe(true)
    expect(isStandalone(undefined)).toBe(false)
  })
})

describe('createInstallPromptStore', () => {
  it('captures the browser install prompt for later', () => {
    const win = fakeWindow()
    const store = createInstallPromptStore(win)
    const onChange = vi.fn()
    store.subscribe(onChange)
    expect(store.getSnapshot().canPrompt).toBe(false)

    const event = installEvent()
    win.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true) // no Chrome mini-infobar
    expect(store.getSnapshot().canPrompt).toBe(true)
    expect(onChange).toHaveBeenCalled()
  })

  it('shows the prompt once and reports the choice', async () => {
    const win = fakeWindow()
    const store = createInstallPromptStore(win)
    const event = installEvent('dismissed')
    win.dispatchEvent(event)

    await expect(store.prompt()).resolves.toBe('dismissed')
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().canPrompt).toBe(false)
    await expect(store.prompt()).resolves.toBe('unavailable')
  })

  it('knows when the app gets installed', () => {
    const win = fakeWindow()
    const store = createInstallPromptStore(win)
    win.dispatchEvent(installEvent())
    win.dispatchEvent(new Event('appinstalled'))
    expect(store.getSnapshot()).toMatchObject({
      installed: true,
      canPrompt: false,
    })
  })

  it('flags iPhones and already-installed apps from the start', () => {
    const iphone = createInstallPromptStore(
      fakeWindow({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)',
        platform: 'iPhone',
      }),
    )
    expect(iphone.getSnapshot()).toEqual({
      installed: false,
      canPrompt: false,
      ios: true,
    })
    const installed = createInstallPromptStore(
      fakeWindow({ standaloneMedia: true }),
    )
    expect(installed.getSnapshot().installed).toBe(true)
  })

  it('works without a window (e.g. server rendering)', async () => {
    const store = createInstallPromptStore(undefined)
    expect(store.getSnapshot().installed).toBe(false)
    await expect(store.prompt()).resolves.toBe('unavailable')
  })
})
